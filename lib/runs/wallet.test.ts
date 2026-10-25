import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

// Nunca falamos com o Supabase de verdade nos testes: o cliente é um dublê que guarda cada chamada (às funções da
// carteira e às tabelas) e devolve o resultado que o teste combinou.

const recorded = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const results = vi.hoisted(() => ({ queue: [] as Array<{ data?: unknown; error?: unknown; count?: number }> }));

const fakeClient = vi.hoisted(() => {
  const next = () => results.queue.shift() ?? { data: null, error: null };
  function chain(record: Record<string, unknown>): unknown {
    const self: Record<string, unknown> = {};
    for (const method of ["select", "eq", "order", "limit", "maybeSingle"]) {
      self[method] = (...args: unknown[]) => {
        record.ops = [...((record.ops as unknown[]) ?? []), { method, args }];
        return self;
      };
    }
    self.then = (resolve: (value: unknown) => unknown) => resolve({ error: null, ...next() });
    return self;
  }
  return (who: string) => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      recorded.push({ who, rpc: name, args });
      return { error: null, ...next() };
    },
    from: (table: string) => {
      const record: Record<string, unknown> = { who, table };
      recorded.push(record);
      return chain(record);
    },
  });
});

vi.mock("@/lib/runs/supabase-server", () => ({ supabaseAdmin: () => fakeClient("admin") }));

import {
  chargeStep,
  closeRunHolds,
  countRunCharges,
  findOpenRunHold,
  holdRemainingCents,
  reserveForRun,
  sumOwnRunCharges,
  WalletRefusedError,
  walletRefusalMessage,
} from "./wallet";

afterEach(() => {
  recorded.length = 0;
  results.queue = [];
});

describe("carteira vista por uma execução (com cliente dublê)", () => {
  it("reserveForRun chama a função da carteira com a pessoa, o valor e o id da execução, e devolve a reserva", async () => {
    results.queue = [{ data: "hold-1" }];
    expect(await reserveForRun("pessoa-1", "run-1", 531)).toBe("hold-1");
    expect(recorded[0]).toEqual({
      who: "admin",
      rpc: "wallet_reserve",
      args: { p_member_id: "pessoa-1", p_amount_cents: 531, p_run_id: "run-1" },
    });
  });

  it("reserveForRun transforma as recusas do banco em WalletRefusedError; outro erro sobe como está", async () => {
    for (const reason of ["insufficient_balance", "monthly_budget_exceeded", "member_inactive"] as const) {
      results.queue = [{ error: { message: reason, code: "P0001" } }];
      await expect(reserveForRun("pessoa-1", "run-1", 531)).rejects.toEqual(new WalletRefusedError(reason));
    }
    results.queue = [{ error: { message: "connection refused" } }];
    await expect(reserveForRun("pessoa-1", "run-1", 531)).rejects.toEqual({ message: "connection refused" });
  });

  it("chargeStep lança o gasto com a descrição e a IA, e devolve o que sobra; reserva fechada não cobra (null)", async () => {
    results.queue = [{ data: 400 }];
    const charge = { amountCents: 12, description: "Criar um site · Chefe", provider: "claude" as const };
    expect(await chargeStep("hold-1", "run-1", charge)).toBe(400);
    expect(recorded[0]).toMatchObject({
      rpc: "wallet_charge",
      args: {
        p_hold_id: "hold-1",
        p_amount_cents: 12,
        p_description: "Criar um site · Chefe",
        p_provider: "claude",
        p_run_id: "run-1",
      },
    });

    results.queue = [{ error: { message: "hold_closed" } }];
    expect(await chargeStep("hold-1", "run-1", charge)).toBeNull();
  });

  it("findOpenRunHold acha a reserva aberta mais recente da execução", async () => {
    results.queue = [{ data: { id: "hold-2", amount_cents: 452, charged_cents: 100, expires_at: "2026-10-25T13:00:00Z" } }];
    const hold = await findOpenRunHold("run-1");
    expect(hold).toEqual({ id: "hold-2", amountCents: 452, chargedCents: 100, expiresAt: "2026-10-25T13:00:00Z" });
    expect(holdRemainingCents(hold!)).toBe(352);
    const ops = recorded[0].ops as { method: string; args: unknown[] }[];
    expect(recorded[0].table).toBe("wallet_holds");
    expect(ops.filter((op) => op.method === "eq").map((op) => op.args)).toEqual([
      ["run_id", "run-1"],
      ["status", "open"],
    ]);

    results.queue = [{ data: null }];
    expect(await findOpenRunHold("run-1")).toBeNull();
  });

  it("closeRunHolds fecha, pela função da carteira, cada reserva aberta da execução", async () => {
    results.queue = [{ data: [{ id: "hold-1" }, { id: "hold-2" }] }];
    await closeRunHolds("run-1");
    expect(recorded.filter((call) => call.rpc).map((call) => call.args)).toEqual([
      { p_hold_id: "hold-1" },
      { p_hold_id: "hold-2" },
    ]);
  });

  it("countRunCharges conta as linhas de gasto da execução; sumOwnRunCharges soma com a sessão", async () => {
    results.queue = [{ count: 3 }];
    expect(await countRunCharges("run-1")).toBe(3);
    expect(recorded[0]).toMatchObject({ who: "admin", table: "wallet_entries" });

    // Os gastos entram negativos no extrato; a soma vem positiva.
    results.queue = [{ data: [{ amount_cents: -12 }, { amount_cents: -30 }] }];
    expect(await sumOwnRunCharges(fakeClient("session") as unknown as SupabaseClient, "run-1")).toBe(42);
    expect(recorded[1]).toMatchObject({ who: "session", table: "wallet_entries" });
  });

  it("as recusas viram uma frase em português com o que fazer, diferente para o dono e o funcionário", () => {
    expect(walletRefusalMessage("insufficient_balance", false, 531)).toBe(
      "A empresa não tem saldo para reservar R$ 5,31, o máximo que o time pode gastar. " +
        "Peça ao dono da empresa para colocar crédito.",
    );
    expect(walletRefusalMessage("insufficient_balance", true, 531)).toContain("fale com a nossa equipe");
    expect(walletRefusalMessage("monthly_budget_exceeded", false, 531)).toContain("passaria do seu teto do mês");
    expect(walletRefusalMessage("member_inactive", false, 531)).toContain("desativada");
  });
});

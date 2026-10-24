import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

// Nunca falamos com o Supabase de verdade nos testes: trocamos o cliente por um dublê encadeável.
// Cada chamada guarda a tabela, a operação e os filtros; o `.then` resolve com o resultado que o teste combinou.

const calls = vi.hoisted(() => [] as Array<Record<string, unknown>>);
// O resultado que o próximo `await` de uma consulta vai receber ({ data, error }).
const nextResult = vi.hoisted(() => ({ value: { data: null as unknown, error: null as unknown } }));

const fakeClient = vi.hoisted(() => {
  function makeChain(record: Record<string, unknown>): unknown {
    const chain: Record<string, unknown> = {};
    const methods = [
      "insert",
      "update",
      "delete",
      "select",
      "eq",
      "in",
      "or",
      "gt",
      "order",
      "limit",
      "single",
      "maybeSingle",
    ];
    for (const method of methods) {
      chain[method] = (...args: unknown[]) => {
        record.ops = [...((record.ops as unknown[]) ?? []), { method, args }];
        return chain;
      };
    }
    // Torna o encadeamento "aguardável" em qualquer ponto (ex.: depois de .order() ou de .single()).
    chain.then = (resolve: (value: unknown) => unknown) => resolve(nextResult.value);
    return chain;
  }
  return (who: string) => ({
    from: (table: string) => {
      const record: Record<string, unknown> = { table, who };
      calls.push(record);
      return makeChain(record);
    },
  });
});

vi.mock("@/lib/runs/supabase-server", () => ({ supabaseAdmin: () => fakeClient("admin") }));

import { cancelRun, claimRun, createRun, EVENTS_PAGE_SIZE, loadOwnEventsAfter, loadOwnRun, renewLease } from "./store";

type Op = { method: string; args: unknown[] };
const opsOf = (index: number) => calls[index].ops as Op[];
const session = () => fakeClient("session") as unknown as SupabaseClient;

afterEach(() => {
  calls.length = 0;
  nextResult.value = { data: null, error: null };
});

describe("store da execução persistida (com cliente dublê)", () => {
  it("createRun insere na tabela certa, com a empresa e a pessoa, já na fila, e devolve o id gerado", async () => {
    nextResult.value = { data: { id: "run-123" }, error: null };

    const id = await createRun({
      company_id: "empresa-1",
      member_id: "pessoa-1",
      recipe_id: "create-site",
      request: "um site",
      team: { frontend: "claude" },
      plan: [],
    });

    expect(id).toBe("run-123");
    expect(calls[0]).toMatchObject({ table: "runs", who: "admin" });
    expect(opsOf(0).find((op) => op.method === "insert")?.args[0]).toMatchObject({
      company_id: "empresa-1",
      member_id: "pessoa-1",
      status: "queued",
      cursor: { stageIndex: 0, round: 1 },
      recipe_id: "create-site",
    });
  });

  it("claimRun só reivindica quem está na fila ou rodando, com a reserva vencida, somando 1 na tentativa", async () => {
    // 1ª consulta: lê o attempt atual. 2ª consulta: a troca condicional devolve a linha reivindicada.
    nextResult.value = { data: { attempt: 2 }, error: null };
    const claimed = await claimRun("run-123");

    // Com o dublê, ambas as consultas veem o mesmo resultado; o que importa são os filtros montados.
    expect(claimed).toEqual({ attempt: 2 });
    const ops = opsOf(1);
    expect(ops.find((op) => op.method === "update")?.args[0]).toMatchObject({ status: "running", attempt: 3 });
    expect(ops.some((op) => op.method === "in")).toBe(true);
    expect(ops.some((op) => op.method === "or")).toBe(true);
  });

  it("claimRun devolve null quando a execução não existe", async () => {
    nextResult.value = { data: null, error: null };
    expect(await claimRun("sumiu")).toBeNull();
  });

  it("renewLease só renova a reserva da mesma reivindicação e devolve o status atual", async () => {
    nextResult.value = { data: { status: "cancelled" }, error: null };
    expect(await renewLease("run-123", 3)).toBe("cancelled");
    const ops = opsOf(0);
    expect(ops.find((op) => op.method === "update")?.args[0]).toHaveProperty("lease_until");
    expect(ops.filter((op) => op.method === "eq").map((op) => op.args)).toEqual([
      ["id", "run-123"],
      ["attempt", 3],
    ]);

    nextResult.value = { data: null, error: null };
    expect(await renewLease("run-123", 3)).toBeNull();
  });

  it("cancelRun só cancela o que ainda não acabou e diz se cancelou", async () => {
    nextResult.value = { data: [{ id: "run-123" }], error: null };
    expect(await cancelRun("run-123")).toBe(true);
    const ops = opsOf(0);
    expect(ops.find((op) => op.method === "update")?.args[0]).toMatchObject({ status: "cancelled" });
    expect(ops.find((op) => op.method === "in")?.args).toEqual(["status", ["queued", "running", "paused"]]);

    nextResult.value = { data: [], error: null };
    expect(await cancelRun("run-123")).toBe(false);
  });

  it("loadOwnRun lê com a sessão de quem está logado, só as colunas que ela pode ver", async () => {
    nextResult.value = { data: { id: "run-123", status: "running" }, error: null };
    expect(await loadOwnRun(session(), "run-123")).toEqual({ id: "run-123", status: "running" });
    expect(calls[0]).toMatchObject({ table: "runs", who: "session" });
    const columns = String(opsOf(0).find((op) => op.method === "select")?.args[0]);
    // As colunas internas (erro técnico, reserva, tentativas) a sessão nem pode pedir.
    expect(columns).not.toMatch(/\*|error|lease_until|attempt/);
  });

  it("loadOwnEventsAfter traz os eventos com a posição (seq), em ordem, com a sessão e em partes", async () => {
    nextResult.value = {
      data: [
        { id: 5, event: { type: "step-finished", stepId: "brief", durationMs: 10 } },
        { id: 6, event: { type: "run-finished", result: "ok", durationMs: 20 } },
      ],
      error: null,
    };

    const events = await loadOwnEventsAfter(session(), "run-123", 4);
    expect(events).toEqual([
      { seq: 5, event: { type: "step-finished", stepId: "brief", durationMs: 10 } },
      { seq: 6, event: { type: "run-finished", result: "ok", durationMs: 20 } },
    ]);
    expect(calls[0]).toMatchObject({ table: "run_events", who: "session" });
    const ops = opsOf(0);
    expect(ops.find((op) => op.method === "gt")?.args).toEqual(["id", 4]);
    expect(ops.find((op) => op.method === "limit")?.args).toEqual([EVENTS_PAGE_SIZE]);
  });
});

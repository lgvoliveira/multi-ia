import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadCompanyCredit,
  loadMemberMonthDetails,
  loadMonth,
  loadMonthSpending,
  monthStartInBrasilia,
} from "./spending";
import { STATEMENT_PAGE_SIZE } from "./statement";

const RECIPE_ROW = {
  entry_id: 3,
  kind: "charge",
  member_id: "pessoa-1",
  run_id: "run-1",
  task_id: null,
  description: "Criar um site",
  providers: ["claude", "gemini", "gpt"],
  amount_cents: -37,
  created_at: "2026-10-25T12:00:00Z",
};

describe("gasto do mês", () => {
  it("o mês começa no dia 1º, à meia-noite de Brasília (3 da manhã no horário universal)", () => {
    expect(monthStartInBrasilia(new Date("2026-10-25T15:00:00Z")).toISOString()).toBe("2026-10-01T03:00:00.000Z");
    // 1º de novembro, 1 da manhã no horário universal: em Brasília ainda é 31 de outubro.
    expect(monthStartInBrasilia(new Date("2026-11-01T01:00:00Z")).toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(monthStartInBrasilia(new Date("2026-11-01T03:00:00Z")).toISOString()).toBe("2026-11-01T03:00:00.000Z");
    expect(monthStartInBrasilia(new Date("2027-01-01T02:59:00Z")).toISOString()).toBe("2026-12-01T03:00:00.000Z");
  });

  it("o gasto do mês vem da conta feita no banco (F48), só da pessoa, com o teto", async () => {
    const calls: unknown[][] = [];
    const session = fakeSession(calls, {
      rpc: { member_month_summary: [monthRow("pessoa-1", 1234)] },
      tables: { members: { monthly_budget_cents: 5000 } },
    });
    expect(await loadMonth(session, "pessoa-1")).toEqual({ spentCents: 1234, budgetCents: 5000 });
    expect(calls).toContainEqual(["rpc", "member_month_summary", { p_member_id: "pessoa-1" }]);
  });

  it("sem gasto nenhum e sem teto, zero e teto vazio", async () => {
    const session = fakeSession([], {
      rpc: { member_month_summary: [] },
      tables: { members: { monthly_budget_cents: null } },
    });
    expect(await loadMonth(session, "pessoa-1")).toEqual({ spentCents: 0, budgetCents: null });
  });

  it("Meus gastos: o extrato da pessoa, com cada receita numa linha e as IAs que trabalharam", async () => {
    const calls: unknown[][] = [];
    const session = fakeSession(calls, {
      rpc: { member_month_summary: [monthRow("pessoa-1", 37)], month_statement: [RECIPE_ROW] },
      tables: { members: { monthly_budget_cents: null } },
    });
    const result = await loadMonthSpending(session, "pessoa-1");
    expect(result.month).toEqual({ spentCents: 37, budgetCents: null });
    expect(result.more).toBe(false);
    expect(result.lines).toEqual([
      {
        id: 3,
        kind: "charge",
        memberId: "pessoa-1",
        recipe: true,
        description: "Criar um site",
        // Na ordem das IAs no site, não na alfabética que vem do banco.
        providers: ["claude", "gpt", "gemini"],
        amountCents: -37,
        createdAt: "2026-10-25T12:00:00Z",
      },
    ]);
    // Pede uma linha a mais do que mostra, para saber se há mais.
    expect(calls).toContainEqual([
      "rpc",
      "month_statement",
      { p_member_id: "pessoa-1", p_limit: STATEMENT_PAGE_SIZE + 1 },
    ]);
  });

  it("com mais linhas do que a tela mostra, avisa e corta", async () => {
    const rows = Array.from({ length: STATEMENT_PAGE_SIZE + 1 }, (_, index) => ({ ...RECIPE_ROW, entry_id: index + 1 }));
    const session = fakeSession([], {
      rpc: { member_month_summary: [], month_statement: rows },
      tables: { members: { monthly_budget_cents: null } },
    });
    const result = await loadMonthSpending(session, "pessoa-1");
    expect(result.more).toBe(true);
    expect(result.lines).toHaveLength(STATEMENT_PAGE_SIZE);
  });

  it("o crédito da empresa: o disponível é o saldo menos o reservado, com o gasto por IA", async () => {
    const session = fakeSession([], {
      rpc: {
        company_credit: [{ balance_cents: 9127, reserved_cents: 70, month_spent_cents: 73 }],
        company_month_by_provider: [
          { provider: "claude", spent_cents: 43 },
          { provider: "gemini", spent_cents: 12 },
          { provider: "gpt", spent_cents: 22 },
          { provider: null, spent_cents: -4 },
        ],
      },
    });
    expect(await loadCompanyCredit(session)).toEqual({
      balanceCents: 9127,
      reservedCents: 70,
      availableCents: 9057,
      monthSpentCents: 73,
      byProvider: [
        { provider: "claude", spentCents: 43 },
        { provider: "gpt", spentCents: 22 },
        { provider: "gemini", spentCents: 12 },
        { provider: null, spentCents: -4 },
      ],
    });
  });

  it("para quem não é dono, o banco não devolve o crédito, e a conta vem vazia", async () => {
    const session = fakeSession([], { rpc: { company_credit: [], company_month_by_provider: [] } });
    expect(await loadCompanyCredit(session)).toBeNull();
  });

  it("Ver o que fez: as linhas do mês da pessoa e as entregas deste mês", async () => {
    const calls: unknown[][] = [];
    const session = fakeSession(calls, {
      rpc: { month_statement: [RECIPE_ROW] },
      tables: { files: [{ id: "a1", name: "site.html", created_at: "2026-10-25T12:00:00Z" }] },
    });
    const details = await loadMemberMonthDetails(session, "pessoa-1", new Date("2026-10-25T15:00:00Z"));
    expect(details.lines).toHaveLength(1);
    expect(details.deliveries).toEqual([{ id: "a1", name: "site.html", createdAt: "2026-10-25T12:00:00Z" }]);
    expect(calls).toContainEqual(["files", "eq", "member_id", "pessoa-1"]);
    expect(calls).toContainEqual(["files", "eq", "kind", "delivery"]);
    expect(calls).toContainEqual(["files", "gte", "created_at", "2026-10-01T03:00:00.000Z"]);
  });
});

function monthRow(memberId: string, spent: number) {
  return { member_id: memberId, spent_cents: spent, reserved_cents: 0, quick_tasks: 0, recipes: 0, deliveries: 0 };
}

/** Um Supabase de mentira que anota as chamadas e devolve dados fixos por função e por tabela. */
function fakeSession(
  calls: unknown[][],
  data: { rpc?: Record<string, unknown>; tables?: Record<string, unknown> },
): SupabaseClient {
  return {
    rpc(name: string, args?: unknown) {
      calls.push(["rpc", name, args]);
      return Promise.resolve({ data: data.rpc?.[name] ?? null, error: null });
    },
    from(table: string) {
      const result = { data: data.tables?.[table] ?? null, error: null };
      const query = {
        select: () => query,
        eq: (...args: unknown[]) => (calls.push([table, "eq", ...args]), query),
        gte: (...args: unknown[]) => (calls.push([table, "gte", ...args]), query),
        order: () => query,
        limit: () => query,
        maybeSingle: () => Promise.resolve(result),
        then: (resolve: (value: unknown) => void) => resolve(result),
      };
      return query;
    },
  } as unknown as SupabaseClient;
}

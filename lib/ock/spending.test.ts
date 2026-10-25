import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadMonthSpending, monthStartInBrasilia } from "./spending";

describe("gasto do mês", () => {
  it("o mês começa no dia 1º, à meia-noite de Brasília (3 da manhã no horário universal)", () => {
    expect(monthStartInBrasilia(new Date("2026-10-25T15:00:00Z")).toISOString()).toBe("2026-10-01T03:00:00.000Z");
    // 1º de novembro, 1 da manhã no horário universal: em Brasília ainda é 31 de outubro.
    expect(monthStartInBrasilia(new Date("2026-11-01T01:00:00Z")).toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(monthStartInBrasilia(new Date("2026-11-01T03:00:00Z")).toISOString()).toBe("2026-11-01T03:00:00.000Z");
    expect(monthStartInBrasilia(new Date("2027-01-01T02:59:00Z")).toISOString()).toBe("2026-12-01T03:00:00.000Z");
  });

  it("soma os gastos e ajustes da própria pessoa desde o começo do mês, e traz o teto", async () => {
    const filters: unknown[][] = [];
    const session = fakeSession(filters, {
      members: { monthly_budget_cents: 5000 },
      wallet_entries: [
        { id: 2, created_at: "2026-10-25T12:00:00Z", description: "Tarefa rápida · Resposta", provider: "claude", amount_cents: -3 },
        { id: 1, created_at: "2026-10-20T12:00:00Z", description: "Ajuste", provider: null, amount_cents: 1 },
      ],
    });
    const result = await loadMonthSpending(session, "pessoa-1", new Date("2026-10-25T15:00:00Z"));
    expect(result.month).toEqual({ spentCents: 2, budgetCents: 5000 });
    expect(result.entries[0]).toEqual({
      id: 2,
      createdAt: "2026-10-25T12:00:00Z",
      description: "Tarefa rápida · Resposta",
      provider: "claude",
      amountCents: 3,
    });
    // Só as linhas da pessoa (o dono enxerga as de todos), de gasto e ajuste, deste mês.
    expect(filters).toContainEqual(["wallet_entries", "eq", "member_id", "pessoa-1"]);
    expect(filters).toContainEqual(["wallet_entries", "in", "kind", ["charge", "adjustment"]]);
    expect(filters).toContainEqual(["wallet_entries", "gte", "created_at", "2026-10-01T03:00:00.000Z"]);
  });

  it("sem teto, o teto vem vazio", async () => {
    const session = fakeSession([], { members: { monthly_budget_cents: null }, wallet_entries: [] });
    expect((await loadMonthSpending(session, "pessoa-1")).month).toEqual({ spentCents: 0, budgetCents: null });
  });
});

/** Um Supabase de mentira que anota os filtros de cada consulta e devolve dados fixos por tabela. */
function fakeSession(filters: unknown[][], data: Record<string, unknown>): SupabaseClient {
  return {
    from(table: string) {
      const query = {
        select: () => query,
        eq: (...args: unknown[]) => (filters.push([table, "eq", ...args]), query),
        in: (...args: unknown[]) => (filters.push([table, "in", ...args]), query),
        gte: (...args: unknown[]) => (filters.push([table, "gte", ...args]), query),
        order: () => query,
        maybeSingle: () => Promise.resolve({ data: data[table], error: null }),
        then: (resolve: (value: unknown) => void) => resolve({ data: data[table], error: null }),
      };
      return query;
    },
  } as unknown as SupabaseClient;
}

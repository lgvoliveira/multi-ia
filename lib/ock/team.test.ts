import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deadlineText, listTeam, parseInviteRow, parseTeamRow, sortTeam, updateEmployee, type TeamMember } from "./team";

const ROW = {
  id: "b2",
  name: "Ana Lima",
  email: "ana@example.com",
  role: "employee",
  monthly_budget_cents: 5000,
  status: "active",
};

function person(overrides: Partial<TeamMember>): TeamMember {
  return {
    id: "x",
    name: "X",
    email: "x@example.com",
    role: "employee",
    monthlyBudgetCents: null,
    status: "active",
    invite: null,
    ...overrides,
  };
}

describe("equipe da empresa", () => {
  it("lê cada pessoa, com ou sem teto", () => {
    expect(parseTeamRow(ROW)).toEqual({
      id: "b2",
      name: "Ana Lima",
      email: "ana@example.com",
      role: "employee",
      monthlyBudgetCents: 5000,
      status: "active",
    });
    expect(parseTeamRow({ ...ROW, monthly_budget_cents: null }).monthlyBudgetCents).toBeNull();
  });

  it("falha com mensagem clara se o banco devolver algo fora do combinado", () => {
    expect(() => parseTeamRow({ ...ROW, monthly_budget_cents: -1 })).toThrow("incompleto");
    expect(() => parseTeamRow({ ...ROW, monthly_budget_cents: "5000" })).toThrow("incompleto");
    expect(() => parseTeamRow({ ...ROW, role: "admin" })).toThrow("Papel");
    expect(() => parseTeamRow({ ...ROW, status: "deleted" })).toThrow("Situação");
  });

  it("mostra o dono primeiro e os funcionários em ordem alfabética, com acento", () => {
    const sorted = sortTeam([
      person({ id: "1", name: "Bruno" }),
      person({ id: "2", name: "Ângela" }),
      person({ id: "3", name: "Marina", role: "owner" }),
      person({ id: "4", name: "Ana" }),
    ]);
    expect(sorted.map((p) => p.name)).toEqual(["Marina", "Ana", "Ângela", "Bruno"]);
  });
});

describe("convites pendentes", () => {
  const NOW = new Date("2026-10-24T18:00:00.000Z");

  it("lê o convite e diz se ele já venceu", () => {
    const row = { member_id: "b2", kind: "invite", expires_at: "2026-10-25T17:30:00+00:00" };
    expect(parseInviteRow(row, NOW)).toEqual({
      memberId: "b2",
      invite: { kind: "invite", expiresAt: "2026-10-25T17:30:00.000Z", expired: false },
    });
    expect(parseInviteRow({ ...row, expires_at: "2026-10-24T18:00:00Z" }, NOW).invite.expired).toBe(true);
  });

  it("falha com mensagem clara se o convite vier fora do combinado", () => {
    expect(() => parseInviteRow({ member_id: "b2", kind: "admin", expires_at: NOW.toISOString() }, NOW)).toThrow("Tipo");
    expect(() => parseInviteRow({ member_id: "b2", kind: "invite", expires_at: "ontem" }, NOW)).toThrow("incompleto");
  });

  it("junta cada convite à pessoa dele na lista da equipe", async () => {
    const tables: Record<string, unknown[]> = {
      members: [ROW, { ...ROW, id: "b1", name: "Marina", role: "owner", monthly_budget_cents: null }],
      member_invites: [{ member_id: "b2", kind: "invite", expires_at: "2026-10-25T17:30:00Z" }],
    };
    const supabase = {
      from: (table: string) => ({ select: async () => ({ data: tables[table], error: null }) }),
    } as unknown as SupabaseClient;

    const team = await listTeam(supabase, NOW);
    expect(team.map((p) => [p.name, p.invite?.kind ?? null])).toEqual([
      ["Marina", null],
      ["Ana Lima", "invite"],
    ]);
  });

  it("mostra o prazo no horário de Brasília", () => {
    expect(deadlineText("2026-10-25T17:30:00Z")).toBe("25/10, às 14:30");
    // Virada do dia: 01:30 em Greenwich ainda é a noite anterior em Brasília.
    expect(deadlineText("2026-10-26T01:30:00Z")).toBe("25/10, às 22:30");
  });
});

describe("mudar um funcionário", () => {
  function fakeUpdate(rows: unknown[]) {
    const calls: unknown[] = [];
    const supabase = {
      from: (table: string) => ({
        update: (change: unknown) => ({
          eq: (column: string, value: string) => ({
            select: async () => {
              calls.push({ table, change, column, value });
              return { data: rows, error: null };
            },
          }),
        }),
      }),
    } as unknown as SupabaseClient;
    return { supabase, calls };
  }

  it("muda o teto do funcionário escolhido", async () => {
    const { supabase, calls } = fakeUpdate([{ id: "b2" }]);
    expect(await updateEmployee(supabase, "b2", { monthly_budget_cents: 8000 })).toBe(true);
    expect(calls).toEqual([{ table: "members", change: { monthly_budget_cents: 8000 }, column: "id", value: "b2" }]);
  });

  it("avisa quando o banco não deixou mudar nada (pessoa de outra empresa ou o próprio dono)", async () => {
    const { supabase } = fakeUpdate([]);
    expect(await updateEmployee(supabase, "b9", { status: "disabled" })).toBe(false);
  });
});

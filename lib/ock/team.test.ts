import { describe, expect, it } from "vitest";
import { parseTeamRow, sortTeam, type TeamMember } from "./team";

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

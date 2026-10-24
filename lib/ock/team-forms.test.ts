import { describe, expect, it } from "vitest";
import { budgetInputValue, parseBudget, parseInviteForm, parseMemberId } from "./team-forms";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("teto do mês digitado em reais", () => {
  it("vazio quer dizer sem teto", () => {
    expect(parseBudget("")).toEqual({ ok: true, cents: null });
    expect(parseBudget("   ")).toEqual({ ok: true, cents: null });
    expect(parseBudget("R$ ")).toEqual({ ok: true, cents: null });
  });

  it("entende o jeito brasileiro de escrever dinheiro", () => {
    expect(parseBudget("50")).toEqual({ ok: true, cents: 5000 });
    expect(parseBudget("50,5")).toEqual({ ok: true, cents: 5050 });
    expect(parseBudget("50,05")).toEqual({ ok: true, cents: 5005 });
    expect(parseBudget("R$ 1.234,56")).toEqual({ ok: true, cents: 123456 });
    expect(parseBudget("1.234")).toEqual({ ok: true, cents: 123400 });
    expect(parseBudget("0")).toEqual({ ok: true, cents: 0 });
  });

  it("aceita ponto no lugar da vírgula quando só pode ser centavo", () => {
    expect(parseBudget("50.5")).toEqual({ ok: true, cents: 5050 });
    expect(parseBudget("19.90")).toEqual({ ok: true, cents: 1990 });
  });

  it("recusa o que não é um valor em reais", () => {
    const message = "Use só números, como 50 ou 50,00.";
    for (const raw of ["abc", "-5", "50,555", "1,234.56", "12.34.5", "5e3", "50,"]) {
      expect(parseBudget(raw)).toEqual({ ok: false, message });
    }
  });

  it("recusa teto acima de R$ 100.000,00 por mês", () => {
    expect(parseBudget("100.000,00")).toEqual({ ok: true, cents: 10_000_000 });
    expect(parseBudget("100.000,01")).toEqual({ ok: false, message: "O teto mais alto é R$ 100.000,00 por mês." });
  });

  it("volta para o campo de edição do jeito brasileiro", () => {
    expect(budgetInputValue(null)).toBe("");
    expect(budgetInputValue(5000)).toBe("50,00");
    expect(budgetInputValue(123456)).toBe("1.234,56");
    expect(parseBudget(budgetInputValue(123456))).toEqual({ ok: true, cents: 123456 });
  });
});

describe("conferência do convite de funcionário", () => {
  it("aceita nome, e-mail e teto, arrumando espaços e maiúsculas", () => {
    expect(parseInviteForm(form({ name: "  Ana   Lima ", email: " Ana@Example.com ", budget: "50,00" }))).toEqual({
      ok: true,
      values: { name: "Ana Lima", email: "ana@example.com", budgetCents: 5000 },
    });
    expect(parseInviteForm(form({ name: "Ana", email: "ana@example.com", budget: "" }))).toEqual({
      ok: true,
      values: { name: "Ana", email: "ana@example.com", budgetCents: null },
    });
  });

  it("aponta cada campo com problema e devolve o que foi digitado", () => {
    expect(parseInviteForm(form({ name: "", email: "ana@", budget: "cinquenta" }))).toEqual({
      ok: false,
      errors: {
        name: "Preencha o nome da pessoa.",
        email: "Confira o e-mail: ele parece incompleto.",
        budget: "Use só números, como 50 ou 50,00.",
      },
      values: { name: "", email: "ana@", budget: "cinquenta" },
    });
  });

  it("trata campo que nem veio como campo vazio", () => {
    const result = parseInviteForm(new FormData());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["email", "name"]);
  });
});

describe("id da pessoa vindo do formulário", () => {
  it("só passa com o formato de um id do banco", () => {
    expect(parseMemberId(form({ memberId: "B0000000-0000-4000-8000-000000000002" }))).toBe(
      "b0000000-0000-4000-8000-000000000002",
    );
    expect(parseMemberId(form({ memberId: "1; drop table members" }))).toBeNull();
    expect(parseMemberId(new FormData())).toBeNull();
  });
});

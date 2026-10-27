import { describe, expect, it } from "vitest";
import type { CurrentMember } from "@/lib/auth/member";
import {
  budgetInputValue,
  checkPageOwner,
  parseBudget,
  parseInviteForm,
  parseMemberId,
  parseTopupAmount,
} from "./team-forms";

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

  it("lê também outro campo, como o do dono que abriu o painel", () => {
    const data = form({ memberId: "1", pageOwnerId: "A0000000-0000-4000-8000-000000000001" });
    expect(parseMemberId(data, "pageOwnerId")).toBe("a0000000-0000-4000-8000-000000000001");
  });
});

describe("o dono que abriu o painel ainda é quem está conectado", () => {
  const OWNER_ID = "a0000000-0000-4000-8000-000000000001";
  const owner: CurrentMember = {
    id: OWNER_ID,
    companyId: "c0000000-0000-4000-8000-000000000001",
    companyName: "Padaria Teste",
    name: "Marina Souza",
    email: "marina@example.com",
    role: "owner",
  };
  const employee: CurrentMember = {
    ...owner,
    id: "b0000000-0000-4000-8000-000000000002",
    name: "Leandro Lima",
    email: "leandro@example.com",
    role: "employee",
  };

  it("passa quando é o mesmo dono", () => {
    expect(checkPageOwner({ status: "member", member: owner }, OWNER_ID)).toEqual({ ok: true, me: owner });
  });

  it("outra aba entrou como o funcionário: nada muda e o aviso diz quem está conectado", () => {
    const result = checkPageOwner({ status: "member", member: employee }, OWNER_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Nada foi mudado");
      expect(result.message).toContain("Leandro Lima");
    }
  });

  it("outro dono no mesmo navegador também é recusado (o convite iria para a empresa dele)", () => {
    const otherOwner: CurrentMember = { ...owner, id: "d0000000-0000-4000-8000-000000000004", name: "Paulo Dias" };
    const result = checkPageOwner({ status: "member", member: otherOwner }, OWNER_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("Paulo Dias");
  });

  it("ninguém conectado, ou uma conta desativada ou sem empresa: aviso de que a conta de dono saiu", () => {
    for (const viewer of [{ status: "signed-out" }, { status: "disabled" }, { status: "no-company" }] as const) {
      const result = checkPageOwner(viewer, OWNER_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toContain("não está mais conectada");
    }
  });

  it("sem o id do dono no formulário, recusa", () => {
    expect(checkPageOwner({ status: "member", member: owner }, null).ok).toBe(false);
  });
});

describe("valor da recarga de teste (raio-x)", () => {
  it("entende o jeito brasileiro de escrever dinheiro", () => {
    expect(parseTopupAmount("100")).toEqual({ ok: true, cents: 10000 });
    expect(parseTopupAmount("R$ 1.000")).toEqual({ ok: true, cents: 100000 });
    expect(parseTopupAmount("50,50")).toEqual({ ok: true, cents: 5050 });
    expect(parseTopupAmount("19.90")).toEqual({ ok: true, cents: 1990 });
  });

  it("recusa vazio, zero e o que não é número", () => {
    expect(parseTopupAmount("").ok).toBe(false);
    expect(parseTopupAmount("0").ok).toBe(false);
    expect(parseTopupAmount("abc").ok).toBe(false);
  });

  it("aceita o máximo de teste e recusa acima dele (R$ 1.000.000,00)", () => {
    expect(parseTopupAmount("1.000.000")).toEqual({ ok: true, cents: 100000000 });
    expect(parseTopupAmount("1.000.000,01").ok).toBe(false);
  });
});

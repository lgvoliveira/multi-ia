import { describe, expect, it } from "vitest";
import { parseSignIn, parseSignUp } from "./forms";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const VALID = {
  companyName: "Agência Exemplo",
  ownerName: "Marina Souza",
  email: "marina@example.com",
  password: "senha-boa-123",
};

describe("conferência do cadastro da empresa", () => {
  it("aceita um cadastro completo", () => {
    expect(parseSignUp(form(VALID))).toEqual({ ok: true, values: VALID });
  });

  it("arruma espaços nos nomes e deixa o e-mail em minúsculas, mas não mexe na senha", () => {
    const result = parseSignUp(
      form({
        companyName: "  Agência   Exemplo ",
        ownerName: " Marina\tSouza ",
        email: "  Marina@Example.COM ",
        password: " com espaço ",
      }),
    );
    expect(result).toEqual({
      ok: true,
      values: {
        companyName: "Agência Exemplo",
        ownerName: "Marina Souza",
        email: "marina@example.com",
        password: " com espaço ",
      },
    });
  });

  it("aponta cada campo com problema e devolve o que foi digitado, sem a senha", () => {
    const result = parseSignUp(form({ companyName: " ", ownerName: "", email: "marina@", password: "curta" }));
    expect(result).toEqual({
      ok: false,
      errors: {
        companyName: "Preencha o nome da empresa.",
        ownerName: "Preencha o seu nome.",
        email: "Confira o e-mail: ele parece incompleto.",
        password: "A senha precisa de pelo menos 8 caracteres.",
      },
      values: { companyName: "", ownerName: "", email: "marina@" },
    });
  });

  it("trata campo que nem veio como campo vazio", () => {
    const result = parseSignUp(new FormData());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["companyName", "email", "ownerName", "password"]);
  });

  it("recusa nomes acima do limite do banco (120 caracteres)", () => {
    const result = parseSignUp(form({ ...VALID, companyName: "a".repeat(121) }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toEqual({ companyName: "Use até 120 caracteres." });
    expect(parseSignUp(form({ ...VALID, companyName: "a".repeat(120) })).ok).toBe(true);
  });

  it("recusa senha acima de 72 bytes, que o Supabase cortaria sem avisar", () => {
    // "ç" ocupa 2 bytes: 37 dele dão 74 bytes em só 37 caracteres.
    const result = parseSignUp(form({ ...VALID, password: "ç".repeat(37) }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toEqual({ password: "A senha é longa demais." });
    expect(parseSignUp(form({ ...VALID, password: "a".repeat(72) })).ok).toBe(true);
  });
});

describe("conferência da entrada", () => {
  it("aceita e-mail e senha, com o e-mail em minúsculas", () => {
    expect(parseSignIn(form({ email: " Ana@Example.com", password: "x" }))).toEqual({
      ok: true,
      values: { email: "ana@example.com", password: "x" },
    });
  });

  it("pede o que faltou e devolve o e-mail digitado", () => {
    expect(parseSignIn(form({ email: "ana@example.com", password: "" }))).toEqual({
      ok: false,
      errors: { password: "Preencha a senha." },
      values: { email: "ana@example.com" },
    });
    expect(parseSignIn(new FormData())).toEqual({
      ok: false,
      errors: { email: "Preencha o e-mail.", password: "Preencha a senha." },
      values: { email: "" },
    });
  });
});

import { describe, expect, it } from "vitest";
import type { CurrentMember } from "./member";
import { checkPageMember } from "./page-member";

const ANA: CurrentMember = {
  id: "11111111-1111-4111-8111-111111111111",
  companyId: "c0000000-0000-4000-8000-000000000000",
  companyName: "Doce Encanto",
  name: "Ana Lima",
  email: "ana@example.com",
  role: "employee",
  mustChangePassword: false,
};
const BRUNO: CurrentMember = { ...ANA, id: "22222222-2222-4222-8222-222222222222", name: "Bruno Teste" };

describe("quem pede ainda é quem abriu a página (F34)", () => {
  it("passa quando o login é o mesmo", () => {
    expect(checkPageMember({ status: "member", member: ANA }, ANA.id)).toEqual({ ok: true, me: ANA });
  });

  it("com outra conta conectada, recusa e diz quem está conectado agora", () => {
    const check = checkPageMember({ status: "member", member: BRUNO }, ANA.id);
    expect(check).toMatchObject({ ok: false, status: 409 });
    expect(!check.ok && check.message).toContain("quem está conectado agora é Bruno Teste");
  });

  it("sem o id de quem abriu a página (ou num formato estranho), também recusa", () => {
    expect(checkPageMember({ status: "member", member: ANA }, undefined)).toMatchObject({ ok: false, status: 409 });
    expect(checkPageMember({ status: "member", member: ANA }, 42)).toMatchObject({ ok: false, status: 409 });
  });

  it("sem ninguém conectado, recusa com 401; desativado ou sem empresa, com 403", () => {
    const signedOut = checkPageMember({ status: "signed-out" }, ANA.id);
    expect(signedOut).toMatchObject({ ok: false, status: 401 });
    expect(!signedOut.ok && signedOut.message).toContain("não está mais conectada");
    expect(checkPageMember({ status: "disabled" }, ANA.id)).toMatchObject({ ok: false, status: 403 });
    expect(checkPageMember({ status: "no-company" }, ANA.id)).toMatchObject({ ok: false, status: 403 });
  });
});

import { describe, expect, it } from "vitest";
import { firstName, homePathFor, parseMemberRow } from "./member";

const ROW = {
  id: "b0000000-0000-4000-8000-000000000001",
  company_id: "c0000000-0000-4000-8000-000000000001",
  name: "Marina Souza",
  email: "marina@example.com",
  role: "owner",
  companies: { name: "Agência Exemplo" },
};

const MEMBER = {
  id: ROW.id,
  companyId: ROW.company_id,
  companyName: "Agência Exemplo",
  name: "Marina Souza",
  email: "marina@example.com",
  role: "owner",
  mustChangePassword: false,
};

describe("quem está logado", () => {
  it("lê o cadastro com a empresa junto, venha ela como objeto ou como lista de um item", () => {
    expect(parseMemberRow(ROW)).toEqual(MEMBER);
    expect(parseMemberRow({ ...ROW, companies: [{ name: "Agência Exemplo" }] })).toEqual(MEMBER);
  });

  it("falha com mensagem clara se faltar algo ou o papel for desconhecido", () => {
    expect(() => parseMemberRow(null)).toThrow("formato inesperado");
    expect(() => parseMemberRow({ ...ROW, companies: null })).toThrow("incompleto");
    expect(() => parseMemberRow({ ...ROW, name: "" })).toThrow("incompleto");
    expect(() => parseMemberRow({ ...ROW, role: "admin" })).toThrow("Papel");
  });

  it("manda cada papel para a sua página", () => {
    expect(homePathFor("owner")).toBe("/dono");
    expect(homePathFor("employee")).toBe("/trabalho");
  });

  it("cumprimenta pelo primeiro nome", () => {
    expect(firstName("Marina Souza")).toBe("Marina");
    expect(firstName("  Ana  ")).toBe("Ana");
  });
});

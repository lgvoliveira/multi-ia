import { describe, expect, it } from "vitest";
import { hashInviteToken, invitePath, looksLikeInviteToken, newInviteToken } from "./invite-token";

describe("código do convite", () => {
  it("é longo, só com caracteres que cabem num link, e nunca se repete", () => {
    const tokens = new Set(Array.from({ length: 50 }, newInviteToken));
    expect(tokens.size).toBe(50);
    for (const token of tokens) expect(looksLikeInviteToken(token)).toBe(true);
  });

  it("recusa link cortado, com sobra ou com caracteres estranhos", () => {
    const token = newInviteToken();
    expect(looksLikeInviteToken(token.slice(0, -1))).toBe(false);
    expect(looksLikeInviteToken(`${token}a`)).toBe(false);
    expect(looksLikeInviteToken(`${token.slice(0, -1)}/`)).toBe(false);
    expect(looksLikeInviteToken("")).toBe(false);
  });

  it("guarda no banco só o resumo sha256, sempre o mesmo para o mesmo código", () => {
    // Valor de referência do sha256 de "abc".
    expect(hashInviteToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    const token = newInviteToken();
    expect(hashInviteToken(token)).toBe(hashInviteToken(token));
    expect(hashInviteToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("monta o endereço do convite no nosso site", () => {
    expect(invitePath("abc")).toBe("/convite/abc");
  });
});

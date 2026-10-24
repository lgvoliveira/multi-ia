import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { INTERNAL_SECRET_HEADER, internalRunSecret, isInternalCall } from "./internal-secret";

function request(secret?: string): Request {
  const headers: Record<string, string> = secret === undefined ? {} : { [INTERNAL_SECRET_HEADER]: secret };
  return new Request("http://localhost/api/runs/run-1/continue", { method: "POST", headers });
}

beforeEach(() => {
  process.env.SUPABASE_SECRET_KEY = "sb_secret_de_teste";
});

afterEach(() => {
  delete process.env.SUPABASE_SECRET_KEY;
});

describe("segredo da chamada interna", () => {
  it("é tirado da chave secreta do Supabase, sem mostrá-la", () => {
    const secret = internalRunSecret();
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
    expect(secret).not.toContain("sb_secret_de_teste");
    // Sempre o mesmo para a mesma chave; outro para outra chave.
    expect(internalRunSecret()).toBe(secret);
    process.env.SUPABASE_SECRET_KEY = "sb_secret_outra";
    expect(internalRunSecret()).not.toBe(secret);
  });

  it("aceita só o pedido com o segredo certo", () => {
    expect(isInternalCall(request(internalRunSecret()!))).toBe(true);
    expect(isInternalCall(request("errado"))).toBe(false);
    expect(isInternalCall(request(""))).toBe(false);
    expect(isInternalCall(request())).toBe(false);
  });

  it("sem a chave secreta do Supabase, recusa tudo", () => {
    const secret = internalRunSecret()!;
    delete process.env.SUPABASE_SECRET_KEY;
    expect(internalRunSecret()).toBeNull();
    expect(isInternalCall(request(secret))).toBe(false);
  });
});

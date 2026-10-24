import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INTERNAL_SECRET_HEADER, internalRunSecret } from "./internal-secret";
import { resolveSelfOrigin, triggerContinue } from "./trigger";

const ENV_NAMES = ["VERCEL_URL", "NEXT_PUBLIC_BASE_URL", "NEXT_PUBLIC_SITE_URL", "PORT"] as const;
const saved: Partial<Record<(typeof ENV_NAMES)[number], string>> = {};

beforeEach(() => {
  for (const name of ENV_NAMES) {
    saved[name] = process.env[name];
    delete process.env[name];
  }
  process.env.SUPABASE_SECRET_KEY = "sb_secret_de_teste";
});

afterEach(() => {
  for (const name of ENV_NAMES) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
  delete process.env.SUPABASE_SECRET_KEY;
  vi.unstubAllGlobals();
});

describe("endereço da chamada interna (F39)", () => {
  it("vem só da configuração: Vercel, endereço configurado ou o próprio computador", () => {
    expect(resolveSelfOrigin()).toBe("http://localhost:3000");
    process.env.PORT = "3001";
    expect(resolveSelfOrigin()).toBe("http://localhost:3001");
    process.env.NEXT_PUBLIC_SITE_URL = "https://ock.example.com/";
    expect(resolveSelfOrigin()).toBe("https://ock.example.com");
    process.env.VERCEL_URL = "multi-ia-abc.vercel.app";
    expect(resolveSelfOrigin()).toBe("https://multi-ia-abc.vercel.app");
  });

  it("dispara a continuação no próprio site, com o segredo interno no cabeçalho", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    triggerContinue("run-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:3000/api/runs/run-1/continue");
    expect((init.headers as Record<string, string>)[INTERNAL_SECRET_HEADER]).toBe(internalRunSecret());
  });
});

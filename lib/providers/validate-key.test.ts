import { afterEach, describe, expect, it, vi } from "vitest";
import { validateApiKey } from "./validate-key";

afterEach(() => {
  vi.restoreAllMocks();
});

/** Finge a resposta da empresa com um status HTTP. */
function stubFetch(status: number) {
  const fetchMock = vi.fn(async () => new Response(null, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("validateApiKey", () => {
  it("aceita a chave quando a empresa responde ok (200)", async () => {
    stubFetch(200);
    expect(await validateApiKey("claude", "sk-ant-uma-chave-de-teste")).toEqual({ ok: true });
  });

  it("recusa a chave quando a empresa responde não autorizado (401)", async () => {
    stubFetch(401);
    expect(await validateApiKey("gpt", "sk-uma-chave-errada")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("trata 403 (chave de outra IA ou sem permissão) como inválida", async () => {
    stubFetch(403);
    expect(await validateApiKey("gemini", "uma-chave-qualquer")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("marca como ocupado quando a empresa pede para tentar depois (429)", async () => {
    stubFetch(429);
    expect(await validateApiKey("claude", "sk-ant-uma-chave-de-teste")).toEqual({
      ok: false,
      reason: "rate-limited",
    });
  });

  it("não aceita chave curta demais sem nem perguntar à empresa", async () => {
    const fetchMock = stubFetch(200);
    expect(await validateApiKey("gpt", "curta")).toEqual({ ok: false, reason: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trata falha de rede como 'tente de novo'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("sem internet");
      }),
    );
    expect(await validateApiKey("gemini", "uma-chave-qualquer")).toEqual({
      ok: false,
      reason: "network",
    });
  });

  it("manda a chave no cabeçalho, nunca no endereço", async () => {
    const fetchMock = stubFetch(200);
    await validateApiKey("gemini", "minha-chave-secreta-123");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain("minha-chave-secreta-123");
    expect(JSON.stringify(init.headers)).toContain("minha-chave-secreta-123");
  });
});

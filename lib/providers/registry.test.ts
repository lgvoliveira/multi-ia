import { afterEach, describe, expect, it, vi } from "vitest";
import { createGetProvider, getImageGenerator, getProvider, getSimulatedProvider, getTranscriber } from "./registry";
import { ProviderError, type GenerateChunk, type GenerateRequest } from "./types";

const request: GenerateRequest = {
  systemPrompt: "Você é o chefe do time.",
  input: "Quero um site para minha confeitaria.",
  maxOutputTokens: 100,
  sampleResponse: "Plano pronto.",
};

async function collect(chunks: AsyncIterable<GenerateChunk>): Promise<GenerateChunk[]> {
  const result: GenerateChunk[] = [];
  for await (const chunk of chunks) result.push(chunk);
  return result;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("entrega das IAs simuladas", () => {
  it("sem o interruptor de teste, a IA simulada responde normalmente", async () => {
    vi.stubEnv("MOCK_AI_FAILURES", "");

    const chunks = await collect(getSimulatedProvider("gpt").generate(request));

    expect(chunks.at(-1)).toMatchObject({ type: "done", model: "mock-gpt" });
  });

  it("com o interruptor ligado, só as IAs da lista falham", async () => {
    vi.stubEnv("MOCK_AI_FAILURES", "gpt");

    await expect(collect(getSimulatedProvider("gpt").generate(request))).rejects.toBeInstanceOf(ProviderError);
    expect((await collect(getSimulatedProvider("claude").generate(request))).at(-1)).toMatchObject({ type: "done" });
  });

  it("com um número, a IA falha nessa quantidade de tentativas em cada etapa", async () => {
    vi.stubEnv("MOCK_AI_FAILURES", "gpt:1");

    // O motor pede a IA uma vez por etapa e usa a mesma nas novas tentativas.
    const firstStep = getSimulatedProvider("gpt");
    await expect(collect(firstStep.generate(request))).rejects.toBeInstanceOf(ProviderError);
    expect((await collect(firstStep.generate(request))).at(-1)).toMatchObject({ type: "done" });

    const nextStep = getSimulatedProvider("gpt");
    await expect(collect(nextStep.generate(request))).rejects.toBeInstanceOf(ProviderError);
  });
});

describe("a IA da plataforma, conforme OCK_AI_MODE (F42)", () => {
  it("simulada: responde a IA simulada, mesmo com a chave configurada", async () => {
    vi.stubEnv("OCK_AI_MODE", "simulada");
    vi.stubEnv("OCK_CLAUDE_KEY", "chave-de-teste");

    const chunks = await collect(getProvider("claude").generate(request));

    expect(chunks.at(-1)).toMatchObject({ type: "done", model: "mock-claude" });
  });

  it("real sem a chave: falha com um erro que não adianta repetir, dizendo qual variável falta (nunca cai na simulada)", async () => {
    vi.stubEnv("OCK_AI_MODE", "real");
    vi.stubEnv("OCK_GPT_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const failure = await collect(getProvider("gpt").generate(request)).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ProviderError);
    expect(failure).toMatchObject({ retryable: false });
    expect((failure as Error).message).toContain("OCK_GPT_KEY");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("real com a chave: chama a API da empresa com o modelo de verdade", async () => {
    vi.stubEnv("OCK_AI_MODE", "real");
    vi.stubEnv("OCK_CLAUDE_KEY", "chave-de-teste");
    const fetchSpy = vi.fn(async () => new Response("sem crédito", { status: 400 }));
    vi.stubGlobal("fetch", fetchSpy);

    await expect(collect(getProvider("claude").generate(request))).rejects.toBeInstanceOf(ProviderError);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(JSON.parse(String(init.body))).toMatchObject({ model: "claude-sonnet-5-5" });
  });

  it("a chave só com espaços conta como faltando", async () => {
    const failure = await collect(createGetProvider({ gemini: "   " })("gemini").generate(request)).catch(
      (error: unknown) => error,
    );
    expect((failure as Error).message).toContain("OCK_GEMINI_KEY");
  });
});

describe("quem cria as imagens, conforme OCK_AI_MODE", () => {
  it("simulada: o quadriculado da simulada", async () => {
    vi.stubEnv("OCK_AI_MODE", "simulada");
    expect((await getImageGenerator().generate("Um logo")).model).toBe("mock-gpt-image");
  });

  it("real sem a chave do GPT: falha sem chamar ninguém, dizendo qual variável falta", async () => {
    vi.stubEnv("OCK_AI_MODE", "real");
    vi.stubEnv("OCK_GPT_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const error = await getImageGenerator().generate("Um logo").catch((caught: unknown) => caught);
    expect(error).toMatchObject({ retryable: false });
    expect((error as Error).message).toContain("OCK_GPT_KEY");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("quem transcreve a voz, conforme OCK_AI_MODE", () => {
  it("simulada: a transcrição simulada", async () => {
    vi.stubEnv("OCK_AI_MODE", "simulada");
    expect((await getTranscriber().transcribe(new Blob(["x"]), "ditado.webm")).model).toBe("mock-gpt-transcribe");
  });

  it("real sem a chave do GPT: falha sem chamar ninguém", async () => {
    vi.stubEnv("OCK_AI_MODE", "real");
    vi.stubEnv("OCK_GPT_KEY", "");
    const error = await getTranscriber()
      .transcribe(new Blob(["x"]), "ditado.webm")
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ retryable: false });
    expect((error as Error).message).toContain("OCK_GPT_KEY");
  });
});

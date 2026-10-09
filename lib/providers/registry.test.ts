import { afterEach, describe, expect, it, vi } from "vitest";
import { getProvider } from "./registry";
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

describe("entrega das IAs", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sem o interruptor de teste, a IA simulada responde normalmente", async () => {
    vi.stubEnv("MOCK_AI_FAILURES", "");

    const chunks = await collect(getProvider("gpt").generate(request));

    expect(chunks.at(-1)).toMatchObject({ type: "done", model: "mock-gpt" });
  });

  it("com o interruptor ligado, só as IAs da lista falham", async () => {
    vi.stubEnv("MOCK_AI_FAILURES", "gpt");

    await expect(collect(getProvider("gpt").generate(request))).rejects.toBeInstanceOf(ProviderError);
    expect((await collect(getProvider("claude").generate(request))).at(-1)).toMatchObject({ type: "done" });
  });

  it("com um número, a IA falha nessa quantidade de tentativas em cada etapa", async () => {
    vi.stubEnv("MOCK_AI_FAILURES", "gpt:1");

    // O motor pede a IA uma vez por etapa e usa a mesma nas novas tentativas.
    const firstStep = getProvider("gpt");
    await expect(collect(firstStep.generate(request))).rejects.toBeInstanceOf(ProviderError);
    expect((await collect(firstStep.generate(request))).at(-1)).toMatchObject({ type: "done" });

    const nextStep = getProvider("gpt");
    await expect(collect(nextStep.generate(request))).rejects.toBeInstanceOf(ProviderError);
  });
});

import { describe, expect, it } from "vitest";
import type { AiCallReport } from "@/lib/engine/types";
import { createMockProvider } from "@/lib/providers/mock";
import { ProviderError, type AiProvider, type GenerateRequest } from "@/lib/providers/types";
import { callAi } from "./ai-call";

const REQUEST: GenerateRequest = { systemPrompt: "Você ajuda.", input: "Oi", maxOutputTokens: 200, tier: "economico" };

function collect() {
  const reports: AiCallReport[] = [];
  const waits: number[] = [];
  return {
    reports,
    waits,
    options: {
      stepId: "answer",
      onCall: (report: AiCallReport) => reports.push(report),
      wait: async (ms: number) => void waits.push(ms),
    },
  };
}

describe("chamar uma IA no chat", () => {
  it("junta a resposta inteira e avisa a chamada, com o consumo e o modelo", async () => {
    const { reports, options } = collect();
    const answer = await callAi(createMockProvider({ id: "claude", chunkDelayMs: 0 }), REQUEST, options);
    expect(answer.text).toContain("resposta simulada");
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ stepId: "answer", provider: "claude", model: "mock-claude", tier: "economico", ok: true, attempt: 1 });
    expect(reports[0].usage).toEqual(answer.usage);
  });

  it("erro passageiro: tenta de novo depois de 1 s e de 2 s, e cada tentativa fica registrada", async () => {
    const { reports, waits, options } = collect();
    const provider = createMockProvider({ id: "gpt", chunkDelayMs: 0, failFirstCalls: 2, failAfterChunks: 3 });
    const answer = await callAi(provider, REQUEST, options);
    expect(answer.text).toContain("resposta simulada");
    expect(waits).toEqual([1000, 2000]);
    expect(reports.map((report) => [report.attempt, report.ok])).toEqual([
      [1, false],
      [2, false],
      [3, true],
    ]);
    // A tentativa que caiu conta pelo que foi enviado e pelo que a IA chegou a escrever.
    expect(reports[0].usage.outputTokens).toBeGreaterThan(0);
    expect(reports[0].errorMessage).toBeTruthy();
  });

  it("depois da 3ª falha, repassa o erro", async () => {
    const { reports, options } = collect();
    const provider = createMockProvider({ id: "gpt", chunkDelayMs: 0, failFirstCalls: Infinity });
    await expect(callAi(provider, REQUEST, options)).rejects.toBeInstanceOf(ProviderError);
    expect(reports).toHaveLength(3);
  });

  it("sem novas tentativas (o Chefe), para na primeira falha", async () => {
    const { reports, waits, options } = collect();
    const provider = createMockProvider({ id: "gpt", chunkDelayMs: 0, failFirstCalls: Infinity });
    await expect(callAi(provider, REQUEST, { ...options, retryDelaysMs: [] })).rejects.toBeInstanceOf(ProviderError);
    expect(reports).toHaveLength(1);
    expect(waits).toEqual([]);
  });

  it("erro que não adianta repetir, ou defeito no nosso código, para na hora", async () => {
    for (const error of [new ProviderError("recusou", { retryable: false }), new Error("defeito")]) {
      const { reports, options } = collect();
      const provider: AiProvider = {
        id: "claude",
        async *generate() {
          throw error;
        },
      };
      await expect(callAi(provider, REQUEST, options)).rejects.toBe(error);
      expect(reports).toHaveLength(1);
      expect(reports[0]).toMatchObject({ ok: false, errorMessage: error.message });
    }
  });

  it("a IA que para de mandar pedaços sem terminar conta como erro passageiro", async () => {
    const { reports, options } = collect();
    const provider: AiProvider = {
      id: "gemini",
      async *generate() {
        yield { type: "text", text: "pela metade" };
      },
    };
    await expect(callAi(provider, REQUEST, options)).rejects.toThrow("parou de responder");
    expect(reports).toHaveLength(3);
  });
});

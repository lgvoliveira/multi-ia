import { describe, expect, it } from "vitest";
import {
  createMockProvider,
  estimateTokens,
  MOCK_SOURCE,
  OVERSPEND_FACTOR,
  parseMockFailures,
  parseMockOverspend,
  splitIntoChunks,
} from "./mock";
import { ProviderError, type GenerateChunk, type GenerateRequest } from "./types";

const baseRequest: GenerateRequest = {
  systemPrompt: "Você é o chefe do time.",
  input: "Quero um site para minha confeitaria.",
  maxOutputTokens: 1000,
};

async function collect(chunks: AsyncIterable<GenerateChunk>): Promise<GenerateChunk[]> {
  const result: GenerateChunk[] = [];
  for await (const chunk of chunks) result.push(chunk);
  return result;
}

function textOf(chunks: GenerateChunk[]): string {
  return chunks.map((chunk) => (chunk.type === "text" ? chunk.text : "")).join("");
}

describe("IA simulada", () => {
  it("devolve a resposta de exemplo em vários pedaços que, juntos, formam o texto completo", async () => {
    const provider = createMockProvider({ id: "claude", chunkDelayMs: 0 });
    const sampleResponse = "Plano do site:\n- Topo com nome\n- Cardápio com preços\n- Botão do WhatsApp";

    const chunks = await collect(provider.generate({ ...baseRequest, sampleResponse }));

    const textChunks = chunks.filter((chunk) => chunk.type === "text");
    expect(textChunks.length).toBeGreaterThan(1);
    expect(textOf(chunks)).toBe(sampleResponse);
  });

  it("termina com um 'done' informando consumo, modelo e que a resposta não foi cortada", async () => {
    const provider = createMockProvider({ id: "gpt", chunkDelayMs: 0 });
    const sampleResponse = "Resposta curta.";

    const chunks = await collect(provider.generate({ ...baseRequest, sampleResponse }));

    expect(chunks.at(-1)).toEqual({
      type: "done",
      usage: {
        inputTokens: estimateTokens(baseRequest.systemPrompt + baseRequest.input),
        outputTokens: estimateTokens(sampleResponse),
      },
      model: "mock-gpt",
      truncated: false,
    });
  });

  it("sem resposta de exemplo, devolve uma resposta genérica", async () => {
    const provider = createMockProvider({ id: "gemini", chunkDelayMs: 0 });

    const chunks = await collect(provider.generate(baseRequest));

    expect(textOf(chunks)).toContain("resposta simulada");
  });

  it("corta a resposta no limite de tokens e avisa que cortou", async () => {
    const provider = createMockProvider({ id: "claude", chunkDelayMs: 0 });
    const sampleResponse = "a".repeat(100);

    const chunks = await collect(
      provider.generate({ ...baseRequest, sampleResponse, maxOutputTokens: 5 }),
    );

    expect(textOf(chunks)).toBe("a".repeat(20)); // 5 tokens × 4 caracteres
    expect(chunks.at(-1)).toMatchObject({ type: "done", truncated: true });
  });

  it("falha de propósito nas primeiras chamadas e depois volta a responder", async () => {
    const provider = createMockProvider({ id: "gpt", chunkDelayMs: 0, failFirstCalls: 2 });

    for (let attempt = 1; attempt <= 2; attempt++) {
      const error = await collect(provider.generate(baseRequest)).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ProviderError);
      expect((error as ProviderError).retryable).toBe(true);
      // O modelo vai junto, para o registro interno do custo da falha.
      expect((error as ProviderError).model).toBe("mock-gpt");
    }

    const chunks = await collect(provider.generate(baseRequest));
    expect(chunks.at(-1)).toMatchObject({ type: "done" });
  });

  it("pode cair no meio da resposta, depois de escrever alguns pedaços", async () => {
    const provider = createMockProvider({ id: "gpt", chunkDelayMs: 0, failFirstCalls: 1, failAfterChunks: 2 });
    const sampleResponse = "um dois três quatro cinco seis sete oito nove";
    const received: GenerateChunk[] = [];

    const error = await (async () => {
      for await (const chunk of provider.generate({ ...baseRequest, sampleResponse })) received.push(chunk);
    })().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ProviderError);
    expect(textOf(received)).toBe("um dois três quatro cinco seis ");
    expect(textOf(await collect(provider.generate({ ...baseRequest, sampleResponse })))).toBe(sampleResponse);
  });

  it("recusa limite de resposta menor que 1, sem sugerir nova tentativa", async () => {
    const provider = createMockProvider({ id: "claude", chunkDelayMs: 0 });

    const error = await collect(provider.generate({ ...baseRequest, maxOutputTokens: 0 })).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).retryable).toBe(false);
  });

  it("para de escrever quando o pedido é cancelado", async () => {
    const provider = createMockProvider({ id: "claude", chunkDelayMs: 0 });
    const controller = new AbortController();
    const received: GenerateChunk[] = [];

    const run = (async () => {
      for await (const chunk of provider.generate({
        ...baseRequest,
        sampleResponse: "um dois três quatro cinco seis sete oito nove dez",
        signal: controller.signal,
      })) {
        received.push(chunk);
        controller.abort(); // cancela logo depois do primeiro pedaço
      }
    })();

    await expect(run).rejects.toThrow();
    expect(received).toHaveLength(1);
  });
});

describe("interruptor de teste MOCK_AI_FAILURES", () => {
  it("vazio ou ausente: nenhuma IA falha", () => {
    expect(parseMockFailures(undefined)).toEqual({});
    expect(parseMockFailures("")).toEqual({});
    expect(parseMockFailures("  ")).toEqual({});
  });

  it("só o nome: a IA falha sempre; com número: falha nessa quantidade de chamadas", () => {
    expect(parseMockFailures("gpt")).toEqual({ gpt: Infinity });
    expect(parseMockFailures("gpt:2")).toEqual({ gpt: 2 });
    expect(parseMockFailures(" Gemini , claude:1 ")).toEqual({ gemini: Infinity, claude: 1 });
  });

  it("valor que não dá para entender é erro, com um exemplo do jeito certo", () => {
    expect(() => parseMockFailures("chatgpt")).toThrow('MOCK_AI_FAILURES: não entendi "chatgpt"');
    expect(() => parseMockFailures("gpt:duas")).toThrow('Use, por exemplo, "gpt" ou "gpt:2".');
  });
});

describe("interruptor de teste MOCK_AI_OVERSPEND", () => {
  it("a IA que gasta demais diz ter escrito várias vezes o limite da etapa; o texto não muda", async () => {
    const sampleResponse = "Resposta curta.";
    const normal = await collect(createMockProvider({ id: "claude", chunkDelayMs: 0 }).generate({ ...baseRequest, sampleResponse }));
    const overspent = await collect(
      createMockProvider({ id: "claude", chunkDelayMs: 0, overspend: true }).generate({ ...baseRequest, sampleResponse }),
    );

    expect(textOf(overspent)).toBe(textOf(normal));
    expect(overspent.at(-1)).toMatchObject({
      type: "done",
      usage: { outputTokens: baseRequest.maxOutputTokens * OVERSPEND_FACTOR },
    });
  });

  it("lê os nomes das IAs separados por vírgula; vazio, ninguém gasta demais; valor estranho é erro", () => {
    expect(parseMockOverspend("claude, GPT")).toEqual(new Set(["claude", "gpt"]));
    expect(parseMockOverspend("")).toEqual(new Set());
    expect(parseMockOverspend(undefined)).toEqual(new Set());
    expect(() => parseMockOverspend("claude:2")).toThrow('MOCK_AI_OVERSPEND: não entendi "claude:2"');
  });
});

describe("splitIntoChunks", () => {
  it("agrupa as palavras de 3 em 3, mantendo espaços e quebras de linha", () => {
    expect(splitIntoChunks("um dois três quatro\ncinco")).toEqual(["um dois três ", "quatro\ncinco"]);
  });

  it("não perde nenhum caractere, nem espaços no começo e no fim", () => {
    const text = "  <h1>Olá</h1>\n\n  <p>Bem-vindo</p>  ";
    expect(splitIntoChunks(text).join("")).toBe(text);
  });

  it("texto vazio não gera pedaços", () => {
    expect(splitIntoChunks("")).toEqual([]);
  });
});

describe("IA simulada com as ferramentas ligadas", () => {
  it("finge que pesquisou (uma fonte de exemplo, uma pesquisa no consumo) e que rodou um programa", async () => {
    const provider = createMockProvider({ id: "claude", chunkDelayMs: 0 });
    const searched = (await collect(provider.generate({ ...baseRequest, tools: ["web_search"] }))).at(-1);
    expect(searched).toMatchObject({ sources: [MOCK_SOURCE], usage: { webSearchRequests: 1 } });

    const ran = (await collect(provider.generate({ ...baseRequest, tools: ["code_execution"] }))).at(-1);
    expect(ran).toMatchObject({ codeRuns: 1 });
    expect(ran).not.toHaveProperty("sources");
  });

  it("sem ferramentas, nada disso aparece", async () => {
    const done = (await collect(createMockProvider({ id: "gpt", chunkDelayMs: 0 }).generate(baseRequest))).at(-1);
    expect(done).not.toHaveProperty("sources");
    expect(done).not.toHaveProperty("codeRuns");
  });
});

// Os conectores das IAs de verdade, com respostas gravadas no formato de cada empresa (nenhuma chamada sai para a
// internet e nada é gasto). O formato segue a documentação oficial conferida em 25/10/2026.

import { afterEach, describe, expect, it, vi } from "vitest";
import { maxInputTokens, outputTokenCap } from "./limits";
import { createRealProvider } from "./real";
import { ProviderError, type GenerateChunk, type GenerateRequest, type ProviderId } from "./types";

const KEY = "sk-chave-de-teste-123";

const request: GenerateRequest = {
  systemPrompt: "Você é um assistente.",
  input: "Escreva uma frase.",
  maxOutputTokens: 1000,
  effort: "low",
  tier: "padrao",
};

/** Uma resposta em fluxo (SSE), com uma linha "data:" por evento. */
function sse(events: readonly unknown[]): Response {
  const body = events.map((event) => `data: ${typeof event === "string" ? event : JSON.stringify(event)}\n\n`).join("");
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

/** Uma resposta em fluxo que manda alguns eventos e cai (a conexão fecha com erro). */
function brokenSse(events: readonly unknown[]): Response {
  const encoder = new TextEncoder();
  let sent = false;
  // Entrega os eventos numa leitura e cai na seguinte (um erro descartaria o que ainda estivesse na fila).
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent) {
        controller.error(new Error("socket hang up"));
        return;
      }
      sent = true;
      controller.enqueue(encoder.encode(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")));
    },
  });
  return new Response(stream, { status: 200 });
}

function setup(id: ProviderId, response: Response | (() => Response)) {
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    void url;
    void init;
    return typeof response === "function" ? response() : response;
  });
  const provider = createRealProvider(id, KEY, { fetch: fetchMock as unknown as typeof fetch });
  const sent = () => {
    const [url, init] = fetchMock.mock.calls[0];
    return {
      url: String(url),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: JSON.parse(String(init?.body)),
    };
  };
  return { provider, sent };
}

async function collect(chunks: AsyncIterable<GenerateChunk>): Promise<GenerateChunk[]> {
  const result: GenerateChunk[] = [];
  for await (const chunk of chunks) result.push(chunk);
  return result;
}

async function failure(chunks: AsyncIterable<GenerateChunk>): Promise<ProviderError> {
  const error = await collect(chunks).then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ProviderError);
  return error as ProviderError;
}

function textOf(chunks: GenerateChunk[]): string {
  return chunks.map((chunk) => (chunk.type === "text" ? chunk.text : "")).join("");
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------- Claude ----------

const claudeStart = {
  type: "message_start",
  message: {
    id: "msg_1",
    type: "message",
    usage: { input_tokens: 1200, cache_read_input_tokens: 300, cache_creation_input_tokens: 0, output_tokens: 1 },
  },
};
const claudeThinking = { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "Hmm" } };
const claudeText = (text: string) => ({ type: "content_block_delta", index: 1, delta: { type: "text_delta", text } });
const claudeEnd = (stopReason: string, outputTokens: number) => ({
  type: "message_delta",
  delta: { stop_reason: stopReason },
  usage: { output_tokens: outputTokens },
});

describe("conector do Claude", () => {
  it("pede o modelo do nível, o teto com folga para pensar e o esforço explícito (até o baixo)", async () => {
    const { provider, sent } = setup("claude", sse([claudeStart, claudeText("Oi"), claudeEnd("end_turn", 5), { type: "message_stop" }]));

    await collect(provider.generate(request));

    const { url, headers, body } = sent();
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(headers["x-api-key"]).toBe(KEY);
    expect(body).toMatchObject({
      model: "claude-sonnet-5-5",
      max_tokens: outputTokenCap("claude", 1000, "low"),
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: "Você é um assistente.",
      messages: [{ role: "user", content: "Escreva uma frase." }],
      stream: true,
    });
  });

  it("devolve só o texto da resposta e cobra o consumo informado: a entrada com o cache e a saída com o pensamento", async () => {
    const { provider } = setup(
      "claude",
      sse([claudeStart, claudeThinking, claudeText("Olá, "), claudeText("mundo."), claudeEnd("end_turn", 3456), { type: "message_stop" }]),
    );

    const chunks = await collect(provider.generate(request));

    expect(textOf(chunks)).toBe("Olá, mundo.");
    expect(chunks.at(-1)).toEqual({
      type: "done",
      usage: { inputTokens: 1500, outputTokens: 3456, cachedInputTokens: 300 },
      model: "claude-sonnet-5-5",
      truncated: false,
    });
  });

  it("resposta que bateu no teto vem marcada como cortada", async () => {
    const { provider } = setup("claude", sse([claudeStart, claudeText("Começo"), claudeEnd("max_tokens", 9000), { type: "message_stop" }]));
    expect((await collect(provider.generate(request))).at(-1)).toMatchObject({ type: "done", truncated: true });
  });

  it("recusa: erro que não adianta repetir (a troca de IA entra), com o consumo para o registro interno", async () => {
    const { provider } = setup("claude", sse([claudeStart, claudeText("Não"), claudeEnd("refusal", 40), { type: "message_stop" }]));

    const error = await failure(provider.generate(request));

    expect(error.retryable).toBe(false);
    expect(error.model).toBe("claude-sonnet-5-5");
    expect(error.usage).toEqual({ inputTokens: 1500, outputTokens: 40, cachedInputTokens: 300 });
  });

  it("conexão que cai no meio: vale tentar de novo, e o consumo informado até ali vai junto", async () => {
    const { provider } = setup("claude", brokenSse([claudeStart, claudeText("Meio")]));

    const error = await failure(provider.generate(request));

    expect(error.retryable).toBe(true);
    expect(error.usage).toMatchObject({ inputTokens: 1500 });
  });

  it("resposta que termina sem o aviso de fim: pode estar pela metade, vale tentar de novo", async () => {
    const { provider } = setup("claude", sse([claudeStart, claudeText("Meio da frase")]));
    expect((await failure(provider.generate(request))).retryable).toBe(true);
  });

  it("aviso de erro no meio (IA sobrecarregada): vale tentar de novo", async () => {
    const { provider } = setup(
      "claude",
      sse([claudeStart, { type: "error", error: { type: "overloaded_error", message: "Overloaded" } }]),
    );
    const error = await failure(provider.generate(request));
    expect(error.retryable).toBe(true);
    expect(error.message).toContain("overloaded_error");
  });

  it("sobrecarga (529) e limite de uso (429) valem nova tentativa; chave errada (401) e modelo errado (404), não", async () => {
    for (const [status, retryable] of [
      [529, true],
      [429, true],
      [500, true],
      [401, false],
      [404, false],
      [400, false],
    ] as const) {
      const { provider } = setup("claude", new Response('{"error":{"type":"x"}}', { status }));
      const error = await failure(provider.generate(request));
      expect(error.retryable).toBe(retryable);
      expect(error.message).toContain(String(status));
      // A chave nunca aparece numa mensagem de erro (que vai para o registro do servidor).
      expect(error.message).not.toContain(KEY);
    }
  });

  it("imagens vão antes do texto, em base64", async () => {
    const { provider, sent } = setup("claude", sse([claudeStart, claudeText("Uma foto"), claudeEnd("end_turn", 5), { type: "message_stop" }]));

    await collect(provider.generate({ ...request, images: [{ mime: "image/png", base64: "AAAA" }] }));

    expect(sent().body.messages[0].content).toEqual([
      { type: "image", source: { type: "base64", media_type: "image/png", data: "AAAA" } },
      { type: "text", text: "Escreva uma frase." },
    ]);
  });

  it("cancelamento da pessoa não vira erro da IA (o motor trata)", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn(async () => {
      throw new DOMException("cancelado", "AbortError");
    });
    const provider = createRealProvider("claude", KEY, { fetch: fetchMock as unknown as typeof fetch });

    const error = await collect(provider.generate({ ...request, signal: controller.signal })).catch((caught: unknown) => caught);

    expect(error).not.toBeInstanceOf(ProviderError);
  });
});

// ---------- GPT ----------

const gptText = (content: string) => ({ choices: [{ index: 0, delta: { content }, finish_reason: null }] });
const gptEnd = (reason: string) => ({ choices: [{ index: 0, delta: {}, finish_reason: reason }] });
const gptUsage = {
  choices: [],
  usage: {
    prompt_tokens: 2000,
    completion_tokens: 900,
    prompt_tokens_details: { cached_tokens: 500, cache_write_tokens: 1024 },
    completion_tokens_details: { reasoning_tokens: 600 },
  },
};

describe("conector do GPT", () => {
  it("esforço baixo vira 'low' (os modelos GPT-6 recusam 'minimal') e o consumo é pedido no fim do fluxo", async () => {
    const { provider, sent } = setup("gpt", sse([gptText("Oi"), gptEnd("stop"), gptUsage, "[DONE]"]));

    await collect(provider.generate({ ...request, tier: "economico" }));

    const { url, headers, body } = sent();
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(body).toMatchObject({
      model: "gpt-6-luna",
      max_completion_tokens: outputTokenCap("gpt", 1000, "low"),
      reasoning_effort: "low",
      stream: true,
      stream_options: { include_usage: true },
    });
  });

  it("cobra o consumo informado, com o raciocínio, a entrada do cache e a gravada no cache", async () => {
    const { provider } = setup("gpt", sse([gptText("Olá, "), gptText("mundo."), gptEnd("stop"), gptUsage, "[DONE]"]));

    const chunks = await collect(provider.generate(request));

    expect(textOf(chunks)).toBe("Olá, mundo.");
    expect(chunks.at(-1)).toEqual({
      type: "done",
      usage: { inputTokens: 2000, outputTokens: 900, cachedInputTokens: 500, cacheWriteTokens: 1024 },
      model: "gpt-6.1-sol",
      truncated: false,
    });
  });

  it("resposta cortada pelo teto vem marcada; filtro de conteúdo é recusa (não adianta repetir)", async () => {
    const cut = setup("gpt", sse([gptText("Começo"), gptEnd("length"), gptUsage, "[DONE]"]));
    expect((await collect(cut.provider.generate(request))).at(-1)).toMatchObject({ truncated: true });

    const refused = setup("gpt", sse([gptEnd("content_filter"), gptUsage, "[DONE]"]));
    const error = await failure(refused.provider.generate(request));
    expect(error.retryable).toBe(false);
    expect(error.usage).toMatchObject({ inputTokens: 2000 });
  });

  it("sem o consumo no fim (não deveria acontecer), cobra o máximo da chamada, nunca menos do que a plataforma pagou", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { provider } = setup("gpt", sse([gptText("Oi"), gptEnd("stop"), "[DONE]"]));

    const done = (await collect(provider.generate(request))).at(-1);

    expect(done).toMatchObject({
      usage: {
        inputTokens: maxInputTokens(request.systemPrompt + request.input),
        outputTokens: outputTokenCap("gpt", 1000, "low"),
      },
    });
    expect(warn).toHaveBeenCalledOnce();
  });
});

// ---------- Gemini ----------

const geminiChunk = (parts: unknown[], usage: Record<string, number>, finishReason?: string) => ({
  candidates: [{ content: { role: "model", parts }, ...(finishReason ? { finishReason } : {}) }],
  usageMetadata: usage,
});

describe("conector do Gemini", () => {
  it("pede o nível de pensamento pelo esforço e o teto com folga para pensar", async () => {
    const { provider, sent } = setup(
      "gemini",
      sse([geminiChunk([{ text: "Oi" }], { promptTokenCount: 10, candidatesTokenCount: 1 }, "STOP")]),
    );

    await collect(provider.generate({ ...request, effort: "high", tier: "potente" }));

    const { url, headers, body } = sent();
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-4-argon:streamGenerateContent?alt=sse",
    );
    expect(headers["x-goog-api-key"]).toBe(KEY);
    expect(body.generationConfig).toEqual({
      maxOutputTokens: outputTokenCap("gemini", 1000, "high"),
      thinkingConfig: { thinkingLevel: "high" },
    });
    expect(body.systemInstruction).toEqual({ parts: [{ text: "Você é um assistente." }] });
  });

  it("devolve só o texto (o pensamento fica de fora) e cobra a resposta mais o pensamento", async () => {
    const { provider } = setup(
      "gemini",
      sse([
        geminiChunk([{ text: "pensando...", thought: true }], { promptTokenCount: 800, thoughtsTokenCount: 50 }),
        geminiChunk([{ text: "Olá, " }], { promptTokenCount: 800, candidatesTokenCount: 2, thoughtsTokenCount: 120 }),
        geminiChunk(
          [{ text: "mundo." }],
          { promptTokenCount: 800, toolUsePromptTokenCount: 40, candidatesTokenCount: 5, thoughtsTokenCount: 120, cachedContentTokenCount: 200 },
          "STOP",
        ),
      ]),
    );

    const chunks = await collect(provider.generate(request));

    expect(textOf(chunks)).toBe("Olá, mundo.");
    expect(chunks.at(-1)).toEqual({
      type: "done",
      usage: { inputTokens: 840, outputTokens: 125, cachedInputTokens: 200 },
      model: "gemini-3.8-flash",
      truncated: false,
    });
  });

  it("parada por segurança e pedido bloqueado são recusa; parada pelo teto vem marcada como cortada", async () => {
    const safety = setup("gemini", sse([geminiChunk([], { promptTokenCount: 10 }, "SAFETY")]));
    expect((await failure(safety.provider.generate(request))).retryable).toBe(false);

    const blocked = setup("gemini", sse([{ promptFeedback: { blockReason: "SAFETY" }, usageMetadata: { promptTokenCount: 10 } }]));
    expect((await failure(blocked.provider.generate(request))).retryable).toBe(false);

    const cut = setup("gemini", sse([geminiChunk([{ text: "Começo" }], { promptTokenCount: 10, candidatesTokenCount: 9 }, "MAX_TOKENS")]));
    expect((await collect(cut.provider.generate(request))).at(-1)).toMatchObject({ truncated: true });
  });

  it("resposta vazia (a IA gastou o teto pensando) vale tentar de novo", async () => {
    const { provider } = setup(
      "gemini",
      sse([geminiChunk([{ text: "só pensamento", thought: true }], { promptTokenCount: 10, thoughtsTokenCount: 5000 }, "MAX_TOKENS")]),
    );
    const error = await failure(provider.generate(request));
    expect(error.retryable).toBe(true);
    expect(error.usage).toEqual({ inputTokens: 10, outputTokens: 5000 });
  });
});

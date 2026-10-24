// Conectores REAIS das IAs: recebem a chave da plataforma e chamam a API de cada empresa.
// Cumprem o mesmo contrato (AiProvider) da IA simulada, então o motor não muda nada para usá-los.
// A chave vem por parâmetro, é usada só nesta chamada e nunca é gravada nem registrada em log.
//
// Os modelos ficam todos em MODELS: é o único lugar a ajustar se uma empresa mudar o nome do modelo.

import { estimateTokens } from "./mock";
import {
  ProviderError,
  type AiProvider,
  type Effort,
  type GenerateChunk,
  type ModelTier,
  type ProviderId,
} from "./types";

/** Uma imagem que a IA deve "enxergar": o tipo (ex.: image/png) e o conteúdo em base64. */
type ImageInput = { mime: string; base64: string };

// MODELO por IA e por NÍVEL (econômico/padrão/potente). É o ÚNICO lugar a ajustar os nomes dos modelos.
// Famílias escolhidas pelo doc "Melhor IA por função": Claude Haiku/Sonnet/Opus 5.5; GPT-6 Luna/6.1 Sol/6 Astra;
// Gemini Flash/Pro. ⚠️ Os NOMES DE API do GPT e do Gemini são a minha leitura do doc — confirme na lista de modelos
// de cada empresa antes de ligar as chaves (o botão "Ver modelos disponíveis" saiu com "Minhas chaves", em 24/10).
// Se algum ID estiver diferente, é só corrigir AQUI.
const MODELS_BY_TIER: Record<ProviderId, Record<ModelTier, string>> = {
  claude: { economico: "claude-haiku-5-5", padrao: "claude-sonnet-5-5", potente: "claude-opus-5-5" },
  gpt: { economico: "gpt-6-luna", padrao: "gpt-6.1-sol", potente: "gpt-6-astra" },
  gemini: { economico: "gemini-flash-latest", padrao: "gemini-flash-latest", potente: "gemini-pro-latest" },
};

function modelFor(id: ProviderId, tier: ModelTier): string {
  return MODELS_BY_TIER[id][tier];
}

// O ESFORÇO é a maior alavanca de tempo e de custo. Os modelos "pensam" antes de responder, e esse
// pensamento gasta tokens e tempo. Quanto maior o esforço, mais o modelo pensa (melhor em casos difíceis,
// mas mais lento e caro). "low" desliga o pensamento: vai direto ao ponto — ideal para montar/juntar o que
// já existe (ex.: a montagem final), que era justamente o que estava estourando o tempo da hospedagem.

/** Orçamento de "pensamento" (em tokens) por esforço. Usado pelo Claude e pelo Gemini; "low" = sem pensar. */
const THINKING_TOKENS: Record<Effort, number> = { low: 0, medium: 2000, high: 6000 };

/** Nível de raciocínio do GPT por esforço. */
const GPT_REASONING: Record<Effort, "minimal" | "medium" | "high"> = {
  low: "minimal",
  medium: "medium",
  high: "high",
};

/** Garante que a IA devolveu conteúdo; vazio vira uma falha que o motor tenta de novo ou troca de IA. */
function ensureNonEmpty(text: string): void {
  if (!text.trim()) {
    throw new ProviderError("A IA não devolveu conteúdo.", { retryable: true });
  }
}

/** Cria o conector real de uma IA com a chave da pessoa. */
export function createRealProvider(id: ProviderId, apiKey: string): AiProvider {
  return {
    id,
    generate(request) {
      const { systemPrompt, input, maxOutputTokens, signal } = request;
      const effort = request.effort ?? "medium";
      const images = request.images ?? [];
      const model = modelFor(id, request.tier ?? "padrao");
      switch (id) {
        case "claude":
          return streamClaude(apiKey, model, systemPrompt, input, maxOutputTokens, effort, images, signal);
        case "gpt":
          return streamOpenAI(apiKey, model, systemPrompt, input, maxOutputTokens, effort, images, signal);
        case "gemini":
          return streamGemini(apiKey, model, systemPrompt, input, maxOutputTokens, effort, images, signal);
      }
    },
  };
}

// ---------- Anthropic (Claude) ----------

async function* streamClaude(
  apiKey: string,
  model: string,
  system: string,
  input: string,
  maxTokens: number,
  effort: Effort,
  images: ImageInput[],
  signal?: AbortSignal,
): AsyncGenerator<GenerateChunk> {
  // Claude 5: o pensamento é "adaptive" e o esforço vai em output_config.effort (o formato antigo
  // thinking.enabled+budget foi removido). "low" vai direto (sem pensar); médio/alto pensam.
  const think = effort !== "low";
  const content = images.length
    ? [
        ...images.map((img) => ({
          type: "image" as const,
          source: { type: "base64" as const, media_type: img.mime, data: img.base64 },
        })),
        { type: "text" as const, text: input },
      ]
    : input;
  const response = await callApi(
    "https://api.anthropic.com/v1/messages",
    {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    {
      model,
      // Deixa folga para o pensamento caber junto com a resposta quando o esforço é médio/alto.
      max_tokens: think ? maxTokens + 8000 : maxTokens,
      ...(think ? { thinking: { type: "adaptive" }, output_config: { effort } } : {}),
      system,
      messages: [{ role: "user", content }],
      stream: true,
    },
    signal,
  );

  let text = "";
  let stopReason: string | null = null;
  for await (const data of readSse(response, signal)) {
    const event = safeParse(data);
    if (!event) continue;
    // Só o texto da resposta entra; os blocos de "pensamento" (thinking_delta) são ignorados.
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
      const piece = String(event.delta.text ?? "");
      text += piece;
      yield { type: "text", text: piece };
    } else if (event.type === "message_delta" && event.delta?.stop_reason) {
      stopReason = event.delta.stop_reason;
    }
  }

  ensureNonEmpty(text);
  yield doneChunk(model, system + input, text, stopReason === "max_tokens");
}

// ---------- OpenAI (GPT) ----------

async function* streamOpenAI(
  apiKey: string,
  model: string,
  system: string,
  input: string,
  maxTokens: number,
  effort: Effort,
  images: ImageInput[],
  signal?: AbortSignal,
): AsyncGenerator<GenerateChunk> {
  const userContent = images.length
    ? [
        { type: "text" as const, text: input },
        ...images.map((img) => ({
          type: "image_url" as const,
          image_url: { url: `data:${img.mime};base64,${img.base64}` },
        })),
      ]
    : input;
  const response = await callApi(
    "https://api.openai.com/v1/chat/completions",
    { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    {
      model,
      // O raciocínio também gasta deste limite, então damos uma folga proporcional ao esforço.
      max_completion_tokens: maxTokens + THINKING_TOKENS[effort] + 1000,
      // "minimal" (low) quase não pensa e vai direto ao ponto, bem mais rápido; sobe conforme o esforço.
      reasoning_effort: GPT_REASONING[effort],
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      stream: true,
    },
    signal,
  );

  let text = "";
  let finishReason: string | null = null;
  for await (const data of readSse(response, signal)) {
    if (data === "[DONE]") break;
    const event = safeParse(data);
    const choice = event?.choices?.[0];
    if (!choice) continue;
    const piece = choice.delta?.content;
    if (typeof piece === "string" && piece) {
      text += piece;
      yield { type: "text", text: piece };
    }
    if (choice.finish_reason) finishReason = choice.finish_reason;
  }

  ensureNonEmpty(text);
  yield doneChunk(model, system + input, text, finishReason === "length");
}

// ---------- Google (Gemini) ----------

async function* streamGemini(
  apiKey: string,
  model: string,
  system: string,
  input: string,
  maxTokens: number,
  effort: Effort,
  images: ImageInput[],
  signal?: AbortSignal,
): AsyncGenerator<GenerateChunk> {
  const thinkingTokens = THINKING_TOKENS[effort];
  const parts = [
    { text: input },
    ...images.map((img) => ({ inline_data: { mime_type: img.mime, data: img.base64 } })),
  ];
  const response = await callApi(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
    { "x-goog-api-key": apiKey, "content-type": "application/json" },
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        maxOutputTokens: maxTokens + thinkingTokens,
        // thinkingBudget 0 desliga o pensamento (low = rápido); maior pensa mais.
        thinkingConfig: { thinkingBudget: thinkingTokens },
      },
    },
    signal,
  );

  let text = "";
  let finishReason: string | null = null;
  for await (const data of readSse(response, signal)) {
    const event = safeParse(data);
    const candidate = event?.candidates?.[0];
    if (!candidate) continue;
    for (const part of candidate.content?.parts ?? []) {
      // O texto da resposta tem part.text; os blocos de "pensamento" vêm com part.thought e são ignorados.
      const piece = part.text;
      if (typeof piece === "string" && piece && !part.thought) {
        text += piece;
        yield { type: "text", text: piece };
      }
    }
    if (candidate.finishReason) finishReason = candidate.finishReason;
  }

  ensureNonEmpty(text);
  yield doneChunk(model, system + input, text, finishReason === "MAX_TOKENS");
}

// ---------- Compartilhado ----------

async function callApi(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal });
  } catch (error) {
    if (signal?.aborted) throw error; // cancelamento do usuário: deixa o motor tratar.
    throw new ProviderError("Não deu para falar com a IA agora.", { retryable: true });
  }

  if (!response.ok || !response.body) {
    // 401/403 (chave) e 400 (pedido) não adianta repetir; 429 e 5xx valem uma nova tentativa.
    const retryable = response.status === 429 || response.status >= 500;
    let detail = "";
    try {
      detail = (await response.text()).slice(0, 300);
    } catch {
      // sem corpo de erro
    }
    throw new ProviderError(`A IA respondeu com erro (${response.status}).${detail ? ` ${detail}` : ""}`, { retryable });
  }
  return response;
}

/** Lê um fluxo SSE e entrega o conteúdo de cada linha "data:". */
async function* readSse(response: Response, signal?: AbortSignal): AsyncGenerator<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data:")) yield trimmed.slice(5).trim();
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeParse(data: string): any {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function doneChunk(model: string, promptText: string, output: string, truncated: boolean): GenerateChunk {
  return {
    type: "done",
    usage: { inputTokens: estimateTokens(promptText), outputTokens: estimateTokens(output) },
    model,
    truncated,
  };
}

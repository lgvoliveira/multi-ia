// Conectores REAIS das IAs: recebem a chave da plataforma e chamam a API de cada empresa.
// Cumprem o mesmo contrato (AiProvider) da IA simulada, então o motor não muda nada para usá-los.
// A chave vem por parâmetro, é usada só nesta chamada e nunca é gravada nem registrada em log.
//
// O modelo e o preço de cada nível ficam em models.ts. O consumo cobrado é o que a empresa da IA informa no fim da
// resposta, com o "pensamento" e o cache (F40), nunca a conta pelo tamanho do texto.

import { MAX_WEB_SEARCHES, maxInputTokens, outputTokenCap } from "./limits";
import { modelId } from "./models";
import {
  DEFAULT_TIER,
  ProviderError,
  type AiProvider,
  type AiTool,
  type Effort,
  type GenerateChunk,
  type GenerateRequest,
  type ProviderId,
  type Usage,
  type WebSource,
} from "./types";

/** Uma imagem que a IA deve "enxergar": o tipo (ex.: image/png) e o conteúdo em base64. */
type ImageInput = { mime: string; base64: string };

/** O último pedaço de uma resposta: o consumo, o modelo e o que mais a IA fez. */
type DoneChunk = Extract<GenerateChunk, { type: "done" }>;

/** O que um conector precisa para uma chamada. */
interface Call {
  apiKey: string;
  model: string;
  system: string;
  input: string;
  /** Teto de saída (resposta + pensamento), de limits.ts. */
  maxTokens: number;
  effort: Effort;
  images: ImageInput[];
  tools: AiTool[];
  signal?: AbortSignal;
  fetch: typeof fetch;
}

/** Os testes trocam o fetch por respostas gravadas, sem chamar a internet. */
export interface RealProviderOptions {
  fetch?: typeof fetch;
}

/** Cria o conector real de uma IA com a chave da plataforma. */
export function createRealProvider(id: ProviderId, apiKey: string, options: RealProviderOptions = {}): AiProvider {
  return {
    id,
    generate(request: GenerateRequest) {
      const effort = request.effort ?? "medium";
      const call: Call = {
        apiKey,
        model: modelId(id, request.tier ?? DEFAULT_TIER),
        system: request.systemPrompt,
        input: request.input,
        maxTokens: outputTokenCap(id, request.maxOutputTokens, effort),
        effort,
        images: request.images ?? [],
        tools: request.tools ?? [],
        signal: request.signal,
        fetch: options.fetch ?? fetch,
      };
      switch (id) {
        case "claude":
          return streamClaude(call);
        case "gpt":
          return streamOpenAI(call);
        case "gemini":
          return streamGemini(call);
      }
    },
  };
}

// ---------- Anthropic (Claude) ----------

// Os modelos 5.5 do Claude sempre pensam ("adaptive"): o Opus nem aceita desligar, e sem o esforço explícito o Sonnet
// pensa no nível alto. Por isso o esforço vai sempre, inclusive o baixo. Não pedimos o "fallback" da Anthropic (outro
// modelo dela assumir quando ele recusa): a nossa troca de IA já cuida disso, e o preço continua o do modelo pedido.

/**
 * A pesquisa na internet do Claude: no máximo MAX_WEB_SEARCHES pesquisas, com resultados do Brasil. Ele filtra o que
 * as páginas trazem antes de ler (menos tokens), e a resposta não devolve o conteúdo cru das páginas.
 */
const CLAUDE_WEB_SEARCH = {
  type: "web_search_20260318",
  name: "web_search",
  max_uses: MAX_WEB_SEARCHES,
  response_inclusion: "excluded",
  user_location: { type: "approximate", country: "BR", timezone: "America/Sao_Paulo" },
};

async function* streamClaude(call: Call): AsyncGenerator<GenerateChunk> {
  const content = call.images.length
    ? [
        ...call.images.map((img) => ({
          type: "image" as const,
          source: { type: "base64" as const, media_type: img.mime, data: img.base64 },
        })),
        { type: "text" as const, text: call.input },
      ]
    : call.input;
  const response = await callApi(
    call,
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": call.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    {
      model: call.model,
      max_tokens: call.maxTokens,
      thinking: { type: "adaptive" },
      output_config: { effort: call.effort },
      system: call.system,
      messages: [{ role: "user", content }],
      ...(call.tools.includes("web_search") ? { tools: [CLAUDE_WEB_SEARCH] } : {}),
      stream: true,
    },
  );

  const meter = new UsageMeter();
  const sources = new SourceList();
  let text = "";
  let stopReason: string | null = null;
  let finished = false;
  try {
    for await (const data of readSse(response, call.signal)) {
      const event = safeParse(data);
      if (!event) continue;
      if (event.type === "message_start") {
        meter.claude(event.message?.usage);
      } else if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
        // Só o texto da resposta entra; os blocos de "pensamento" (thinking_delta) e da pesquisa ficam de fora.
        const piece = String(event.delta.text ?? "");
        text += piece;
        yield { type: "text", text: piece };
      } else if (event.type === "content_block_delta" && event.delta?.type === "citations_delta") {
        // A página que sustenta o trecho que a IA está escrevendo (a pesquisa na internet).
        sources.add(event.delta.citation);
      } else if (event.type === "content_block_start" && Array.isArray(event.content_block?.citations)) {
        for (const citation of event.content_block.citations) sources.add(citation);
      } else if (event.type === "message_delta") {
        meter.claude(event.usage);
        if (event.delta?.stop_reason) stopReason = event.delta.stop_reason;
      } else if (event.type === "message_stop") {
        finished = true;
      } else if (event.type === "error") {
        // Erro no meio da resposta (ex.: a IA ficou sobrecarregada): vale tentar de novo.
        throw new ProviderError(`A IA avisou um erro no meio da resposta: ${describeApiError(event.error)}`, {
          retryable: true,
        });
      }
    }
  } catch (error) {
    throw withUsage(error, call, meter);
  }

  if (stopReason === "refusal") {
    throw new ProviderError("A IA recusou o pedido.", { retryable: false, model: call.model, usage: meter.usage() });
  }
  // "pause_turn": a pesquisa demorou demais e a Anthropic parou o turno; o que ela escreveu vale, mas pode estar incompleto.
  const cut = stopReason === "max_tokens" || stopReason === "pause_turn";
  yield { ...finish(call, meter, text, finished, cut), ...sources.chunkFields() };
}

// ---------- OpenAI (GPT) ----------

/**
 * O raciocínio do GPT por esforço. Os modelos GPT-6 não aceitam "none" nem "minimal" em todos os níveis (conferido na
 * página de cada modelo em 25/10/2026), então o esforço baixo é "low".
 */
const GPT_REASONING: Record<Effort, "low" | "medium" | "high"> = { low: "low", medium: "medium", high: "high" };

async function* streamOpenAI(call: Call): AsyncGenerator<GenerateChunk> {
  const userContent = call.images.length
    ? [
        { type: "text" as const, text: call.input },
        ...call.images.map((img) => ({
          type: "image_url" as const,
          image_url: { url: `data:${img.mime};base64,${img.base64}` },
        })),
      ]
    : call.input;
  const response = await callApi(
    call,
    "https://api.openai.com/v1/chat/completions",
    { Authorization: `Bearer ${call.apiKey}`, "content-type": "application/json" },
    {
      model: call.model,
      // O raciocínio também gasta deste limite.
      max_completion_tokens: call.maxTokens,
      reasoning_effort: GPT_REASONING[call.effort],
      messages: [
        { role: "system", content: call.system },
        { role: "user", content: userContent },
      ],
      stream: true,
      // Sem isto, a OpenAI não manda o consumo no fim da resposta.
      stream_options: { include_usage: true },
    },
  );

  const meter = new UsageMeter();
  let text = "";
  let finishReason: string | null = null;
  try {
    for await (const data of readSse(response, call.signal)) {
      if (data === "[DONE]") break;
      const event = safeParse(data);
      if (!event) continue;
      if (event.error) {
        throw new ProviderError(`A IA avisou um erro no meio da resposta: ${describeApiError(event.error)}`, {
          retryable: true,
        });
      }
      // O consumo vem num pedaço próprio, no fim, sem texto.
      if (event.usage) meter.openai(event.usage);
      const choice = event.choices?.[0];
      if (!choice) continue;
      const piece = choice.delta?.content;
      if (typeof piece === "string" && piece) {
        text += piece;
        yield { type: "text", text: piece };
      }
      if (choice.finish_reason) finishReason = choice.finish_reason;
    }
  } catch (error) {
    throw withUsage(error, call, meter);
  }

  if (finishReason === "content_filter") {
    throw new ProviderError("A IA recusou o pedido.", { retryable: false, model: call.model, usage: meter.usage() });
  }
  yield finish(call, meter, text, finishReason !== null, finishReason === "length");
}

// ---------- Google (Gemini) ----------

/** Por que o Gemini parou quando ele recusou o pedido: não adianta tentar de novo com ele. */
const GEMINI_REFUSALS = new Set(["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "IMAGE_SAFETY"]);

async function* streamGemini(call: Call): AsyncGenerator<GenerateChunk> {
  const parts = [
    { text: call.input },
    ...call.images.map((img) => ({ inline_data: { mime_type: img.mime, data: img.base64 } })),
  ];
  const response = await callApi(
    call,
    `https://generativelanguage.googleapis.com/v1beta/models/${call.model}:streamGenerateContent?alt=sse`,
    { "x-goog-api-key": call.apiKey, "content-type": "application/json" },
    {
      systemInstruction: { parts: [{ text: call.system }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        // O pensamento também gasta deste limite.
        maxOutputTokens: call.maxTokens,
        // Os modelos Gemini 3.5 em diante aceitam "low", "medium" e "high" ("minimal" dá erro no 3.8 Flash).
        thinkingConfig: { thinkingLevel: call.effort },
      },
      // Rodar código: o Gemini escreve um programa e o roda num ambiente isolado do Google, sem custo a mais.
      ...(call.tools.includes("code_execution") ? { tools: [{ code_execution: {} }] } : {}),
    },
  );

  const meter = new UsageMeter();
  let text = "";
  let codeRuns = 0;
  let finishReason: string | null = null;
  try {
    for await (const data of readSse(response, call.signal)) {
      const event = safeParse(data);
      if (!event) continue;
      if (event.error) {
        throw new ProviderError(`A IA avisou um erro no meio da resposta: ${describeApiError(event.error)}`, {
          retryable: true,
        });
      }
      // Cada pedaço traz o consumo até ali; o último tem o total.
      if (event.usageMetadata) meter.gemini(event.usageMetadata);
      if (event.promptFeedback?.blockReason) {
        throw new ProviderError("A IA recusou o pedido.", { retryable: false, model: call.model });
      }
      const candidate = event.candidates?.[0];
      if (!candidate) continue;
      for (const part of candidate.content?.parts ?? []) {
        // O programa rodou (o código e o resultado ficam de fora do texto: a resposta explica o que deu).
        if (part.codeExecutionResult) codeRuns += 1;
        // O texto da resposta tem part.text; os blocos de "pensamento" vêm com part.thought e ficam de fora.
        const piece = part.text;
        if (typeof piece === "string" && piece && !part.thought) {
          text += piece;
          yield { type: "text", text: piece };
        }
      }
      if (candidate.finishReason) finishReason = candidate.finishReason;
    }
  } catch (error) {
    throw withUsage(error, call, meter);
  }

  if (finishReason && GEMINI_REFUSALS.has(finishReason)) {
    throw new ProviderError("A IA recusou o pedido.", { retryable: false, model: call.model, usage: meter.usage() });
  }
  const done = finish(call, meter, text, finishReason !== null, finishReason === "MAX_TOKENS");
  yield codeRuns ? { ...done, codeRuns } : done;
}

// ---------- Consumo ----------

/** As páginas citadas, sem repetir, na ordem em que apareceram. Só endereços da web (http e https). */
class SourceList {
  private readonly byUrl = new Map<string, WebSource>();

  add(citation: Json): void {
    const url = typeof citation?.url === "string" ? citation.url.trim() : "";
    if (!/^https?:\/\//i.test(url) || this.byUrl.has(url)) return;
    const title = typeof citation.title === "string" && citation.title.trim() ? citation.title.trim() : url;
    this.byUrl.set(url, { title: title.slice(0, 200), url: url.slice(0, 2000) });
  }

  /** O pedaço que vai no "done": as fontes, quando houve alguma. */
  chunkFields(): { sources?: WebSource[] } {
    return this.byUrl.size ? { sources: [...this.byUrl.values()] } : {};
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

/** Junta o consumo que a empresa da IA vai informando durante a resposta. Cada uma informa de um jeito. */
class UsageMeter {
  private input: number | null = null;
  private output = 0;
  private cached = 0;
  private written = 0;
  private searches = 0;

  /** Claude: o começo traz a entrada; o fim, a saída (com o pensamento) até ali. Os números já são totais. */
  claude(usage: Json): void {
    if (!usage) return;
    if (typeof usage.input_tokens === "number") {
      this.cached = Number(usage.cache_read_input_tokens ?? this.cached);
      this.written = Number(usage.cache_creation_input_tokens ?? this.written);
      this.input = usage.input_tokens + this.cached + this.written;
    }
    if (typeof usage.output_tokens === "number") this.output = usage.output_tokens;
    const searches = usage.server_tool_use?.web_search_requests;
    if (typeof searches === "number") this.searches = searches;
  }

  /** OpenAI: um pedaço só, no fim. prompt_tokens já conta o cache; completion_tokens já conta o raciocínio. */
  openai(usage: Json): void {
    this.input = Number(usage.prompt_tokens ?? 0);
    this.output = Number(usage.completion_tokens ?? 0);
    this.cached = Number(usage.prompt_tokens_details?.cached_tokens ?? 0);
    this.written = Number(usage.prompt_tokens_details?.cache_write_tokens ?? 0);
  }

  /** Gemini: a saída cobrada é a resposta mais o pensamento; a entrada inclui o que as ferramentas trouxeram. */
  gemini(usage: Json): void {
    this.input = Number(usage.promptTokenCount ?? 0) + Number(usage.toolUsePromptTokenCount ?? 0);
    this.output = Number(usage.candidatesTokenCount ?? 0) + Number(usage.thoughtsTokenCount ?? 0);
    this.cached = Number(usage.cachedContentTokenCount ?? 0);
    this.written = 0;
  }

  /** O consumo informado, ou null se a empresa da IA não chegou a informar a entrada. */
  usage(): Usage | undefined {
    if (this.input === null) return undefined;
    return {
      inputTokens: this.input,
      outputTokens: this.output,
      ...(this.cached ? { cachedInputTokens: this.cached } : {}),
      ...(this.written ? { cacheWriteTokens: this.written } : {}),
      ...(this.searches ? { webSearchRequests: this.searches } : {}),
    };
  }
}

/**
 * O fim de uma resposta que chegou inteira. Se a resposta parou sem o aviso de fim (a conexão caiu no meio), é uma
 * falha que vale tentar de novo: o texto pode estar pela metade. Se a empresa da IA não informou o consumo (não
 * deveria acontecer), cobra o máximo possível, para a plataforma nunca cobrar menos do que pagou.
 */
function finish(call: Call, meter: UsageMeter, text: string, finished: boolean, truncated: boolean): DoneChunk {
  const reported = meter.usage();
  if (!finished) {
    throw new ProviderError("A resposta da IA caiu no meio.", { retryable: true, model: call.model, usage: reported });
  }
  if (!text.trim()) {
    // Vazio (ex.: a IA gastou o teto pensando) vira uma falha que o motor tenta de novo ou troca de IA.
    throw new ProviderError("A IA não devolveu conteúdo.", { retryable: true, model: call.model, usage: reported });
  }
  let usage = reported;
  if (!usage) {
    console.warn(`[ias] O modelo ${call.model} não informou o consumo; foi contado o máximo da chamada.`);
    usage = { inputTokens: maxInputTokens(call.system + call.input), outputTokens: call.maxTokens };
  }
  return { type: "done", usage, model: call.model, truncated };
}

/** Uma falha no meio da resposta leva o modelo e o consumo informado até ali (para o registro interno, F26). */
function withUsage(error: unknown, call: Call, meter: UsageMeter): unknown {
  if (!(error instanceof ProviderError)) return error;
  return new ProviderError(error.message, {
    retryable: error.retryable,
    model: error.model ?? call.model,
    usage: error.usage ?? meter.usage(),
  });
}

// ---------- Compartilhado ----------

/** Os códigos de resposta que valem uma nova tentativa: demora, limite de uso, sobrecarga e falhas do servidor deles. */
function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

async function callApi(call: Call, url: string, headers: Record<string, string>, body: unknown): Promise<Response> {
  let response: Response;
  try {
    response = await call.fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: call.signal });
  } catch (error) {
    if (call.signal?.aborted) throw error; // cancelamento do usuário: deixa o motor tratar.
    throw new ProviderError("Não deu para falar com a IA agora.", { retryable: true, model: call.model });
  }

  if (!response.ok || !response.body) {
    // 401/403 (chave), 400 (pedido) e 404 (modelo) não adianta repetir.
    let detail = "";
    try {
      detail = (await response.text()).slice(0, 300);
    } catch {
      // sem corpo de erro
    }
    throw new ProviderError(`A IA respondeu com erro (${response.status}).${detail ? ` ${detail}` : ""}`, {
      retryable: isRetryableStatus(response.status),
      model: call.model,
    });
  }
  return response;
}

function describeApiError(error: Json): string {
  if (!error) return "sem detalhes";
  const text = [error.type, error.code, error.status, error.message].filter(Boolean).join(" · ");
  return text.slice(0, 300) || "sem detalhes";
}

/** Lê um fluxo SSE e entrega o conteúdo de cada linha "data:". */
async function* readSse(response: Response, signal?: AbortSignal): AsyncGenerator<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      signal?.throwIfAborted();
      let chunk: Awaited<ReturnType<typeof reader.read>>;
      try {
        chunk = await reader.read();
      } catch (error) {
        if (signal?.aborted) throw error;
        throw new ProviderError("A conexão com a IA caiu no meio da resposta.", { retryable: true });
      }
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data:")) yield trimmed.slice(5).trim();
      }
    }
    const last = (buffer + decoder.decode()).trim();
    if (last.startsWith("data:")) yield last.slice(5).trim();
  } finally {
    reader.cancel().catch(() => {});
  }
}

function safeParse(data: string): Json {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

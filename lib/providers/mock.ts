// IA simulada: cumpre o mesmo contrato das IAs reais, mas não chama nenhuma API e não custa nada.
// Serve para construir e testar o fluxo inteiro antes de ligar as IAs de verdade.

import { isProviderId } from "./catalog";
import {
  ProviderError,
  type AiProvider,
  type GenerateRequest,
  type ProviderId,
} from "./types";

/** Aproximação usada pelas empresas de IA: 1 token ≈ 4 caracteres. */
export const CHARS_PER_TOKEN = 4;
const WORDS_PER_CHUNK = 3;
const DEFAULT_CHUNK_DELAY_MS = 40;

export interface MockProviderOptions {
  id: ProviderId;
  /** Pausa entre um pedaço e outro, em milissegundos (a IA "digitando"). Use 0 nos testes. */
  chunkDelayMs?: number;
  /** Quantas chamadas seguidas falham antes de a IA voltar a responder. Infinity = falha sempre. */
  failFirstCalls?: number;
  /** Nas chamadas que falham, quantos pedaços a IA escreve antes de cair. 0 = falha antes de escrever. */
  failAfterChunks?: number;
  /**
   * Teste da pausa por gasto: a IA informa um consumo de saída OVERSPEND_FACTOR vezes maior que o limite da etapa,
   * como uma IA que gastou além do previsto. O texto escrito não muda.
   */
  overspend?: boolean;
}

/** No teste de gasto a mais, quantas vezes o limite de resposta da etapa a IA simulada diz ter gastado. */
export const OVERSPEND_FACTOR = 10;

export function createMockProvider(options: MockProviderOptions): AiProvider {
  const {
    id,
    chunkDelayMs = DEFAULT_CHUNK_DELAY_MS,
    failFirstCalls = 0,
    failAfterChunks = 0,
    overspend = false,
  } = options;
  const model = `mock-${id}`;
  let calls = 0;

  return {
    id,
    async *generate(request) {
      calls += 1;
      request.signal?.throwIfAborted();

      if (!(request.maxOutputTokens >= 1)) {
        throw new ProviderError("O limite de resposta precisa ser de pelo menos 1 token.", {
          retryable: false,
        });
      }
      const failing = calls <= failFirstCalls;

      const fullText = request.sampleResponse ?? genericResponse(request);
      const { text, truncated } = limitToTokens(fullText, request.maxOutputTokens);

      for (const [index, piece] of splitIntoChunks(text).entries()) {
        if (failing && index >= failAfterChunks) throw intentionalFailure(id, model);
        await delay(chunkDelayMs);
        request.signal?.throwIfAborted();
        yield { type: "text", text: piece };
      }
      if (failing) throw intentionalFailure(id, model);

      yield {
        type: "done",
        usage: {
          inputTokens: estimateTokens(request.systemPrompt + request.input),
          outputTokens: overspend ? request.maxOutputTokens * OVERSPEND_FACTOR : estimateTokens(text),
        },
        model,
        truncated,
      };
    },
  };
}

/**
 * Lê o interruptor de teste MOCK_AI_FAILURES (veja .env.example): quais IAs simuladas falham e em quantas chamadas.
 * "gpt" = o GPT falha sempre; "gpt:2" = falha nas 2 primeiras chamadas; vários separados por vírgula ("gemini,claude").
 * Valor que não dá para entender é erro, para o teste não rodar achando que o interruptor está ligado.
 */
export function parseMockFailures(value = ""): Partial<Record<ProviderId, number>> {
  const failures: Partial<Record<ProviderId, number>> = {};
  for (const entry of value.split(",").map((part) => part.trim().toLowerCase())) {
    if (!entry) continue;
    const [, id, count] = /^([a-z]+)(?::(\d+))?$/.exec(entry) ?? [];
    if (!isProviderId(id)) {
      throw new Error(`MOCK_AI_FAILURES: não entendi "${entry}". Use, por exemplo, "gpt" ou "gpt:2".`);
    }
    failures[id] = count === undefined ? Infinity : Number(count);
  }
  return failures;
}

/**
 * Lê o interruptor de teste MOCK_AI_OVERSPEND (veja .env.example): quais IAs simuladas gastam além do previsto.
 * "claude" ou vários separados por vírgula ("claude,gpt"). Valor que não dá para entender é erro, como no de falhas.
 */
export function parseMockOverspend(value = ""): Set<ProviderId> {
  const providers = new Set<ProviderId>();
  for (const entry of value.split(",").map((part) => part.trim().toLowerCase())) {
    if (!entry) continue;
    if (!isProviderId(entry)) {
      throw new Error(`MOCK_AI_OVERSPEND: não entendi "${entry}". Use, por exemplo, "claude" ou "claude,gpt".`);
    }
    providers.add(entry);
  }
  return providers;
}

/** Quebra o texto em pedaços de algumas palavras. Juntando os pedaços, volta o texto original. */
export function splitIntoChunks(text: string, wordsPerChunk = WORDS_PER_CHUNK): string[] {
  // Cada palavra leva junto o espaço ou a quebra de linha que vem depois dela.
  const words = text.match(/\S+\s*|\s+/g) ?? [];
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(""));
  }
  return chunks;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function limitToTokens(text: string, maxTokens: number): { text: string; truncated: boolean } {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: text.slice(0, maxChars), truncated: true };
}

function intentionalFailure(id: ProviderId, model: string): ProviderError {
  return new ProviderError(`A IA simulada (${id}) falhou de propósito, para teste.`, { retryable: true, model });
}

function genericResponse(request: GenerateRequest): string {
  return (
    "Esta é uma resposta simulada. " +
    `Recebi uma instrução de ${request.systemPrompt.length} caracteres ` +
    `e uma entrada de ${request.input.length} caracteres. ` +
    "Quando a IA real estiver ligada, a resposta de verdade aparece aqui."
  );
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

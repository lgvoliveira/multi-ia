// IA simulada: cumpre o mesmo contrato das IAs reais, mas não chama nenhuma API e não custa nada.
// Serve para construir e testar o fluxo inteiro antes de ligar as IAs de verdade.

import {
  ProviderError,
  type AiProvider,
  type GenerateRequest,
  type ProviderId,
} from "./types";

/** Aproximação usada pelas empresas de IA: 1 token ≈ 4 caracteres. */
const CHARS_PER_TOKEN = 4;
const WORDS_PER_CHUNK = 3;
const DEFAULT_CHUNK_DELAY_MS = 40;

export interface MockProviderOptions {
  id: ProviderId;
  /** Pausa entre um pedaço e outro, em milissegundos (a IA "digitando"). Use 0 nos testes. */
  chunkDelayMs?: number;
  /** Quantas chamadas seguidas falham antes de a IA voltar a responder. Infinity = falha sempre. */
  failFirstCalls?: number;
}

export function createMockProvider(options: MockProviderOptions): AiProvider {
  const { id, chunkDelayMs = DEFAULT_CHUNK_DELAY_MS, failFirstCalls = 0 } = options;
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
      if (calls <= failFirstCalls) {
        throw new ProviderError(`A IA simulada (${id}) falhou de propósito, para teste.`, {
          retryable: true,
        });
      }

      const fullText = request.sampleResponse ?? genericResponse(request);
      const { text, truncated } = limitToTokens(fullText, request.maxOutputTokens);

      for (const piece of splitIntoChunks(text)) {
        await delay(chunkDelayMs);
        request.signal?.throwIfAborted();
        yield { type: "text", text: piece };
      }

      yield {
        type: "done",
        usage: {
          inputTokens: estimateTokens(request.systemPrompt + request.input),
          outputTokens: estimateTokens(text),
        },
        model: `mock-${id}`,
        truncated,
      };
    },
  };
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

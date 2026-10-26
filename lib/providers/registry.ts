// Entrega a IA pronta para uso. Só o servidor deve usar este arquivo: é aqui que as IAs reais recebem as chaves da
// plataforma (lib/keys/server-keys.ts). A empresa nunca conecta chave própria (decisão de 24/10/2026).

import { KEY_ENV_NAMES, serverKeys } from "@/lib/keys/server-keys";
import { getProviderInfo } from "./catalog";
import { createMockImageGenerator, createOpenAiImageGenerator, type ImageGenerator } from "./images";
import { createMockProvider, parseMockFailures, parseMockOverspend } from "./mock";
import { createMockTranscriber, createOpenAiTranscriber, type Transcriber } from "./transcribe";
import { aiMode } from "./mode";
import { createRealProvider } from "./real";
import { ProviderError, type AiProvider, type GenerateChunk, type ProviderId } from "./types";

/** Nas falhas de teste, a IA simulada escreve um pouco antes de cair, como uma conexão que cai no meio da resposta. */
const TEST_FAILURE_AFTER_CHUNKS = 12;

/** Chaves da plataforma, por IA. */
export type ProviderKeys = Partial<Record<ProviderId, string>>;

/**
 * Quem entrega as IAs no servidor (receitas e chat): as de verdade ou as simuladas, conforme o interruptor
 * OCK_AI_MODE (lib/providers/mode.ts). O interruptor é lido a cada chamada: o `npm run dev` percebe a mudança no
 * .env.local sem reiniciar.
 */
export function getProvider(id: ProviderId): AiProvider {
  return aiMode() === "simulada" ? getSimulatedProvider(id) : createGetProvider(serverKeys())(id);
}

/** A IA simulada, com os interruptores de teste MOCK_AI_FAILURES e MOCK_AI_OVERSPEND (veja .env.example). */
export function getSimulatedProvider(id: ProviderId): AiProvider {
  const failures = parseMockFailures(process.env.MOCK_AI_FAILURES);
  return createMockProvider({
    id,
    failFirstCalls: failures[id] ?? 0,
    failAfterChunks: TEST_FAILURE_AFTER_CHUNKS,
    overspend: parseMockOverspend(process.env.MOCK_AI_OVERSPEND).has(id),
  });
}

/**
 * As IAs de verdade, com estas chaves. A IA sem chave nunca cai na simulada (F42): ela falha com um erro que não
 * adianta repetir, a troca de IA entra (nas receitas) e o servidor registra qual variável falta. Nada é cobrado.
 */
export function createGetProvider(keys: ProviderKeys): (id: ProviderId) => AiProvider {
  return (id) => {
    const key = keys[id]?.trim();
    return key ? createRealProvider(id, key) : missingKeyProvider(id);
  };
}

function missingKeyProvider(id: ProviderId): AiProvider {
  const problem = new ProviderError(
    `A chave do ${getProviderInfo(id).name} não está configurada no servidor (${KEY_ENV_NAMES[id]}).`,
    { retryable: false },
  );
  return {
    id,
    generate: (): AsyncIterable<GenerateChunk> => ({
      [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(problem) }),
    }),
  };
}

/**
 * Quem cria as imagens (o GPT Image), pelo mesmo interruptor das IAs: simulada ou de verdade. Sem a chave do GPT, falha
 * com um erro que não adianta repetir, como as IAs de texto (F42).
 */
export function getImageGenerator(): ImageGenerator {
  if (aiMode() === "simulada") return createMockImageGenerator();
  const key = serverKeys().gpt?.trim();
  if (key) return createOpenAiImageGenerator(key);
  return {
    generate: () =>
      Promise.reject(
        new ProviderError(`A chave do GPT não está configurada no servidor (${KEY_ENV_NAMES.gpt}).`, { retryable: false }),
      ),
  };
}

/** Quem transcreve a voz (o gpt-transcribe), pelo mesmo interruptor das IAs. Sem a chave do GPT, falha (F42). */
export function getTranscriber(): Transcriber {
  if (aiMode() === "simulada") return createMockTranscriber();
  const key = serverKeys().gpt?.trim();
  if (key) return createOpenAiTranscriber(key);
  return {
    transcribe: () =>
      Promise.reject(
        new ProviderError(`A chave do GPT não está configurada no servidor (${KEY_ENV_NAMES.gpt}).`, { retryable: false }),
      ),
  };
}

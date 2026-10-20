// Entrega a IA pronta para uso. Só o servidor deve usar este arquivo:
// é aqui que os adaptadores das IAs reais (e suas chaves) vão entrar na Parte B.

import { createMockProvider, parseMockFailures } from "./mock";
import { createRealProvider } from "./real";
import type { AiProvider, ProviderId } from "./types";

/** Nas falhas de teste, a IA simulada escreve um pouco antes de cair, como uma conexão que cai no meio da resposta. */
const TEST_FAILURE_AFTER_CHUNKS = 12;

/** Chaves que a pessoa conectou, por IA. Quem tem chave usa a IA real; quem não tem, a simulada. */
export type ProviderKeys = Partial<Record<ProviderId, string>>;

/** A IA simulada, com o interruptor de teste MOCK_AI_FAILURES (veja .env.example). */
export function getProvider(id: ProviderId): AiProvider {
  const failures = parseMockFailures(process.env.MOCK_AI_FAILURES);
  return createMockProvider({
    id,
    failFirstCalls: failures[id] ?? 0,
    failAfterChunks: TEST_FAILURE_AFTER_CHUNKS,
  });
}

/**
 * Monta o "entregador de IA" de uma execução: para cada papel, usa a IA REAL quando a pessoa
 * conectou a chave daquela IA; sem chave, cai na IA simulada (assim o fluxo sempre roda).
 */
export function createGetProvider(keys: ProviderKeys): (id: ProviderId) => AiProvider {
  return (id) => {
    const key = keys[id]?.trim();
    return key ? createRealProvider(id, key) : getProvider(id);
  };
}

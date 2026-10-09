// Entrega a IA pronta para uso. Só o servidor deve usar este arquivo:
// é aqui que os adaptadores das IAs reais (e suas chaves) vão entrar na Parte B.

import { createMockProvider, parseMockFailures } from "./mock";
import type { AiProvider, ProviderId } from "./types";

/** Nas falhas de teste, a IA simulada escreve um pouco antes de cair, como uma conexão que cai no meio da resposta. */
const TEST_FAILURE_AFTER_CHUNKS = 12;

/**
 * Por enquanto, todas as IAs são a IA simulada. O interruptor de teste MOCK_AI_FAILURES, no .env.local,
 * faz algumas delas falharem (veja .env.example).
 */
export function getProvider(id: ProviderId): AiProvider {
  const failures = parseMockFailures(process.env.MOCK_AI_FAILURES);
  return createMockProvider({
    id,
    failFirstCalls: failures[id] ?? 0,
    failAfterChunks: TEST_FAILURE_AFTER_CHUNKS,
  });
}

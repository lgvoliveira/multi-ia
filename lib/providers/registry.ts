// Entrega a IA pronta para uso. Só o servidor deve usar este arquivo:
// é aqui que os adaptadores das IAs reais (e suas chaves) vão entrar na Parte B.

import { createMockProvider } from "./mock";
import type { AiProvider, ProviderId } from "./types";

/** Por enquanto, todas as IAs são a IA simulada. */
export function getProvider(id: ProviderId): AiProvider {
  return createMockProvider({ id });
}

// Grava a narração aos poucos, enquanto a fase roda (F35). Sem isto, o texto das IAs só chegava ao banco quando a
// fase inteira terminava, e a tela ficava parada até lá. Os eventos esperam um instante numa fila e vão juntos, em
// ordem; os pedaços de texto de uma mesma etapa viram um evento só, para não gravar uma linha por palavra.

import type { PublicRunEvent } from "./public-events";

/** De quanto em quanto tempo a fila vai para o banco. A tela busca as novidades a cada segundo. */
export const EVENT_FLUSH_MS = 1000;

export interface EventBuffer {
  /** Põe um evento na fila. Ele vai para o banco no próximo envio. */
  push(event: PublicRunEvent): void;
  /** Manda o que está na fila e espera todos os envios terminarem. Se algum envio falhou, lança o erro. */
  flush(): Promise<void>;
}

export function createEventBuffer(
  write: (events: PublicRunEvent[]) => Promise<void>,
  intervalMs = EVENT_FLUSH_MS,
): EventBuffer {
  let pending: PublicRunEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  // Os envios vão um depois do outro, para a ordem do banco ser a ordem da narração.
  let chain: Promise<void> = Promise.resolve();
  let failure: unknown = null;

  function send(): Promise<void> {
    if (timer) clearTimeout(timer);
    timer = null;
    const batch = pending;
    pending = [];
    if (batch.length > 0) {
      chain = chain.then(async () => {
        // Depois de um envio que falhou, os próximos não vão: a narração ficaria com um buraco no meio.
        if (failure) return;
        try {
          await write(batch);
        } catch (error) {
          failure = error;
        }
      });
    }
    return chain;
  }

  return {
    push(event) {
      const index = event.type === "step-text" ? mergeTarget(pending, event) : -1;
      const target = pending[index];
      if (event.type === "step-text" && target?.type === "step-text") {
        pending[index] = { ...target, text: target.text + event.text };
      } else {
        pending.push(event);
      }
      if (!timer) timer = setTimeout(() => void send(), intervalMs);
    },
    async flush() {
      await send();
      if (failure) throw failure;
    },
  };
}

type TextEvent = Extract<PublicRunEvent, { type: "step-text" }>;

/**
 * Onde um pedaço de texto pode entrar: no pedaço anterior da mesma etapa e rodada, desde que entre os dois só haja
 * texto (de outras etapas, numa fase em paralelo). Texto de etapas diferentes pode trocar de ordem sem mudar nada
 * na tela; já um evento de outro tipo (ex.: "tentando de novo", que apaga o texto) não pode ser pulado.
 */
function mergeTarget(pending: PublicRunEvent[], event: TextEvent): number {
  for (let index = pending.length - 1; index >= 0; index--) {
    const candidate = pending[index];
    if (candidate.type !== "step-text") return -1;
    if (candidate.stepId === event.stepId && candidate.round === event.round) return index;
  }
  return -1;
}

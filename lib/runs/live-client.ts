// Acompanha uma execução ao vivo, do navegador. Busca as novidades no nosso servidor a cada segundo
// (GET /api/runs/<id>/events), que lê o banco com o login de quem está vendo: só a própria pessoa acompanha a sua
// execução (F27). A primeira busca é o "replay" de tudo o que já aconteceu; as seguintes trazem só o que é novo.
//
// A posição (seq) de cada evento evita repetição: um evento só chega à tela se for mais novo que o último visto.

import type { PublicRunEvent } from "./public-events";

/** Status possíveis de uma execução, como o servidor os reporta. */
export type LiveRunStatus = "queued" | "running" | "paused" | "finished" | "failed" | "cancelled";

/** Por que a tela parou de acompanhar sem a execução ter acabado. */
export type LostReason =
  /** Ninguém está conectado neste navegador (a conta saiu, talvez em outra aba). */
  | "signed-out"
  /** O login mudou para outra pessoa, ou a execução não existe mais. */
  | "not-found";

export interface SubscribeHandlers {
  /** Um evento novo da narração, já em ordem e sem repetição. */
  onEvent: (event: PublicRunEvent) => void;
  /** O status mudou (ex.: passou a "finished" ou "failed"). */
  onStatus?: (status: LiveRunStatus) => void;
  /** Não dá mais para acompanhar (ver LostReason). */
  onLost?: (reason: LostReason) => void;
}

export interface SubscribeOptions {
  /** Intervalo entre as buscas. */
  intervalMs?: number;
  /** Quem faz o pedido pela internet. Os testes trocam por um dublê. */
  fetch?: typeof fetch;
}

const TERMINAL: ReadonlySet<LiveRunStatus> = new Set(["finished", "failed", "cancelled"]);
const POLL_INTERVAL_MS = 1000;

interface EventsResponse {
  status: LiveRunStatus;
  events: { seq: number; event: PublicRunEvent }[];
  more: boolean;
}

/**
 * Começa a acompanhar a execução. Devolve uma função que para o acompanhamento.
 * Chamar a função devolvida é seguro a qualquer momento e mais de uma vez.
 */
export function subscribeRun(runId: string, handlers: SubscribeHandlers, options: SubscribeOptions = {}): () => void {
  const send = options.fetch ?? fetch;
  const intervalMs = options.intervalMs ?? POLL_INTERVAL_MS;
  let lastSeq = 0;
  let lastStatus: LiveRunStatus | null = null;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function stop() {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
  }

  async function poll(): Promise<void> {
    timer = null;
    if (stopped) return;
    let body: EventsResponse | null = null;
    try {
      const response = await send(`/api/runs/${runId}/events?after=${lastSeq}`, { cache: "no-store" });
      if (response.status === 401 || response.status === 404) {
        if (!stopped) handlers.onLost?.(response.status === 401 ? "signed-out" : "not-found");
        stop();
        return;
      }
      if (response.ok) body = parseEventsResponse(await response.json());
    } catch {
      // Sem internet agora: tenta de novo na próxima busca.
    }
    if (stopped) return;

    if (body) {
      for (const { seq, event } of body.events) {
        if (seq <= lastSeq) continue;
        lastSeq = seq;
        handlers.onEvent(event);
        if (stopped) return;
      }
      if (body.status !== lastStatus) {
        lastStatus = body.status;
        handlers.onStatus?.(body.status);
      }
      // Acabou e já veio a narração inteira (o servidor grava tudo antes de marcar o fim): não há mais o que buscar.
      if (TERMINAL.has(body.status) && !body.more) {
        stop();
        return;
      }
    }
    // Com mais eventos esperando (replay comprido), busca de novo na hora.
    if (!stopped) timer = setTimeout(() => void poll(), body?.more ? 0 : intervalMs);
  }

  void poll();
  return stop;
}

function parseEventsResponse(value: unknown): EventsResponse | null {
  if (typeof value !== "object" || value === null) return null;
  const { status, events, more } = value as Record<string, unknown>;
  if (typeof status !== "string" || !Array.isArray(events)) return null;
  return { status: status as LiveRunStatus, events: events as EventsResponse["events"], more: more === true };
}

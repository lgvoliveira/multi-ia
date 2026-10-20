// Acompanha uma execução ao vivo, do navegador. Primeiro faz um "replay" de tudo que já aconteceu
// (os eventos guardados, em ordem), depois escuta as novidades em tempo real (Realtime do Supabase):
// cada novo evento e cada mudança de status. Se o canal em tempo real falhar, cai para a pesca (polling)
// a cada 3 s pelos eventos novos. Usa só a chave pública (anon): nada de segredo no navegador.
//
// A posição (seq) de cada evento evita repetição: um evento só chega ao app se for mais novo que o último visto.
// Assim o replay, o tempo real e a pesca podem se sobrepor sem bagunçar a ordem nem duplicar.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PublicRunEvent } from "./public-events";

/** Status possíveis de uma execução, como o servidor os reporta. */
export type LiveRunStatus = "queued" | "running" | "finished" | "failed" | "cancelled";

export interface SubscribeHandlers {
  /** Um evento novo da narração, já em ordem e sem repetição. */
  onEvent: (event: PublicRunEvent) => void;
  /** O status mudou (ex.: passou a "finished" ou "failed"). */
  onStatus: (status: LiveRunStatus) => void;
}

const TERMINAL: ReadonlySet<LiveRunStatus> = new Set(["finished", "failed", "cancelled"]);
const POLL_INTERVAL_MS = 3000;

let cachedClient: SupabaseClient | null = null;

/** Cria (uma vez) o cliente do navegador com a chave pública. */
function browserClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  cachedClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

async function fetchEventsAfter(runId: string, afterSeq: number): Promise<{ seq: number; event: PublicRunEvent }[]> {
  const response = await fetch(`/api/runs/${runId}/events?after=${afterSeq}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Falha ao buscar eventos (${response.status}).`);
  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null || !("events" in body)) return [];
  const { events } = body as { events: { seq: number; event: PublicRunEvent }[] };
  return Array.isArray(events) ? events : [];
}

async function fetchStatus(runId: string): Promise<LiveRunStatus | undefined> {
  const response = await fetch(`/api/runs/${runId}`, { cache: "no-store" });
  if (!response.ok) return undefined;
  const body: unknown = await response.json();
  if (typeof body === "object" && body !== null && "status" in body) {
    return (body as { status: LiveRunStatus }).status;
  }
  return undefined;
}

/**
 * Começa a acompanhar a execução. Devolve uma função que cancela o acompanhamento (desliga o canal e a pesca).
 * Chamar a função devolvida é seguro a qualquer momento e mais de uma vez.
 */
export function subscribeRun(runId: string, handlers: SubscribeHandlers): () => void {
  let lastSeq = 0;
  let stopped = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  const client = browserClient();
  const channel = client.channel(`run:${runId}`);

  // Repassa um evento só se ele for mais novo que o último visto (evita repetição entre replay/tempo real/pesca).
  const emit = (seq: number, event: PublicRunEvent) => {
    if (stopped || seq <= lastSeq) return;
    lastSeq = seq;
    handlers.onEvent(event);
  };

  const reportStatus = (status: LiveRunStatus | undefined) => {
    if (stopped || !status) return;
    handlers.onStatus(status);
    if (TERMINAL.has(status)) stop();
  };

  // Replay: busca tudo que já aconteceu, em ordem, a partir do início.
  const backfill = async () => {
    try {
      const events = await fetchEventsAfter(runId, lastSeq);
      for (const { seq, event } of events) emit(seq, event);
    } catch {
      // Sem replay agora: a pesca ou o tempo real cobrem depois.
    }
  };

  const startPolling = () => {
    if (pollTimer || stopped) return;
    pollTimer = setInterval(async () => {
      await backfill();
      reportStatus(await fetchStatus(runId));
    }, POLL_INTERVAL_MS);
  };

  function stop() {
    if (stopped) return;
    stopped = true;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    void client.removeChannel(channel);
  }

  channel
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "run_events", filter: `run_id=eq.${runId}` },
      (payload) => {
        const row = payload.new as { id: number; event: PublicRunEvent };
        emit(row.id, row.event);
      },
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "runs", filter: `id=eq.${runId}` },
      (payload) => {
        reportStatus((payload.new as { status: LiveRunStatus }).status);
      },
    )
    .subscribe((status) => {
      // Assim que o canal conecta, refaz o replay para fechar a brecha entre o replay inicial e a escuta.
      if (status === "SUBSCRIBED") {
        void (async () => {
          await backfill();
          reportStatus(await fetchStatus(runId));
        })();
      }
      // O canal caiu: passa a pescar os eventos novos a cada 3 s.
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        startPolling();
      }
    });

  // Replay inicial antes de qualquer novidade do tempo real.
  void backfill();

  return stop;
}

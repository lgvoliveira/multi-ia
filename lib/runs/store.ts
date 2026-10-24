// Acesso tipado às tabelas da execução persistida (runs, run_events e ai_calls). SÓ do servidor.
// Duas portas, como no resto do banco novo:
//  - as funções que recebem `session` leem com a sessão de quem está logado: o banco só devolve as execuções da
//    própria pessoa, e só as colunas que ela pode ver. É assim que as rotas que o navegador chama leem;
//  - as outras usam a chave secreta (supabaseAdmin), porque só o servidor grava execuções e as leva adiante.
// O resto do servidor fala com essas tabelas só por aqui.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RunCursor, StepResult } from "@/lib/engine/types";
import type { ProviderId } from "@/lib/providers/types";
import type { PublicPlannedStage, PublicRunEvent } from "@/lib/runs/public-events";
import { supabaseAdmin } from "@/lib/runs/supabase-server";

const RUNS = "runs";
const RUN_EVENTS = "run_events";
const AI_CALLS = "ai_calls";

/**
 * Por quanto tempo uma execução fica reservada para quem a está rodando. Quem roda renova a reserva a cada poucos
 * segundos (heartbeat); se o servidor cair, ela vence logo e a execução pode ser retomada.
 */
export const LEASE_MS = 60 * 1000;

/** Como uma execução pode estar no banco. `paused` chega com a cobrança (parte 3b). */
export type RunStatus = "queued" | "running" | "paused" | "finished" | "failed" | "cancelled";

/** Os status em que a execução já acabou e nada mais muda. */
export const FINAL_STATUSES: readonly RunStatus[] = ["finished", "failed", "cancelled"];

/** O erro guardado quando uma execução falha (coluna interna; a tela nunca a lê). */
export interface RunError {
  stepId: string;
  provider: ProviderId;
  retryable: boolean;
  errorMessage: string;
}

/** Uma linha da tabela `runs`, como o servidor a vê (com as colunas internas). */
export interface RunRow {
  id: string;
  company_id: string;
  member_id: string;
  recipe_id: string;
  request: string;
  team: Record<string, ProviderId>;
  plan: PublicPlannedStage[];
  status: RunStatus;
  cursor: RunCursor;
  outputs: Record<string, string>;
  results: StepResult[];
  result: string | null;
  duration_ms: number | null;
  error: RunError | null;
  lease_until: string | null;
  attempt: number;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
}

/** O que é preciso para criar uma execução. O id, os contadores e as datas o banco preenche. */
export interface NewRun {
  company_id: string;
  member_id: string;
  recipe_id: string;
  request: string;
  team: Record<string, ProviderId>;
  plan: PublicPlannedStage[];
}

/** O que a própria pessoa vê da execução dela (as colunas que a sessão pode ler). */
export interface OwnRun {
  id: string;
  recipe_id: string;
  status: RunStatus;
  plan: PublicPlannedStage[];
  cursor: RunCursor;
  result: string | null;
  duration_ms: number | null;
}

const OWN_RUN_COLUMNS = "id, recipe_id, status, plan, cursor, result, duration_ms";

/** Uma chamada a uma IA, para a tabela interna `ai_calls`. Modelo e tokens nunca vão para a tela. */
export interface AiCallRow {
  company_id: string;
  member_id: string;
  run_id: string;
  step_id: string;
  provider: ProviderId;
  model: string;
  input_tokens: number;
  output_tokens: number;
  status: "ok" | "error";
  duration_ms: number;
}

/** Os campos do estado de uma execução que o motor atualiza a cada segmento. */
export interface SnapshotPatch {
  outputs?: Record<string, string>;
  results?: StepResult[];
  team?: Record<string, ProviderId>;
  cursor?: RunCursor;
  status?: RunStatus;
  result?: string | null;
  duration_ms?: number | null;
  finished_at?: string | null;
  lease_until?: string | null;
}

/** Um evento guardado, com a sua posição (seq) na ordem em que entrou. */
export interface StoredEvent {
  seq: number;
  event: PublicRunEvent;
}

/** Cria a execução na fila (status 'queued', cursor na 1ª fase) e devolve o id gerado pelo banco. */
export async function createRun(run: NewRun): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from(RUNS)
    .insert({
      ...run,
      status: "queued" satisfies RunStatus,
      cursor: { stageIndex: 0, round: 1 } satisfies RunCursor,
      outputs: {},
      results: [],
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/**
 * Reivindica a execução para rodar AGORA, de forma atômica: só sai de 'queued'/'running' se ninguém mais
 * estiver rodando (sem reserva ou com a reserva vencida). Marca 'running', reserva por LEASE_MS
 * e soma 1 em `attempt`. A troca condicional em `attempt` garante que, de dois servidores concorrentes,
 * só um reivindica. Devolve a linha reivindicada, ou null se não dava para reivindicar.
 */
export async function claimRun(id: string): Promise<RunRow | null> {
  const db = supabaseAdmin();
  const nowIso = new Date().toISOString();
  const leaseUntil = new Date(Date.now() + LEASE_MS).toISOString();

  // Lê o `attempt` atual para a troca condicional (compare-and-swap) logo abaixo.
  const { data: current, error: readError } = await db
    .from(RUNS)
    .select("attempt")
    .eq("id", id)
    .maybeSingle();
  if (readError) throw readError;
  if (!current) return null;

  const attempt = (current as { attempt: number }).attempt ?? 0;
  const { data, error } = await db
    .from(RUNS)
    .update({ status: "running" satisfies RunStatus, lease_until: leaseUntil, attempt: attempt + 1 })
    .eq("id", id)
    .eq("attempt", attempt)
    .in("status", ["queued", "running"])
    .or(`lease_until.is.null,lease_until.lt.${nowIso}`)
    .select()
    .maybeSingle();
  if (error) throw error;
  return (data as RunRow | null) ?? null;
}

/**
 * Renova a reserva de quem está rodando e devolve o status atual da execução (para perceber um cancelamento no meio
 * da fase). Devolve null se a execução foi reivindicada por outro (o `attempt` mudou): aí quem chamou deve parar.
 */
export async function renewLease(id: string, attempt: number): Promise<RunStatus | null> {
  const { data, error } = await supabaseAdmin()
    .from(RUNS)
    .update({ lease_until: new Date(Date.now() + LEASE_MS).toISOString() })
    .eq("id", id)
    .eq("attempt", attempt)
    .select("status")
    .maybeSingle();
  if (error) throw error;
  return (data as { status: RunStatus } | null)?.status ?? null;
}

/** Anexa, em ordem, eventos públicos à narração da execução. */
export async function appendEvents(
  run: Pick<RunRow, "id" | "company_id">,
  events: PublicRunEvent[],
): Promise<void> {
  if (events.length === 0) return;
  const rows = events.map((event) => ({ run_id: run.id, company_id: run.company_id, event }));
  const { error } = await supabaseAdmin().from(RUN_EVENTS).insert(rows);
  if (error) throw error;
}

/** Registra chamadas às IAs na tabela interna (modelo exato, tokens, tempo). */
export async function recordAiCalls(rows: AiCallRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabaseAdmin().from(AI_CALLS).insert(rows);
  if (error) throw error;
}

/** Salva o estado da execução depois de um segmento (saídas, etapas, cursor, status...). */
export async function saveSnapshot(runId: string, patch: SnapshotPatch): Promise<void> {
  const { error } = await supabaseAdmin().from(RUNS).update(patch).eq("id", runId);
  if (error) throw error;
}

/** Carrega a linha inteira de uma execução, ou null se ela não existe. */
export async function loadRun(id: string): Promise<RunRow | null> {
  const { data, error } = await supabaseAdmin().from(RUNS).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as RunRow | null) ?? null;
}

/** Muda o status de uma execução, opcionalmente com outros campos (resultado, tempo, erro, reserva...). */
export async function setStatus(
  id: string,
  status: RunStatus,
  extra: SnapshotPatch & { error?: RunError | null } = {},
): Promise<void> {
  const { error } = await supabaseAdmin().from(RUNS).update({ status, ...extra }).eq("id", id);
  if (error) throw error;
}

/**
 * Marca a execução como cancelada, só se ela ainda não tinha acabado. Devolve true se cancelou agora.
 * Quem estiver rodando percebe na próxima renovação da reserva e para a IA no meio.
 */
export async function cancelRun(id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from(RUNS)
    .update({ status: "cancelled" satisfies RunStatus, finished_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["queued", "running", "paused"])
    .select("id");
  if (error) throw error;
  return ((data as unknown[] | null) ?? []).length > 0;
}

/** A execução da própria pessoa, lida com a sessão dela. Execução de outra pessoa (ou que não existe) volta null. */
export async function loadOwnRun(session: SupabaseClient, id: string): Promise<OwnRun | null> {
  const { data, error } = await session.from(RUNS).select(OWN_RUN_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as OwnRun | null) ?? null;
}

/** Quantos eventos vão, no máximo, em cada busca. O banco devolve no máximo 1.000 linhas por consulta. */
export const EVENTS_PAGE_SIZE = 500;

/**
 * Os eventos com posição (seq) maior que `afterSeq`, em ordem, lidos com a sessão de quem está logado, no máximo
 * EVENTS_PAGE_SIZE de cada vez. Base do replay (do início, com 0) e das buscas de novidades da tela.
 */
export async function loadOwnEventsAfter(
  session: SupabaseClient,
  id: string,
  afterSeq: number,
): Promise<StoredEvent[]> {
  const { data, error } = await session
    .from(RUN_EVENTS)
    .select("id, event")
    .eq("run_id", id)
    .gt("id", afterSeq)
    .order("id", { ascending: true })
    .limit(EVENTS_PAGE_SIZE);
  if (error) throw error;
  return ((data as { id: number; event: PublicRunEvent }[] | null) ?? []).map((row) => ({
    seq: row.id,
    event: row.event,
  }));
}

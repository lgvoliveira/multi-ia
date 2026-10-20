// Acesso tipado às tabelas da execução persistida. SÓ do servidor (usa o cliente de serviço).
// Cada função faz uma coisa: criar a execução, reivindicá-la para rodar, anexar eventos/etapas,
// salvar o estado, carregar o estado e os eventos, e cuidar das chaves guardadas.
// O resto do servidor fala com o banco só por aqui.

import type { RunCursor, StepResult } from "@/lib/engine/types";
import type { ProviderId } from "@/lib/providers/types";
import type { PublicPlannedStage, PublicRunEvent } from "@/lib/runs/public-events";
import { supabaseAdmin } from "@/lib/runs/supabase-server";

const RUNS = "runs";
const RUN_EVENTS = "run_events";
const RUN_STEPS = "run_steps";
const RUN_SECRETS = "run_secrets";

/** Em quanto tempo a reserva (lease) de uma execução expira, para o varredor poder retomá-la se o servidor morrer. */
const LEASE_MS = 6 * 60 * 1000;

/** Como uma execução pode estar no banco. */
export type RunStatus = "queued" | "running" | "finished" | "failed" | "cancelled";

/** O erro guardado quando uma execução falha (campos internos; a tela não os lê). */
export interface RunError {
  stepId: string;
  provider: ProviderId;
  retryable: boolean;
  errorMessage: string;
}

/** Uma linha da tabela `runs`, como ela volta do banco. */
export interface RunRow {
  id: string;
  owner_token: string;
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
  owner_token: string;
  recipe_id: string;
  request: string;
  team: Record<string, ProviderId>;
  plan: PublicPlannedStage[];
}

/** Uma linha do histórico interno de etapas (run_steps). Modelo, tokens e custo não vão para a tela. */
export interface StepRow {
  step_id: string;
  round: number;
  provider: ProviderId;
  model: string;
  input_tokens: number;
  output_tokens: number;
  truncated: boolean;
  duration_ms: number;
  status: string;
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
      owner_token: run.owner_token,
      recipe_id: run.recipe_id,
      request: run.request,
      team: run.team,
      plan: run.plan,
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
 * estiver rodando (sem reserva ou com a reserva vencida). Marca 'running', estende a reserva por 6 minutos
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

/** Anexa, em ordem, os eventos públicos de um segmento ao fluxo da execução. */
export async function appendEvents(runId: string, events: PublicRunEvent[]): Promise<void> {
  if (events.length === 0) return;
  const rows = events.map((event) => ({ run_id: runId, event }));
  const { error } = await supabaseAdmin().from(RUN_EVENTS).insert(rows);
  if (error) throw error;
}

/** Anexa linhas ao histórico interno de etapas (modelo exato, tokens, tempo). */
export async function appendSteps(runId: string, rows: StepRow[]): Promise<void> {
  if (rows.length === 0) return;
  const withRun = rows.map((row) => ({ ...row, run_id: runId }));
  const { error } = await supabaseAdmin().from(RUN_STEPS).insert(withRun);
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

/** Carrega os eventos com posição (seq) maior que `afterSeq`, em ordem. Base do replay e da pesca (polling). */
export async function loadEventsAfter(id: string, afterSeq: number): Promise<StoredEvent[]> {
  const { data, error } = await supabaseAdmin()
    .from(RUN_EVENTS)
    .select("id, event")
    .eq("run_id", id)
    .gt("id", afterSeq)
    .order("id", { ascending: true });
  if (error) throw error;
  return ((data as { id: number; event: PublicRunEvent }[] | null) ?? []).map((row) => ({
    seq: row.id,
    event: row.event,
  }));
}

/** Lê o blob criptografado com as chaves de API do usuário, ou null se não há (ninguém conectou chave). */
export async function getSecret(runId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from(RUN_SECRETS)
    .select("encrypted_keys")
    .eq("run_id", runId)
    .maybeSingle();
  if (error) throw error;
  return (data as { encrypted_keys: string } | null)?.encrypted_keys ?? null;
}

/** Guarda o blob criptografado com as chaves do usuário (uma linha por execução). */
export async function saveSecret(runId: string, encryptedKeys: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from(RUN_SECRETS)
    .insert({ run_id: runId, encrypted_keys: encryptedKeys });
  if (error) throw error;
}

/** Apaga as chaves guardadas. Chamado quando a execução termina: não guardamos a chave além do necessário. */
export async function deleteSecret(runId: string): Promise<void> {
  const { error } = await supabaseAdmin().from(RUN_SECRETS).delete().eq("run_id", runId);
  if (error) throw error;
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

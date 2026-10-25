// As conversas e as mensagens da tarefa rápida (tabelas conversations e tasks). SÓ do servidor.
// Ler é com a sessão de quem está logado: o banco só devolve as conversas e mensagens da própria pessoa (nem o dono lê
// as dos funcionários, decisão do Luis de 24/10/2026). Criar a conversa também é pela sessão, e a empresa e a pessoa vêm
// sozinhas do login. As mensagens são gravadas só pelo servidor, com a chave-mestra.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Effort, ModelTier, ProviderId } from "@/lib/providers/types";
import { supabaseAdmin } from "@/lib/runs/supabase-server";
import type { ChatAction, ChatConversation } from "./chat";

const CONVERSATIONS = "conversations";
const TASKS = "tasks";
const ENTRIES = "wallet_entries";
const CONVERSATION_COLUMNS = "id, title, updated_at";
const TASK_COLUMNS = "id, prompt, answer, status, action, chosen_provider, chosen_tier, chosen_effort, created_at";

/** Quantas mensagens de uma conversa a tela mostra (as mais recentes). */
export const CONVERSATION_PAGE_SIZE = 100;

interface ConversationRow {
  id: string;
  title: string;
  updated_at: string;
}

function toConversation(row: ConversationRow): ChatConversation {
  return { id: row.id, title: row.title, updatedAt: row.updated_at };
}

/** As conversas da própria pessoa, das mais recentes para as mais antigas. */
export async function listOwnConversations(session: SupabaseClient, limit = 50): Promise<ChatConversation[]> {
  const { data, error } = await session
    .from(CONVERSATIONS)
    .select(CONVERSATION_COLUMNS)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data as ConversationRow[] | null) ?? []).map(toConversation);
}

/** Uma conversa da própria pessoa, ou null (não existe ou é de outra pessoa). */
export async function loadOwnConversation(session: SupabaseClient, id: string): Promise<ChatConversation | null> {
  const { data, error } = await session.from(CONVERSATIONS).select(CONVERSATION_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toConversation(data as ConversationRow) : null;
}

/** Cria uma conversa em nome de quem está logado (a empresa e a pessoa vêm do login, não daqui). */
export async function createOwnConversation(session: SupabaseClient, title: string): Promise<ChatConversation> {
  const { data, error } = await session.from(CONVERSATIONS).insert({ title }).select(CONVERSATION_COLUMNS).single();
  if (error) throw error;
  return toConversation(data as ConversationRow);
}

/** Sobe a conversa na lista: o banco troca a data da última mudança sozinho. */
export async function touchConversation(id: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from(CONVERSATIONS)
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Uma mensagem como fica na tabela tasks. */
export interface TaskRow {
  id: string;
  prompt: string;
  answer: string | null;
  status: "running" | "finished" | "failed";
  action: ChatAction;
  chosen_provider: ProviderId;
  chosen_tier: ModelTier;
  chosen_effort: Effort;
  created_at: string;
}

export interface NewTask {
  id: string;
  company_id: string;
  member_id: string;
  conversation_id: string;
  prompt: string;
  action: ChatAction;
  /** O que o Chefe recomendou e o que a pessoa escolheu. Iguais até a escolha livre (etapa 6, F03). */
  recommended_provider: ProviderId;
  recommended_tier: ModelTier;
  recommended_effort: Effort;
  chosen_provider: ProviderId;
  chosen_tier: ModelTier;
  chosen_effort: Effort;
  status?: TaskRow["status"];
  answer?: string;
  finished_at?: string;
}

export async function createTask(task: NewTask): Promise<void> {
  const { error } = await supabaseAdmin().from(TASKS).insert(task);
  if (error) throw error;
}

/** Fecha a mensagem com a resposta (ou, numa falha, com o aviso do que houve). */
export async function finishTask(id: string, status: "finished" | "failed", answer: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from(TASKS)
    .update({ status, answer, finished_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** As mensagens mais recentes de uma conversa da própria pessoa, em ordem (as antigas primeiro). */
export async function loadOwnTasks(
  session: SupabaseClient,
  conversationId: string,
  limit = CONVERSATION_PAGE_SIZE,
): Promise<TaskRow[]> {
  const { data, error } = await session
    .from(TASKS)
    .select(TASK_COLUMNS)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data as TaskRow[] | null) ?? []).reverse();
}

/** Quanto cada mensagem custou, em centavos, pelas linhas de gasto da própria pessoa no extrato. */
export async function sumOwnTaskCharges(
  session: SupabaseClient,
  taskIds: readonly string[],
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (taskIds.length === 0) return totals;
  const { data, error } = await session
    .from(ENTRIES)
    .select("task_id, amount_cents")
    .in("task_id", taskIds)
    .eq("kind", "charge");
  if (error) throw error;
  for (const row of (data as { task_id: string; amount_cents: number }[] | null) ?? []) {
    // Os gastos entram negativos no extrato.
    totals.set(row.task_id, (totals.get(row.task_id) ?? 0) - Number(row.amount_cents));
  }
  return totals;
}

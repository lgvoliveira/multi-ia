// A empresa e seus membros (dono e funcionários), vistos do servidor. Sem pagamento por enquanto:
// a gente só MEDE o gasto de cada funcionário e soma. Só o servidor usa (cliente de serviço).

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { isProviderId } from "@/lib/providers/catalog";
import type { ProviderId } from "@/lib/providers/types";
import { supabaseAdmin } from "@/lib/runs/supabase-server";

export type MemberRole = "owner" | "employee";

export interface Company {
  id: string;
  slug: string;
  name: string;
  /** Crédito total que a empresa carregou, em centavos. NULL = ilimitado (sem trava de empresa). */
  creditCents: number | null;
}

export interface Member {
  id: string;
  companyId: string;
  name: string;
  role: MemberRole;
  budgetCents: number | null;
  spentCents: number;
  email: string | null;
  /** Senha TEMPORÁRIA que o dono entrega. Vale só até o funcionário trocar; depois vira null. */
  tempPassword: string | null;
  /** true enquanto o funcionário ainda não criou a própria senha. */
  mustChangePassword: boolean;
  /** Hash da senha definitiva do funcionário. NUNCA sai para o cliente. */
  passwordHash: string | null;
}

const MEMBER_COLS =
  "id, company_id, name, role, budget_cents, spent_cents, email, password, password_hash, must_change_password";

interface MemberRow {
  id: string;
  company_id: string;
  name: string;
  role: MemberRole;
  budget_cents: number | null;
  spent_cents: number;
  email: string | null;
  password: string | null;
  password_hash: string | null;
  must_change_password: boolean;
}

function toMember(r: MemberRow): Member {
  return {
    id: r.id,
    companyId: r.company_id,
    name: r.name,
    role: r.role,
    budgetCents: r.budget_cents,
    spentCents: r.spent_cents,
    email: r.email,
    tempPassword: r.password,
    mustChangePassword: r.must_change_password,
    passwordHash: r.password_hash,
  };
}

/** Guarda a senha como hash (scrypt) com sal próprio. O dono nunca vê a senha do funcionário. */
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Email padrão do funcionário: nome e sobrenome juntos, sem acento nem espaço, + @ock.com.br. */
export function emailFromName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tira acentos
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ""); // só letras e números
  return `${base || "funcionario"}@ock.com.br`;
}

/** Senha aleatória curta e legível, para o dono entregar ao funcionário. */
function randomPassword(): string {
  return randomBytes(6).toString("base64").replace(/[+/=]/g, "").slice(0, 8);
}

export interface TaskLog {
  prompt: string;
  answer: string | null;
  provider: ProviderId;
  effort: string;
  mode: string;
  memberId: string | null;
  memberName: string | null;
  costCents: number;
  tokens: number;
  createdAt: string;
}

interface CompanyRow {
  id: string;
  slug: string;
  name: string;
  credit_cents: number | null;
}

function toCompany(r: CompanyRow): Company {
  return { id: r.id, slug: r.slug, name: r.name, creditCents: r.credit_cents };
}

export async function loadCompany(slug: string): Promise<Company | null> {
  const { data, error } = await supabaseAdmin()
    .from("ock_companies")
    .select("id, slug, name, credit_cents")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data ? toCompany(data as CompanyRow) : null;
}

/** Soma o gasto de TODOS os funcionários da empresa (centavos). É o gasto total da empresa. */
export async function companySpentCents(companyId: string): Promise<number> {
  const { data, error } = await supabaseAdmin()
    .from("ock_members")
    .select("spent_cents")
    .eq("company_id", companyId);
  if (error) throw error;
  return ((data as { spent_cents: number }[] | null) ?? []).reduce((sum, m) => sum + (m.spent_cents ?? 0), 0);
}

/** Muda o crédito total da empresa (null = ilimitado). */
export async function setCompanyCredit(companyId: string, creditCents: number | null): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("ock_companies")
    .update({ credit_cents: creditCents })
    .eq("id", companyId);
  if (error) throw error;
}

/** Adiciona (recarrega) crédito ao total da empresa. Devolve o novo total em centavos. */
export async function addCompanyCredit(companyId: string, amountCents: number): Promise<number> {
  const { data, error: readError } = await supabaseAdmin()
    .from("ock_companies")
    .select("credit_cents")
    .eq("id", companyId)
    .maybeSingle();
  if (readError) throw readError;
  const current = (data as { credit_cents: number | null } | null)?.credit_cents ?? 0;
  const next = current + amountCents;
  const { error } = await supabaseAdmin()
    .from("ock_companies")
    .update({ credit_cents: next })
    .eq("id", companyId);
  if (error) throw error;
  return next;
}

/**
 * Confere os limites ANTES de rodar qualquer IA. Devolve uma mensagem de bloqueio, ou null se pode seguir.
 * 1) Teto individual do funcionário (já estourou → barra). 2) Crédito total da empresa acabou → barra.
 * Quem não tem teto/crédito definido (null) nunca é travado.
 */
export async function budgetBlock(company: Company, member: Member): Promise<string | null> {
  if (member.budgetCents != null && member.spentCents >= member.budgetCents) {
    return "Você atingiu seu limite de uso. Peça ao responsável para liberar mais.";
  }
  if (company.creditCents != null) {
    const spent = await companySpentCents(company.id);
    if (spent >= company.creditCents) {
      return "O crédito da empresa acabou. Avise o responsável para recarregar.";
    }
  }
  return null;
}

export async function listMembers(companyId: string): Promise<Member[]> {
  const { data, error } = await supabaseAdmin()
    .from("ock_members")
    .select(MEMBER_COLS)
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data as MemberRow[] | null) ?? []).map(toMember);
}

export async function getMember(id: string): Promise<Member | null> {
  const { data, error } = await supabaseAdmin()
    .from("ock_members")
    .select(MEMBER_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toMember(data as MemberRow) : null;
}

/** Acha o funcionário pelo login (email + senha). No 1º acesso vale a senha temporária; depois, o hash. */
export async function findMemberByLogin(email: string, password: string): Promise<Member | null> {
  const { data, error } = await supabaseAdmin()
    .from("ock_members")
    .select(MEMBER_COLS)
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const member = toMember(data as MemberRow);
  const ok = member.mustChangePassword
    ? member.tempPassword != null && member.tempPassword === password
    : member.passwordHash != null && verifyPassword(password, member.passwordHash);
  return ok ? member : null;
}

/** O funcionário cria a própria senha. Re-confere o login atual, guarda o hash e apaga a temporária. */
export async function changePassword(
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const member = await findMemberByLogin(email, currentPassword);
  if (!member) return false;
  const { error } = await supabaseAdmin()
    .from("ock_members")
    .update({ password_hash: hashPassword(newPassword), password: null, must_change_password: false })
    .eq("id", member.id);
  if (error) throw error;
  return true;
}

/** Adiciona um funcionário à empresa, já criando o login (email padrão + senha aleatória). */
export async function addMember(companyId: string, name: string, budgetCents: number | null): Promise<Member> {
  const email = emailFromName(name);
  const password = randomPassword();
  const { data, error } = await supabaseAdmin()
    .from("ock_members")
    .insert({ company_id: companyId, name, role: "employee", budget_cents: budgetCents, email, password })
    .select(MEMBER_COLS)
    .single();
  if (error) throw error;
  return toMember(data as MemberRow);
}

/** Muda o teto de gasto de um funcionário (null = sem teto). */
export async function setBudget(memberId: string, budgetCents: number | null): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("ock_members")
    .update({ budget_cents: budgetCents })
    .eq("id", memberId);
  if (error) throw error;
}

/** Exclui um funcionário e tudo dele (tarefas, chats, arquivos). Não apaga donos. */
export async function deleteMember(memberId: string): Promise<boolean> {
  const db = supabaseAdmin();
  const member = await getMember(memberId);
  if (!member || member.role !== "employee") return false;
  await db.from("ock_tasks").delete().eq("member_id", memberId);
  await db.from("ock_conversations").delete().eq("member_id", memberId);
  await db.from("ock_files").delete().eq("member_id", memberId);
  const { error } = await db.from("ock_members").delete().eq("id", memberId);
  if (error) throw error;
  return true;
}

/** Soma o custo de uma tarefa ao gasto do funcionário e registra a tarefa. Devolve o novo gasto do membro. */
export async function recordTask(
  company: Company,
  member: Member,
  task: {
    prompt: string;
    answer: string;
    provider: ProviderId;
    effort: string;
    mode: string;
    inputTokens: number;
    outputTokens: number;
    costCents: number;
    conversationId?: string | null;
  },
): Promise<number> {
  const db = supabaseAdmin();
  const newSpent = member.spentCents + task.costCents;
  const { error: updateError } = await db
    .from("ock_members")
    .update({ spent_cents: newSpent })
    .eq("id", member.id);
  if (updateError) throw updateError;

  const { error: logError } = await db.from("ock_tasks").insert({
    company_id: company.id,
    member_id: member.id,
    conversation_id: task.conversationId ?? null,
    prompt: task.prompt,
    answer: task.answer,
    provider: task.provider,
    effort: task.effort,
    mode: task.mode,
    input_tokens: task.inputTokens,
    output_tokens: task.outputTokens,
    cost_cents: task.costCents,
  });
  if (logError) throw logError;
  if (task.conversationId) await touchConversation(task.conversationId);
  return newSpent;
}

// ---------- Conversas (chats) de cada funcionário ----------

export interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

/** Cria um novo chat para o funcionário e devolve o id. */
export async function createConversation(companyId: string, memberId: string, title: string): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from("ock_conversations")
    .insert({ company_id: companyId, member_id: memberId, title: title.slice(0, 80) || "Nova conversa" })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Lista os chats do funcionário, mais recentes primeiro. */
export async function listConversations(memberId: string, limit = 50): Promise<Conversation[]> {
  const { data, error } = await supabaseAdmin()
    .from("ock_conversations")
    .select("id, title, updated_at")
    .eq("member_id", memberId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data as { id: string; title: string; updated_at: string }[] | null) ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    updatedAt: r.updated_at,
  }));
}

/** Atualiza o "visto por último" de um chat (para ele subir na lista). */
export async function touchConversation(id: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("ock_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** As mensagens de UM chat, em ordem (antigas primeiro). Nunca apaga nada. */
export async function conversationTasks(conversationId: string, limit = 300): Promise<TaskLog[]> {
  const { data, error } = await supabaseAdmin()
    .from("ock_tasks")
    .select("prompt, answer, provider, effort, mode, member_id, cost_cents, input_tokens, output_tokens, created_at")
    .eq("conversation_id", conversationId)
    .order("id", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return ((data as unknown as TaskRow[] | null) ?? []).map(toTaskLog);
}

/** Tarefas de um funcionário feitas HOJE (para o resumo do dia do dono). */
export async function memberTasksSince(memberId: string, sinceIso: string): Promise<TaskLog[]> {
  const { data, error } = await supabaseAdmin()
    .from("ock_tasks")
    .select("prompt, answer, provider, effort, mode, member_id, cost_cents, input_tokens, output_tokens, created_at")
    .eq("member_id", memberId)
    .gte("created_at", sinceIso)
    .order("id", { ascending: true });
  if (error) throw error;
  return ((data as unknown as TaskRow[] | null) ?? []).map(toTaskLog);
}

/** Gasto acumulado de UMA IA na empresa (para o painel "Gasto por IA", só do dono). */
export interface ProviderSpend {
  provider: ProviderId;
  costCents: number;
  inputTokens: number;
  outputTokens: number;
  tokens: number;
  tasks: number;
}

/** Quanto cada IA (Claude/GPT/Gemini) custou para a empresa, agrupado no banco. */
export async function spendByProvider(companyId: string): Promise<ProviderSpend[]> {
  const { data, error } = await supabaseAdmin().rpc("ock_spend_by_provider", { p_company: companyId });
  if (error) throw error;
  const rows =
    (data as
      | { provider: string; cost_cents: number; input_tokens: number; output_tokens: number; tasks: number }[]
      | null) ?? [];
  return rows
    .filter((r) => isProviderId(r.provider))
    .map((r) => ({
      provider: r.provider as ProviderId,
      costCents: Number(r.cost_cents),
      inputTokens: Number(r.input_tokens),
      outputTokens: Number(r.output_tokens),
      tokens: Number(r.input_tokens) + Number(r.output_tokens),
      tasks: Number(r.tasks),
    }));
}

type Joined = { name: string } | { name: string }[] | null;

interface TaskRow {
  prompt: string;
  answer: string | null;
  provider: ProviderId;
  effort: string;
  mode: string;
  member_id: string | null;
  cost_cents: number;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
  ock_members?: Joined;
}

function toTaskLog(r: TaskRow): TaskLog {
  const joined = r.ock_members;
  const one = Array.isArray(joined) ? joined[0] : joined;
  return {
    prompt: r.prompt,
    answer: r.answer,
    provider: r.provider,
    effort: r.effort,
    mode: r.mode,
    memberId: r.member_id,
    memberName: one?.name ?? null,
    costCents: r.cost_cents,
    tokens: (r.input_tokens ?? 0) + (r.output_tokens ?? 0),
    createdAt: r.created_at,
  };
}

/** As últimas tarefas da empresa inteira, com o nome de quem pediu (painel do dono). */
export async function companyTasks(companyId: string, limit = 60): Promise<TaskLog[]> {
  const { data, error } = await supabaseAdmin()
    .from("ock_tasks")
    .select(
      "prompt, answer, provider, effort, mode, member_id, cost_cents, input_tokens, output_tokens, created_at, ock_members(name)",
    )
    .eq("company_id", companyId)
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data as unknown as TaskRow[] | null) ?? []).map(toTaskLog);
}

/** As últimas tarefas de UM funcionário (ele só vê as próprias). */
export async function memberTasks(memberId: string, limit = 40): Promise<TaskLog[]> {
  const { data, error } = await supabaseAdmin()
    .from("ock_tasks")
    .select("prompt, answer, provider, effort, mode, member_id, cost_cents, input_tokens, output_tokens, created_at")
    .eq("member_id", memberId)
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data as unknown as TaskRow[] | null) ?? []).map(toTaskLog);
}

// Os agentes prontos da EMPRESA (Fase 2), no banco (tabela company_agents). SÓ do servidor.
// Ler a vitrine (para a prateleira) é com a sessão de quem está logado: o banco só devolve os agentes da empresa dele e
// só as colunas de vitrine (nome, função, chamada, perguntas). Criar e apagar é pela chave-mestra, com a empresa tirada
// do login do dono (a action confere que é o dono). A persona e o conhecimento (instrução da IA) só são lidos pela
// chave-mestra, na hora de responder (loadCompanyAgentPersona).

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/runs/supabase-server";
import type { CompanyAgentCard } from "./agent-forms";

const TABLE = "company_agents";
const CARD_COLUMNS = "id, name, role, tagline, starters";

interface CardRow {
  id: string;
  name: string;
  role: string;
  tagline: string;
  starters: string[] | null;
}

function toCard(row: CardRow): CompanyAgentCard {
  return { id: row.id, name: row.name, role: row.role, tagline: row.tagline, starters: row.starters ?? [] };
}

/** A vitrine dos agentes da empresa, pela sessão (do mais novo para o mais antigo). Nunca persona nem conhecimento. */
export async function listCompanyAgents(session: SupabaseClient): Promise<CompanyAgentCard[]> {
  const { data, error } = await session
    .from(TABLE)
    .select(CARD_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data as CardRow[] | null) ?? []).map(toCard);
}

/** Quantos agentes a empresa já tem (para o teto). Pela chave-mestra. */
export async function countCompanyAgents(companyId: string): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  if (error) throw error;
  return count ?? 0;
}

export interface NewCompanyAgent {
  companyId: string;
  createdBy: string;
  name: string;
  role: string;
  tagline: string;
  persona: string;
  knowledge: string | null;
  starters: string[];
}

/** Cria um agente da empresa (pela chave-mestra; a empresa vem do login do dono, conferido pela action). */
export async function createCompanyAgent(input: NewCompanyAgent): Promise<CompanyAgentCard> {
  const { data, error } = await supabaseAdmin()
    .from(TABLE)
    .insert({
      company_id: input.companyId,
      created_by: input.createdBy,
      name: input.name,
      role: input.role,
      tagline: input.tagline,
      persona: input.persona,
      knowledge: input.knowledge,
      starters: input.starters,
    })
    .select(CARD_COLUMNS)
    .single();
  if (error) throw error;
  return toCard(data as CardRow);
}

/** Apaga um agente da empresa (pela chave-mestra; só da empresa do dono). Devolve se apagou mesmo. */
export async function deleteCompanyAgent(companyId: string, id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from(TABLE)
    .delete()
    .eq("company_id", companyId)
    .eq("id", id)
    .select("id");
  if (error) throw error;
  return (data as { id: string }[] | null)?.length === 1;
}

/** A persona e o conhecimento de um agente da empresa, pela chave-mestra (só na hora de responder). Null se não existe. */
export async function loadCompanyAgentPersona(
  companyId: string,
  id: string,
): Promise<{ persona: string; knowledge: string | null } | null> {
  const { data, error } = await supabaseAdmin()
    .from(TABLE)
    .select("persona, knowledge")
    .eq("company_id", companyId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as { persona: string; knowledge: string | null };
  return { persona: row.persona, knowledge: row.knowledge ?? null };
}

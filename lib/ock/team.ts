// A equipe da empresa, como o dono vê no painel. A leitura usa a sessão de quem está logado: as regras de acesso do
// banco só devolvem a equipe inteira para o dono (o funcionário vê só o próprio cadastro).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemberRole } from "@/lib/auth/member";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  /** Teto de gasto por mês, em centavos de real. null = sem teto. */
  monthlyBudgetCents: number | null;
  status: "active" | "disabled";
}

/** Confere cada campo da linha que o banco devolve (ver parseMemberRow em lib/auth/member.ts). */
export function parseTeamRow(row: unknown): TeamMember {
  if (typeof row !== "object" || row === null) throw new Error("Pessoa da equipe em formato inesperado.");
  const r = row as Record<string, unknown>;
  const budget = r.monthly_budget_cents;
  const budgetOk = budget === null || (typeof budget === "number" && Number.isInteger(budget) && budget >= 0);

  if (typeof r.id !== "string" || typeof r.name !== "string" || typeof r.email !== "string" || !budgetOk) {
    throw new Error("Pessoa da equipe com cadastro incompleto.");
  }
  if (r.role !== "owner" && r.role !== "employee") throw new Error("Papel desconhecido na equipe.");
  if (r.status !== "active" && r.status !== "disabled") throw new Error("Situação desconhecida na equipe.");

  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    monthlyBudgetCents: budget as number | null,
    status: r.status,
  };
}

/** O dono primeiro; depois os funcionários em ordem alfabética. */
export function sortTeam(team: TeamMember[]): TeamMember[] {
  return [...team].sort((a, b) => {
    if (a.role !== b.role) return a.role === "owner" ? -1 : 1;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

export async function listTeam(supabase: SupabaseClient): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("members")
    .select("id, name, email, role, monthly_budget_cents, status");
  if (error) throw new Error(`Não deu para ler a equipe: ${error.message}`);
  return sortTeam((data ?? []).map(parseTeamRow));
}

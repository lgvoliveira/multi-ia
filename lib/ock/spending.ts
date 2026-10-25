// O gasto do mês da própria pessoa, para o alto do espaço de trabalho e a aba "Meus gastos". SÓ do servidor.
// Lido com a sessão de quem está logado, no extrato da empresa: o funcionário só enxerga as linhas dele, e o filtro por
// pessoa faz o dono (que enxerga as de todos) ver também só as dele. O mês conta como o teto: do dia 1º, à meia-noite
// de Brasília, até agora (decisão do Luis de 24/10/2026).

import type { SupabaseClient } from "@supabase/supabase-js";
import { isProviderId } from "@/lib/providers/catalog";
import type { MonthSpending, SpendingEntry } from "./chat";

/** O fuso de Brasília: 3 horas atrás do horário universal, o ano todo (o Brasil não tem mais horário de verão). */
const BRASILIA_OFFSET_HOURS = 3;

/** O começo do mês de `now` no horário de Brasília (dia 1º, à meia-noite), como data universal. */
export function monthStartInBrasilia(now: Date): Date {
  const brasilia = new Date(now.getTime() - BRASILIA_OFFSET_HOURS * 3600 * 1000);
  return new Date(Date.UTC(brasilia.getUTCFullYear(), brasilia.getUTCMonth(), 1, BRASILIA_OFFSET_HOURS));
}

interface EntryRow {
  id: number;
  created_at: string;
  description: string;
  provider: string | null;
  amount_cents: number;
}

/** O gasto do mês, o teto e as linhas do extrato do mês da pessoa (as mais novas primeiro). */
export async function loadMonthSpending(
  session: SupabaseClient,
  memberId: string,
  now = new Date(),
): Promise<{ month: MonthSpending; entries: SpendingEntry[] }> {
  const [member, entries] = await Promise.all([
    session.from("members").select("monthly_budget_cents").eq("id", memberId).maybeSingle(),
    session
      .from("wallet_entries")
      .select("id, created_at, description, provider, amount_cents")
      .eq("member_id", memberId)
      .in("kind", ["charge", "adjustment"])
      .gte("created_at", monthStartInBrasilia(now).toISOString())
      .order("created_at", { ascending: false }),
  ]);
  if (member.error) throw member.error;
  if (entries.error) throw entries.error;

  const rows = (entries.data as EntryRow[] | null) ?? [];
  // No extrato, gasto entra negativo; aqui, o gasto é positivo (e um ajuste que devolveu, negativo).
  const list = rows.map((row) => ({
    id: Number(row.id),
    createdAt: row.created_at,
    description: row.description,
    provider: isProviderId(row.provider) ? row.provider : null,
    amountCents: -Number(row.amount_cents),
  }));
  const budget = (member.data as { monthly_budget_cents: number | null } | null)?.monthly_budget_cents;
  return {
    month: {
      spentCents: list.reduce((total, entry) => total + entry.amountCents, 0),
      budgetCents: budget === null || budget === undefined ? null : Number(budget),
    },
    entries: list,
  };
}

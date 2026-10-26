// Os gastos do mês: o da própria pessoa (alto do espaço de trabalho e aba "Meus gastos") e o da empresa (painel do
// dono). SÓ do servidor. As contas são feitas dentro do banco (migração de 25/10/2026), que vê o extrato inteiro; somar
// aqui as linhas que chegam dava menos que o real depois de 1.000 linhas (F48). Tudo com a sessão de quem está logado:
// o banco só soma o que a pessoa pode ver (o funcionário, o que é dele; o dono, a empresa). O mês conta como o teto: do
// dia 1º, à meia-noite de Brasília, até agora (decisão do Luis de 24/10/2026).

import type { SupabaseClient } from "@supabase/supabase-js";
import { isProviderId } from "@/lib/providers/catalog";
import type { MonthSpending } from "./chat";
import { listMemberDeliveries } from "./files";
import {
  emptyMonth,
  parseMemberMonthRow,
  parseStatementRow,
  providerRank,
  STATEMENT_PAGE_SIZE,
  type CompanyCredit,
  type MemberMonth,
  type MemberMonthDetails,
  type StatementLine,
} from "./statement";

/** O fuso de Brasília: 3 horas atrás do horário universal, o ano todo (o Brasil não tem mais horário de verão). */
const BRASILIA_OFFSET_HOURS = 3;

/** O começo do mês de `now` no horário de Brasília (dia 1º, à meia-noite), como data universal. */
export function monthStartInBrasilia(now: Date): Date {
  const brasilia = new Date(now.getTime() - BRASILIA_OFFSET_HOURS * 3600 * 1000);
  return new Date(Date.UTC(brasilia.getUTCFullYear(), brasilia.getUTCMonth(), 1, BRASILIA_OFFSET_HOURS));
}

/** O mês de cada pessoa que a sessão enxerga (o dono, a equipe toda), ou só o de `memberId`. */
export async function loadMemberMonths(session: SupabaseClient, memberId?: string): Promise<MemberMonth[]> {
  const { data, error } = await session.rpc("member_month_summary", memberId ? { p_member_id: memberId } : {});
  if (error) throw error;
  return ((data as unknown[] | null) ?? []).map(parseMemberMonthRow);
}

/**
 * O extrato do mês, das linhas mais novas para as mais antigas, com cada receita numa linha só. Com `memberId`, só os
 * gastos daquela pessoa; sem ele, o da empresa (para o dono, com as recargas). `more` diz se há linhas além das mostradas.
 */
export async function loadMonthStatement(
  session: SupabaseClient,
  memberId?: string,
): Promise<{ lines: StatementLine[]; more: boolean }> {
  const { data, error } = await session.rpc("month_statement", {
    p_member_id: memberId ?? null,
    p_limit: STATEMENT_PAGE_SIZE + 1,
  });
  if (error) throw error;
  const lines = ((data as unknown[] | null) ?? []).map(parseStatementRow);
  return { lines: lines.slice(0, STATEMENT_PAGE_SIZE), more: lines.length > STATEMENT_PAGE_SIZE };
}

/** O gasto do mês da própria pessoa e o teto que o dono definiu, para o alto do espaço de trabalho. */
export async function loadMonth(session: SupabaseClient, memberId: string): Promise<MonthSpending> {
  const [months, member] = await Promise.all([
    loadMemberMonths(session, memberId),
    session.from("members").select("monthly_budget_cents").eq("id", memberId).maybeSingle(),
  ]);
  if (member.error) throw member.error;
  const budget = (member.data as { monthly_budget_cents: number | null } | null)?.monthly_budget_cents;
  return {
    spentCents: (months[0] ?? emptyMonth(memberId)).spentCents,
    budgetCents: budget === null || budget === undefined ? null : Number(budget),
  };
}

/** O gasto do mês, o teto e o extrato do mês da própria pessoa, para a aba "Meus gastos". */
export async function loadMonthSpending(
  session: SupabaseClient,
  memberId: string,
): Promise<{ month: MonthSpending; lines: StatementLine[]; more: boolean }> {
  const [month, statement] = await Promise.all([loadMonth(session, memberId), loadMonthStatement(session, memberId)]);
  return { month, ...statement };
}

/** O crédito da empresa e o gasto do mês por IA. Só o dono recebe; para outra pessoa, null. */
export async function loadCompanyCredit(session: SupabaseClient): Promise<CompanyCredit | null> {
  const [credit, byProvider] = await Promise.all([
    session.rpc("company_credit"),
    session.rpc("company_month_by_provider"),
  ]);
  if (credit.error) throw credit.error;
  if (byProvider.error) throw byProvider.error;
  const row = ((credit.data as Record<string, unknown>[] | null) ?? [])[0];
  if (!row) return null;
  const balanceCents = Number(row.balance_cents);
  const reservedCents = Number(row.reserved_cents);
  return {
    balanceCents,
    reservedCents,
    availableCents: balanceCents - reservedCents,
    monthSpentCents: Number(row.month_spent_cents),
    byProvider: ((byProvider.data as Record<string, unknown>[] | null) ?? [])
      .map((line) => ({
        provider: isProviderId(line.provider) ? line.provider : null,
        spentCents: Number(line.spent_cents),
      }))
      .sort((a, b) => providerRank(a.provider) - providerRank(b.provider)),
  };
}

/** O que uma pessoa fez no mês, para o "Ver o que fez" do painel do dono: as linhas do extrato e as entregas. */
export async function loadMemberMonthDetails(
  session: SupabaseClient,
  memberId: string,
  now = new Date(),
): Promise<MemberMonthDetails> {
  const [statement, deliveries] = await Promise.all([
    loadMonthStatement(session, memberId),
    listMemberDeliveries(session, memberId, { since: monthStartInBrasilia(now) }),
  ]);
  return { ...statement, deliveries };
}

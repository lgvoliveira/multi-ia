// A carteira da empresa vista por uma execução: reservar a estimativa, cobrar cada etapa concluída e fechar a reserva.
// SÓ do servidor. O dinheiro só se mexe pelas funções da carteira no banco (wallet_reserve, wallet_charge e
// wallet_close_hold, ver supabase/migrations/..._wallet.sql), que travam a carteira enquanto conferem e lançam (F24).
// Cada reserva guarda o id da execução (run_id): é assim que a execução acha a reserva dela, sem coluna nova.

import type { SupabaseClient } from "@supabase/supabase-js";
import { formatBRL } from "@/lib/ock/pricing";
import type { ProviderId } from "@/lib/providers/types";
import { supabaseAdmin } from "@/lib/runs/supabase-server";

const HOLDS = "wallet_holds";
const ENTRIES = "wallet_entries";

/** Por que o banco recusou a reserva. */
export type WalletRefusalReason = "insufficient_balance" | "monthly_budget_exceeded" | "member_inactive";

const REFUSAL_REASONS: readonly WalletRefusalReason[] = [
  "insufficient_balance",
  "monthly_budget_exceeded",
  "member_inactive",
];

/** O banco não deixou reservar: falta saldo, passaria do teto do mês ou a pessoa foi desativada. */
export class WalletRefusedError extends Error {
  constructor(readonly reason: WalletRefusalReason) {
    super(`A carteira recusou a reserva: ${reason}.`);
    this.name = "WalletRefusedError";
  }
}

/**
 * O que a tela diz quando a reserva é recusada, em português, com o que fazer. `amountCents` é o que se tentou
 * reservar: o máximo que o time pode gastar (ao começar) ou o que falta (ao continuar depois de uma pausa).
 */
export function walletRefusalMessage(reason: WalletRefusalReason, isOwner: boolean, amountCents: number): string {
  const amount = formatBRL(amountCents);
  switch (reason) {
    case "insufficient_balance":
      return (
        `A empresa não tem saldo para reservar ${amount}, o máximo que o time pode gastar. ` +
        (isOwner ? "Para colocar crédito, fale com a nossa equipe." : "Peça ao dono da empresa para colocar crédito.")
      );
    case "monthly_budget_exceeded":
      return (
        `Reservar ${amount}, o máximo que o time pode gastar, passaria do seu teto do mês. ` +
        // O painel do dono muda o teto dos funcionários; o do próprio dono, por enquanto, só a nossa equipe.
        (isOwner ? "Para mudar o seu teto, fale com a nossa equipe." : "Peça ao dono da empresa para aumentar o seu teto.")
      );
    case "member_inactive":
      return "A sua conta foi desativada pela empresa. Fale com o dono da empresa.";
  }
}

/** Uma reserva aberta de uma execução. */
export interface RunHold {
  id: string;
  amountCents: number;
  chargedCents: number;
  expiresAt: string;
}

/** O que ainda sobra da reserva (negativo quando o gasto já passou dela). */
export function holdRemainingCents(hold: RunHold): number {
  return hold.amountCents - hold.chargedCents;
}

/**
 * Reserva `amountCents` do saldo da empresa para a execução. Devolve o id da reserva.
 * Recusa com WalletRefusedError (sem saldo, passaria do teto do mês, pessoa desativada).
 */
export async function reserveForRun(memberId: string, runId: string, amountCents: number): Promise<string> {
  const { data, error } = await supabaseAdmin().rpc("wallet_reserve", {
    p_member_id: memberId,
    p_amount_cents: amountCents,
    p_run_id: runId,
  });
  if (error) {
    const reason = REFUSAL_REASONS.find((candidate) => error.message === candidate);
    if (reason) throw new WalletRefusedError(reason);
    throw error;
  }
  return data as string;
}

/** Uma linha de gasto no extrato: o custo de uma etapa concluída. */
export interface StepCharge {
  amountCents: number;
  /** Escrita pelo servidor, nunca com o pedido do funcionário: "Criar um site · Front-end". */
  description: string;
  provider: ProviderId;
}

/**
 * Cobra uma etapa na reserva. Devolve quanto ainda sobra dela (negativo: o gasto passou da estimativa), ou null se a
 * reserva já foi fechada (a pessoa cancelou enquanto a fase terminava): aí nada é cobrado.
 */
export async function chargeStep(holdId: string, runId: string, charge: StepCharge): Promise<number | null> {
  const { data, error } = await supabaseAdmin().rpc("wallet_charge", {
    p_hold_id: holdId,
    p_amount_cents: charge.amountCents,
    p_description: charge.description,
    p_provider: charge.provider,
    p_run_id: runId,
  });
  if (error) {
    if (error.message === "hold_closed") return null;
    throw error;
  }
  return Number(data);
}

/** A reserva aberta mais recente da execução, ou null se não houver (nunca reservou, ou já fechou). */
export async function findOpenRunHold(runId: string): Promise<RunHold | null> {
  const { data, error } = await supabaseAdmin()
    .from(HOLDS)
    .select("id, amount_cents, charged_cents, expires_at")
    .eq("run_id", runId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as { id: string; amount_cents: number; charged_cents: number; expires_at: string };
  return {
    id: row.id,
    amountCents: Number(row.amount_cents),
    chargedCents: Number(row.charged_cents),
    expiresAt: row.expires_at,
  };
}

/** Fecha todas as reservas abertas da execução: o que não foi cobrado volta a ficar disponível. */
export async function closeRunHolds(runId: string): Promise<void> {
  const db = supabaseAdmin();
  const { data, error } = await db.from(HOLDS).select("id").eq("run_id", runId).eq("status", "open");
  if (error) throw error;
  for (const { id } of (data as { id: string }[] | null) ?? []) {
    const { error: closeError } = await db.rpc("wallet_close_hold", { p_hold_id: id });
    if (closeError) throw closeError;
  }
}

/**
 * Quantas etapas da execução já viraram linha de gasto. Cada etapa concluída vira exatamente uma linha (a cobrança
 * mínima é de 1 centavo), então é por este número que se sabe o que ainda falta cobrar sem cobrar nada duas vezes.
 */
export async function countRunCharges(runId: string): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from(ENTRIES)
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId)
    .eq("kind", "charge");
  if (error) throw error;
  return count ?? 0;
}

/** Quanto a execução custou até agora, em centavos, lido com a sessão de quem está logado (só os gastos dela). */
export async function sumOwnRunCharges(session: SupabaseClient, runId: string): Promise<number> {
  const { data, error } = await session.from(ENTRIES).select("amount_cents").eq("run_id", runId).eq("kind", "charge");
  if (error) throw error;
  // Os gastos entram negativos no extrato.
  return ((data as { amount_cents: number }[] | null) ?? []).reduce((total, row) => total - Number(row.amount_cents), 0);
}

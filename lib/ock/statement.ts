// As contas do mês vistas pela tela: o extrato com cada receita numa linha só, o mês de cada pessoa e o crédito da
// empresa. Só dados e textos, sem acesso ao banco: este arquivo vai também para o navegador. Quem lê do banco é
// lib/ock/spending.ts; as contas em si são feitas dentro do banco (migração de 25/10/2026, F48).

import { getProviderInfo, isProviderId } from "@/lib/providers/catalog";
import type { ProviderId } from "@/lib/providers/types";
import type { ChatDelivery } from "./chat";
import { formatBRL } from "./pricing";

/** Quantas linhas do extrato a tela mostra de uma vez. As somas contam todas, sempre. */
export const STATEMENT_PAGE_SIZE = 200;

export type StatementKind = "topup" | "charge" | "adjustment";

/** Uma linha do extrato do mês. Uma receita inteira vem numa linha só (decisão 2 da issue #43). */
export interface StatementLine {
  /** Identifica a linha na tela (o número da primeira linha do extrato que ela junta). */
  id: number;
  kind: StatementKind;
  /** Quem gastou; vazio nas recargas e nos ajustes da empresa. */
  memberId: string | null;
  /** Se a linha é uma execução de receita (as etapas somadas). */
  recipe: boolean;
  /** Escrita pelo nosso servidor, nunca com o pedido: "Criar um site", "Tarefa rápida · Documento", "Pix de 24/10". */
  description: string;
  /** As IAs que trabalharam (numa receita, as do time que cobraram alguma etapa). */
  providers: ProviderId[];
  /** Como no extrato: recarga positiva, gasto negativo (um ajuste que devolveu, positivo). */
  amountCents: number;
  /** Quando foi cobrada (numa receita, a última etapa). */
  createdAt: string;
}

/** O mês de uma pessoa: quanto gastou, quanto tem separado agora e o que fez. */
export interface MemberMonth {
  memberId: string;
  spentCents: number;
  reservedCents: number;
  quickTasks: number;
  recipes: number;
  deliveries: number;
}

/** O que uma pessoa fez no mês, para o "Ver o que fez" do painel do dono. Nunca o pedido, a resposta ou a conversa. */
export interface MemberMonthDetails {
  lines: StatementLine[];
  /** Se há mais linhas do que as mostradas. */
  more: boolean;
  /** As entregas do mês (os arquivos que as IAs fizeram para ela), para baixar. */
  deliveries: ChatDelivery[];
}

/** O gasto do mês com uma IA. `provider` vazio: os ajustes, que não têm IA. */
export interface ProviderSpending {
  provider: ProviderId | null;
  spentCents: number;
}

/** O crédito da empresa, como o dono vê no alto do painel. */
export interface CompanyCredit {
  /** A soma do extrato inteiro. */
  balanceCents: number;
  /** Separado agora para o que está em andamento. */
  reservedCents: number;
  /** O que a equipe ainda pode usar: o saldo menos o reservado. */
  availableCents: number;
  monthSpentCents: number;
  byProvider: ProviderSpending[];
}

/** Um número inteiro que veio do banco (bigint chega como número ou texto). */
function toInteger(value: unknown, field: string): number {
  const number = typeof value === "string" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isSafeInteger(number)) throw new Error(`Conta do mês sem ${field}.`);
  return number;
}

function optionalId(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** Confere uma linha de month_statement, como o banco devolve. */
export function parseStatementRow(row: unknown): StatementLine {
  if (typeof row !== "object" || row === null) throw new Error("Linha do extrato em formato inesperado.");
  const r = row as Record<string, unknown>;
  if (r.kind !== "topup" && r.kind !== "charge" && r.kind !== "adjustment") {
    throw new Error("Tipo de linha do extrato desconhecido.");
  }
  if (typeof r.description !== "string" || typeof r.created_at !== "string") {
    throw new Error("Linha do extrato incompleta.");
  }
  const providers = Array.isArray(r.providers) ? r.providers.filter(isProviderId) : [];
  return {
    id: toInteger(r.entry_id, "número"),
    kind: r.kind,
    memberId: optionalId(r.member_id),
    recipe: r.kind === "charge" && optionalId(r.run_id) !== null,
    description: r.description,
    providers,
    amountCents: toInteger(r.amount_cents, "valor"),
    createdAt: r.created_at,
  };
}

/** Confere uma linha de member_month_summary. */
export function parseMemberMonthRow(row: unknown): MemberMonth {
  if (typeof row !== "object" || row === null) throw new Error("Mês da pessoa em formato inesperado.");
  const r = row as Record<string, unknown>;
  if (typeof r.member_id !== "string") throw new Error("Mês da pessoa sem a pessoa.");
  return {
    memberId: r.member_id,
    spentCents: toInteger(r.spent_cents, "gasto"),
    reservedCents: toInteger(r.reserved_cents, "reservado"),
    quickTasks: toInteger(r.quick_tasks, "tarefas"),
    recipes: toInteger(r.recipes, "receitas"),
    deliveries: toInteger(r.deliveries, "entregas"),
  };
}

/** O mês de quem não aparece nas contas (ainda não fez nada). */
export function emptyMonth(memberId: string): MemberMonth {
  return { memberId, spentCents: 0, reservedCents: 0, quickTasks: 0, recipes: 0, deliveries: 0 };
}

/** "1 receita", "3 receitas". */
function count(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

/** "Neste mês: 8 tarefas rápidas, 1 receita, 3 entregas", ou "Nada neste mês ainda." */
export function monthActivityText(month: MemberMonth): string {
  if (month.quickTasks === 0 && month.recipes === 0 && month.deliveries === 0) return "Nada neste mês ainda.";
  return `Neste mês: ${[
    count(month.quickTasks, "tarefa rápida", "tarefas rápidas"),
    count(month.recipes, "receita", "receitas"),
    count(month.deliveries, "entrega", "entregas"),
  ].join(", ")}`;
}

/** As IAs de uma linha, por extenso: "Claude, GPT e Gemini". */
export function providersText(providers: readonly ProviderId[]): string {
  const names = providers.map((provider) => getProviderInfo(provider).name);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`;
}

/** O valor com o sinal do extrato: "+ R$ 200,00" na recarga, "− R$ 0,37" no gasto. */
export function signedBRL(cents: number): string {
  if (cents === 0) return formatBRL(0);
  return `${cents > 0 ? "+" : "−"} ${formatBRL(Math.abs(cents))}`;
}

/** Quanto a linha gastou, positivo ("R$ 0,37"); um ajuste que devolveu aparece com menos ("− R$ 0,04"). */
export function spentText(line: Pick<StatementLine, "amountCents">): string {
  const spent = -line.amountCents;
  return spent >= 0 ? formatBRL(spent) : signedBRL(spent);
}

/** Dia e hora no horário de Brasília: "25/10, 14:30" (o servidor e o navegador podem estar em outro fuso). */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

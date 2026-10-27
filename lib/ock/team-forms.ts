// Conferência dos formulários da parte "Equipe" do painel do dono: convidar um funcionário e mudar o teto do mês.
// Roda no servidor, porque qualquer um pode mandar qualquer coisa para as ações. Só dados e funções puras.

import { cleanName, emailProblem, nameProblem, normalizeEmail, text } from "@/lib/auth/forms";
import type { CurrentMember } from "@/lib/auth/member";
import type { Viewer } from "@/lib/auth/viewer";

/** Teto mais alto aceito: R$ 100.000,00 por mês. Acima disso é quase certo um erro de digitação. */
export const BUDGET_MAX_CENTS = 10_000_000;

/** No teste (visão raio-x), o máximo por recarga: R$ 1.000.000,00. É de mentira, mas evita um número absurdo. */
export const TOPUP_MAX_CENTS = 100_000_000;

// "50", "50,5", "50,00", "1.234,56" (jeito brasileiro) e "50.5" (ponto como vírgula, comum ao digitar).
const BRAZILIAN_AMOUNT = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;
const DOT_DECIMAL_AMOUNT = /^(\d+)\.(\d{1,2})$/;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BudgetResult = { ok: true; cents: number | null } | { ok: false; message: string };

/** Lê o teto do mês digitado em reais. Vazio quer dizer sem teto. As contas são em centavos, sem números quebrados. */
export function parseBudget(raw: string): BudgetResult {
  const value = raw.replace(/^\s*R\$/i, "").replace(/\s/g, "");
  if (!value) return { ok: true, cents: null };

  const match = BRAZILIAN_AMOUNT.exec(value) ?? DOT_DECIMAL_AMOUNT.exec(value);
  if (!match) return { ok: false, message: "Use só números, como 50 ou 50,00." };

  const reais = Number(match[1].replace(/\./g, ""));
  const centavos = Number((match[2] ?? "").padEnd(2, "0"));
  const cents = reais * 100 + centavos;
  if (cents > BUDGET_MAX_CENTS) return { ok: false, message: "O teto mais alto é R$ 100.000,00 por mês." };
  return { ok: true, cents };
}

export type TopupResult = { ok: true; cents: number } | { ok: false; message: string };

/** Lê o valor de uma recarga de teste (visão raio-x), em reais. Precisa ser maior que zero. */
export function parseTopupAmount(raw: string): TopupResult {
  const value = raw.replace(/^\s*R\$/i, "").replace(/\s/g, "");
  if (!value) return { ok: false, message: "Digite um valor, como 100 ou 100,00." };

  const match = BRAZILIAN_AMOUNT.exec(value) ?? DOT_DECIMAL_AMOUNT.exec(value);
  if (!match) return { ok: false, message: "Use só números, como 100 ou 100,00." };

  const reais = Number(match[1].replace(/\./g, ""));
  const centavos = Number((match[2] ?? "").padEnd(2, "0"));
  const cents = reais * 100 + centavos;
  if (cents <= 0) return { ok: false, message: "O valor precisa ser maior que zero." };
  if (cents > TOPUP_MAX_CENTS) return { ok: false, message: "No teste, o máximo por recarga é R$ 1.000.000,00." };
  return { ok: true, cents };
}

/** O teto como aparece no campo para editar ("50,00"; sem teto, vazio). */
export function budgetInputValue(cents: number | null): string {
  if (cents === null) return "";
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** O id de uma pessoa que vem do formulário: só passa se tiver o formato de um id do banco. */
export function parseMemberId(formData: FormData, field = "memberId"): string | null {
  const id = text(formData, field);
  return UUID_PATTERN.test(id) ? id.toLowerCase() : null;
}

/** O campo escondido, em cada formulário da Equipe, com o id do dono que abriu o painel. */
export const PAGE_OWNER_FIELD = "pageOwnerId";

export type PageOwnerCheck = { ok: true; me: CurrentMember } | { ok: false; message: string };

/**
 * Confere se quem pede ainda é o dono que abriu o painel. As abas normais de um navegador dividem o mesmo login: se
 * outra aba entrar com outra conta (ex.: o dono abre o convite e entra como o funcionário), os botões da aba do dono
 * passam a pedir com esse login. Nada é mudado, e a tela explica o que houve, em vez de pular para a página da outra
 * conta sem explicação.
 */
export function checkPageOwner(viewer: Viewer, pageOwnerId: string | null): PageOwnerCheck {
  if (viewer.status === "member" && viewer.member.role === "owner" && viewer.member.id === pageOwnerId) {
    return { ok: true, me: viewer.member };
  }
  if (viewer.status === "member") {
    return {
      ok: false,
      message:
        `Nada foi mudado. Neste navegador, quem está conectado agora é ${viewer.member.name}: as abas do navegador ` +
        "dividem o mesmo login, e outra aba entrou com essa conta. Para mexer na equipe, clique em Sair, no topo, e " +
        "entre de novo como dono.",
    };
  }
  return {
    ok: false,
    message:
      "Nada foi mudado. A sua conta de dono não está mais conectada neste navegador (ela pode ter saído em outra aba). " +
      "Clique em Sair, no topo, e entre de novo como dono.",
  };
}

export interface InviteValues {
  name: string;
  email: string;
  budgetCents: number | null;
}

export type InviteField = "name" | "email" | "budget";

/** O que foi digitado, para preencher o formulário de novo quando algo precisa ser corrigido. */
export interface InviteTyped {
  name: string;
  email: string;
  budget: string;
}

export type InviteFormResult =
  | { ok: true; values: InviteValues }
  | { ok: false; errors: Partial<Record<InviteField, string>>; values: InviteTyped };

/** Convidar um funcionário: nome, e-mail (é com ele que a pessoa entra) e o teto do mês, que pode ficar vazio. */
export function parseInviteForm(formData: FormData): InviteFormResult {
  const typed: InviteTyped = {
    name: cleanName(text(formData, "name")),
    email: normalizeEmail(text(formData, "email")),
    budget: text(formData, "budget").trim(),
  };

  const errors: Partial<Record<InviteField, string>> = {};
  const nameError = nameProblem(typed.name, "o nome da pessoa");
  if (nameError) errors.name = nameError;
  const emailError = emailProblem(typed.email);
  if (emailError) errors.email = emailError;
  const budget = parseBudget(typed.budget);
  if (!budget.ok) errors.budget = budget.message;

  if (!budget.ok || Object.keys(errors).length > 0) return { ok: false, errors, values: typed };
  return { ok: true, values: { name: typed.name, email: typed.email, budgetCents: budget.cents } };
}

/** O que a ação de convidar devolve para a tela. */
export type InviteFormState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<InviteField, string>>; values: InviteTyped }
  | { status: "error"; message: string; values: InviteTyped }
  | { status: "created"; name: string; link: string };

/** O que as ações do cartão de cada funcionário (teto, link novo, desativar) devolvem para a tela. */
export type MemberActionState =
  | { status: "idle" }
  | { status: "done" }
  | { status: "error"; message: string }
  | { status: "link"; link: string; kind: "invite" | "reset" };

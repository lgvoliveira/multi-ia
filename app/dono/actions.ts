"use server";

// As ações da parte "Equipe" do painel do dono: convidar, gerar link novo, mudar o teto e desativar ou reativar.
// Qualquer um pode chamar uma ação direto pela internet, então cada uma confere de novo, no servidor, que quem pede é
// o dono logado, e o mesmo que abriu o painel (pageOwner). Mudar teto e situação vai pela sessão dele (o banco só deixa
// mexer nos funcionários da empresa dele); criar login, pessoa e convite vai pela chave secreta, com a empresa tirada
// do login, nunca do formulário.

import { refresh } from "next/cache";
import { isDemoMode } from "@/lib/auth/demo";
import { text } from "@/lib/auth/forms";
import { inviteEmployee, issueNewLink } from "@/lib/auth/invites";
import { createSessionClient } from "@/lib/auth/session";
import { getViewer } from "@/lib/auth/viewer";
import { findEmployee, updateEmployee, type EmployeeChange } from "@/lib/ock/team";
import {
  checkPageOwner,
  PAGE_OWNER_FIELD,
  parseBudget,
  parseInviteForm,
  parseMemberId,
  parseTopupAmount,
  type InviteFormState,
  type MemberActionState,
  type PageOwnerCheck,
} from "@/lib/ock/team-forms";
import { supabaseAdmin } from "@/lib/runs/supabase-server";

const GENERIC = "Não deu certo agora, por um problema do nosso lado. Tente de novo em instantes.";
const NOT_FOUND = "Não encontramos essa pessoa na equipe. Recarregue a página e tente de novo.";

const INVITE_REFUSED = {
  "already-in-team": "Esta pessoa já está na equipe. Se ela perdeu a senha, use “Gerar senha nova” no cartão dela.",
  "email-taken":
    "Este e-mail já tem uma conta na plataforma (de outra empresa, ou de um dono). Use outro e-mail para esta pessoa.",
  "email-invalid": "Este e-mail não é aceito. Confira se está certo ou use outro.",
} as const;

/**
 * O dono que abriu o painel, conferido a cada pedido. Se o login do navegador mudou no meio do caminho (ex.: outra aba
 * entrou como o funcionário), nada é feito e a tela recebe um aviso, em vez de pular para a página da outra conta.
 */
async function pageOwner(formData: FormData): Promise<PageOwnerCheck> {
  return checkPageOwner(await getViewer(), parseMemberId(formData, PAGE_OWNER_FIELD));
}

export async function inviteEmployeeAction(_previous: InviteFormState, formData: FormData): Promise<InviteFormState> {
  const owner = await pageOwner(formData);
  if (!owner.ok) {
    const typed = { name: text(formData, "name"), email: text(formData, "email"), budget: text(formData, "budget") };
    return { status: "error", message: owner.message, values: typed };
  }
  const me = owner.me;
  const parsed = parseInviteForm(formData);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: parsed.values };

  const { name, email, budgetCents } = parsed.values;
  const typed = { name, email, budget: formData.get("budget")?.toString() ?? "" };
  try {
    const result = await inviteEmployee({ companyId: me.companyId, name, email, budgetCents });
    if (!result.ok) return { status: "error", message: INVITE_REFUSED[result.reason], values: typed };
    refresh();
    return { status: "created", name, email: result.email, tempPassword: result.tempPassword };
  } catch (error) {
    console.error("[dono] O convite falhou:", error instanceof Error ? error.message : error);
    return { status: "error", message: GENERIC, values: typed };
  }
}

export async function newLinkAction(_previous: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const owner = await pageOwner(formData);
  if (!owner.ok) return { status: "error", message: owner.message };
  const me = owner.me;
  const memberId = parseMemberId(formData);
  const supabase = await createSessionClient();
  if (!memberId || !supabase) return { status: "error", message: NOT_FOUND };

  try {
    // Pela sessão do dono: só aparece se a pessoa for funcionária da empresa dele.
    const employee = await findEmployee(supabase, memberId);
    if (!employee) return { status: "error", message: NOT_FOUND };
    if (employee.status !== "active") {
      return { status: "error", message: "Reative a pessoa antes de gerar uma senha nova." };
    }
    const reset = await issueNewLink({ memberId, companyId: me.companyId });
    if (!reset.ok) return { status: "error", message: NOT_FOUND };
    refresh();
    return { status: "credentials", email: reset.email, tempPassword: reset.tempPassword };
  } catch (error) {
    console.error("[dono] O link novo falhou:", error instanceof Error ? error.message : error);
    return { status: "error", message: GENERIC };
  }
}

/** Muda o teto ou a situação de um funcionário. Só depois de conferir o dono (pageOwner). */
async function changeEmployee(formData: FormData, change: EmployeeChange): Promise<MemberActionState> {
  const memberId = parseMemberId(formData);
  const supabase = await createSessionClient();
  if (!memberId || !supabase) return { status: "error", message: NOT_FOUND };

  try {
    if (!(await updateEmployee(supabase, memberId, change))) return { status: "error", message: NOT_FOUND };
  } catch (error) {
    console.error("[dono] Não deu para mudar o funcionário:", error instanceof Error ? error.message : error);
    return { status: "error", message: GENERIC };
  }
  refresh();
  return { status: "done" };
}

export async function updateBudgetAction(_previous: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const owner = await pageOwner(formData);
  if (!owner.ok) return { status: "error", message: owner.message };
  const budget = parseBudget(formData.get("budget")?.toString() ?? "");
  if (!budget.ok) return { status: "error", message: budget.message };
  return changeEmployee(formData, { monthly_budget_cents: budget.cents });
}

export async function setStatusAction(_previous: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const owner = await pageOwner(formData);
  if (!owner.ok) return { status: "error", message: owner.message };
  const status = formData.get("status");
  if (status !== "active" && status !== "disabled") return { status: "error", message: GENERIC };
  return changeEmployee(formData, { status });
}

/**
 * Recarga de TESTE (visão raio-x): adiciona crédito fictício na empresa do dono logado. Só funciona no modo raio-x
 * (lib/auth/demo.ts: no computador, nunca em produção); fora dele, recusa. A recarga de verdade continua só pelo painel
 * do Supabase (F25). A função demo_wallet_topup existe só no banco local (seed), então em produção isto nunca roda.
 */
export async function demoTopupAction(_previous: MemberActionState, formData: FormData): Promise<MemberActionState> {
  if (!isDemoMode()) return { status: "error", message: "A recarga de teste só existe no modo raio-x (no computador)." };
  const owner = await pageOwner(formData);
  if (!owner.ok) return { status: "error", message: owner.message };
  const amount = parseTopupAmount(formData.get("amount")?.toString() ?? "");
  if (!amount.ok) return { status: "error", message: amount.message };

  try {
    const { error } = await supabaseAdmin().rpc("demo_wallet_topup", {
      p_company_id: owner.me.companyId,
      p_amount_cents: amount.cents,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error("[dono] A recarga de teste falhou:", error instanceof Error ? error.message : error);
    return { status: "error", message: GENERIC };
  }
  refresh();
  return { status: "done" };
}

"use server";

// As ações da parte "Equipe" do painel do dono: convidar, gerar link novo, mudar o teto e desativar ou reativar.
// Qualquer um pode chamar uma ação direto pela internet, então cada uma confere de novo, no servidor, que quem pede é
// o dono logado. Mudar teto e situação vai pela sessão dele (o banco só deixa mexer nos funcionários da empresa dele);
// criar login, pessoa e convite vai pela chave secreta, com a empresa tirada do login, nunca do formulário.

import { refresh } from "next/cache";
import { invitePath } from "@/lib/auth/invite-token";
import { inviteEmployee, issueNewLink } from "@/lib/auth/invites";
import { createSessionClient } from "@/lib/auth/session";
import { siteOrigin } from "@/lib/auth/site-origin";
import { requireMember } from "@/lib/auth/viewer";
import { findEmployee, updateEmployee, type EmployeeChange } from "@/lib/ock/team";
import {
  parseBudget,
  parseInviteForm,
  parseMemberId,
  type InviteFormState,
  type MemberActionState,
} from "@/lib/ock/team-forms";

const GENERIC = "Não deu certo agora, por um problema do nosso lado. Tente de novo em instantes.";
const NOT_FOUND = "Não encontramos essa pessoa na equipe. Recarregue a página e tente de novo.";

const INVITE_REFUSED = {
  "already-in-team": "Esta pessoa já está na equipe. Se ela perdeu o link, use “Gerar link novo” no cartão dela.",
  "email-taken":
    "Este e-mail já tem uma conta na plataforma (de outra empresa, ou de um dono). Use outro e-mail para esta pessoa.",
  "email-invalid": "Este e-mail não é aceito. Confira se está certo ou use outro.",
} as const;

async function inviteLink(token: string): Promise<string> {
  return `${await siteOrigin()}${invitePath(token)}`;
}

export async function inviteEmployeeAction(_previous: InviteFormState, formData: FormData): Promise<InviteFormState> {
  const me = await requireMember("owner");
  const parsed = parseInviteForm(formData);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: parsed.values };

  const { name, email, budgetCents } = parsed.values;
  const typed = { name, email, budget: formData.get("budget")?.toString() ?? "" };
  try {
    const result = await inviteEmployee({ companyId: me.companyId, name, email, budgetCents });
    if (!result.ok) return { status: "error", message: INVITE_REFUSED[result.reason], values: typed };
    refresh();
    return { status: "created", name, link: await inviteLink(result.token) };
  } catch (error) {
    console.error("[dono] O convite falhou:", error instanceof Error ? error.message : error);
    return { status: "error", message: GENERIC, values: typed };
  }
}

export async function newLinkAction(_previous: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const me = await requireMember("owner");
  const memberId = parseMemberId(formData);
  const supabase = await createSessionClient();
  if (!memberId || !supabase) return { status: "error", message: NOT_FOUND };

  try {
    // Pela sessão do dono: só aparece se a pessoa for funcionária da empresa dele.
    const employee = await findEmployee(supabase, memberId);
    if (!employee) return { status: "error", message: NOT_FOUND };
    if (employee.status !== "active") {
      return { status: "error", message: "Reative a pessoa antes de gerar um link novo." };
    }
    const { token, kind } = await issueNewLink({ memberId, companyId: me.companyId });
    refresh();
    return { status: "link", link: await inviteLink(token), kind };
  } catch (error) {
    console.error("[dono] O link novo falhou:", error instanceof Error ? error.message : error);
    return { status: "error", message: GENERIC };
  }
}

async function changeEmployee(formData: FormData, change: EmployeeChange): Promise<MemberActionState> {
  await requireMember("owner");
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
  const budget = parseBudget(formData.get("budget")?.toString() ?? "");
  if (!budget.ok) {
    await requireMember("owner");
    return { status: "error", message: budget.message };
  }
  return changeEmployee(formData, { monthly_budget_cents: budget.cents });
}

export async function setStatusAction(_previous: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const status = formData.get("status");
  if (status !== "active" && status !== "disabled") {
    await requireMember("owner");
    return { status: "error", message: GENERIC };
  }
  return changeEmployee(formData, { status });
}

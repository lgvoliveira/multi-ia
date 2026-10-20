// GET   /api/ock/company  → empresa + membros + últimas tarefas (painel do dono e a escolha de quem é você).
// POST  /api/ock/company  { name, budgetCents? }        → adiciona um funcionário.
// PATCH /api/ock/company  { memberId, budgetCents|null } → muda o teto de gasto de um funcionário.

import {
  addCompanyCredit,
  addMember,
  companyTasks,
  deleteMember,
  listMembers,
  loadCompany,
  setBudget,
  setCompanyCredit,
  spendByProvider,
  type Member,
} from "@/lib/ock/company";
import { premiumCostInCents } from "@/lib/ock/pricing";

const SLUG = "demo";

/** O que o dono pode ver de cada funcionário: NUNCA o hash; a senha temporária só até o funcionário trocar. */
function forOwner(member: Member) {
  return {
    id: member.id,
    name: member.name,
    role: member.role,
    budgetCents: member.budgetCents,
    spentCents: member.spentCents,
    email: member.email,
    mustChangePassword: member.mustChangePassword,
    tempPassword: member.mustChangePassword ? member.tempPassword : null,
  };
}

export async function GET(): Promise<Response> {
  try {
    const company = await loadCompany(SLUG);
    if (!company) return Response.json({ problem: "Empresa não encontrada." }, { status: 404 });
    const [members, tasks, byProvider] = await Promise.all([
      listMembers(company.id),
      companyTasks(company.id),
      spendByProvider(company.id),
    ]);
    // Economia: o que teria custado se tudo rodasse no modelo mais potente, menos o custo real.
    const inSum = byProvider.reduce((s, p) => s + p.inputTokens, 0);
    const outSum = byProvider.reduce((s, p) => s + p.outputTokens, 0);
    const actualCents = byProvider.reduce((s, p) => s + p.costCents, 0);
    const premiumCents = premiumCostInCents(inSum, outSum);
    const savings = { premiumCents, actualCents, savedCents: Math.max(0, premiumCents - actualCents) };
    return Response.json(
      { company, members: members.map(forOwner), tasks, byProvider, savings },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[api/ock/company] Falha ao ler a empresa:", error);
    return Response.json({ problem: "Algo deu errado do nosso lado." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const data = await readBody(request);
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name) return Response.json({ problem: "Diga o nome do funcionário." }, { status: 400 });
  const budgetCents = parseBudget(data.budgetCents);
  try {
    const company = await loadCompany(SLUG);
    if (!company) return Response.json({ problem: "Empresa não encontrada." }, { status: 404 });
    const member = await addMember(company.id, name, budgetCents);
    return Response.json({ member: forOwner(member) });
  } catch (error) {
    console.error("[api/ock/company] Falha ao adicionar funcionário:", error);
    return Response.json({ problem: "Não deu para adicionar agora." }, { status: 500 });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const data = await readBody(request);

  // Sem memberId, o dono está mexendo no CRÉDITO DA EMPRESA.
  if (typeof data.memberId !== "string" || !data.memberId) {
    // "addCreditCents": recarrega (adiciona ao saldo). "creditCents": define o total (null = ilimitado).
    const isAdd = "addCreditCents" in data;
    if (!isAdd && !("creditCents" in data)) return Response.json({ problem: "Pedido inválido." }, { status: 400 });
    try {
      const company = await loadCompany(SLUG);
      if (!company) return Response.json({ problem: "Empresa não encontrada." }, { status: 404 });
      if (isAdd) {
        const amount = parseBudget(data.addCreditCents);
        if (!amount) return Response.json({ problem: "Valor inválido." }, { status: 400 });
        const total = await addCompanyCredit(company.id, amount);
        return Response.json({ ok: true, creditCents: total });
      }
      await setCompanyCredit(company.id, data.creditCents === null ? null : parseBudget(data.creditCents));
      return Response.json({ ok: true });
    } catch (error) {
      console.error("[api/ock/company] Falha ao mudar o crédito da empresa:", error);
      return Response.json({ problem: "Não deu para mudar o crédito agora." }, { status: 500 });
    }
  }

  const memberId = data.memberId;
  const budgetCents = data.budgetCents === null ? null : parseBudget(data.budgetCents);
  try {
    await setBudget(memberId, budgetCents);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[api/ock/company] Falha ao mudar o teto:", error);
    return Response.json({ problem: "Não deu para mudar o teto agora." }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const memberId = new URL(request.url).searchParams.get("memberId") ?? "";
  if (!memberId) return Response.json({ problem: "Funcionário inválido." }, { status: 400 });
  try {
    const ok = await deleteMember(memberId);
    if (!ok) return Response.json({ problem: "Só é possível excluir funcionários." }, { status: 400 });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[api/ock/company] Falha ao excluir funcionário:", error);
    return Response.json({ problem: "Não deu para excluir agora." }, { status: 500 });
  }
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return ((await request.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Lê um teto em centavos, ou null se não veio/for inválido. */
function parseBudget(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

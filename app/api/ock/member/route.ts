// GET /api/ock/member?id=<id> → os dados de UM funcionário e as tarefas DELE (só as próprias).
// É o que alimenta a aba "Meu gasto" do funcionário.

import { getMember, memberTasks } from "@/lib/ock/company";

export async function GET(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return Response.json({ problem: "Funcionário inválido." }, { status: 400 });
  try {
    const member = await getMember(id);
    if (!member) return Response.json({ problem: "Funcionário não encontrado." }, { status: 404 });
    const tasks = await memberTasks(id);
    // Não devolve senha nem hash para o lado do funcionário.
    const safeMember = {
      id: member.id,
      name: member.name,
      role: member.role,
      budgetCents: member.budgetCents,
      spentCents: member.spentCents,
      email: member.email,
    };
    return Response.json({ member: safeMember, tasks }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/ock/member] Falha ao ler o funcionário:", error);
    return Response.json({ problem: "Algo deu errado do nosso lado." }, { status: 500 });
  }
}

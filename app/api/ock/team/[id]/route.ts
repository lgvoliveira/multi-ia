// GET /api/ock/team/[id]: para o "Ver o que fez" do painel do dono, o que uma pessoa da equipe fez no mês: as linhas do
// extrato (cada receita numa linha só) e as entregas. Nunca o pedido, a resposta ou a conversa: o banco nem deixa o
// dono ler isso (F05). Só o dono pede; quem pede vem do login, e o banco só devolve quem é da empresa dele.

import { chatCaller, chatProblem, isUuid, SERVER_PROBLEM } from "@/lib/ock/chat-request";
import { loadMemberMonthDetails, loadMemberMonths } from "@/lib/ock/spending";

const NOT_FOUND = "Esta pessoa não foi encontrada na equipe.";

export async function GET(_request: Request, context: RouteContext<"/api/ock/team/[id]">): Promise<Response> {
  const { id } = await context.params;
  const caller = await chatCaller();
  if (!caller.ok) return caller.response;
  if (caller.me.role !== "owner") return chatProblem(403, "Só o dono da empresa vê o que cada pessoa fez.");
  if (!isUuid(id)) return chatProblem(404, NOT_FOUND);
  try {
    // A pessoa só aparece nas contas se for da empresa de quem pede.
    if ((await loadMemberMonths(caller.session, id)).length === 0) return chatProblem(404, NOT_FOUND);
    const details = await loadMemberMonthDetails(caller.session, id);
    return Response.json(details, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(`[api/ock/team] Falha ao ler o mês de ${id}:`, error);
    return chatProblem(500, SERVER_PROBLEM);
  }
}

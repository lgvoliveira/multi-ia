// GET /api/ock/spending: o gasto do mês de quem está logado, o teto e as linhas do extrato do mês, para a aba
// "Meus gastos". Lido com a sessão da pessoa: só os gastos dela.

import { chatCaller, chatProblem, SERVER_PROBLEM } from "@/lib/ock/chat-request";
import { loadMonthSpending } from "@/lib/ock/spending";

export async function GET(): Promise<Response> {
  const caller = await chatCaller();
  if (!caller.ok) return caller.response;
  try {
    const spending = await loadMonthSpending(caller.session, caller.me.id);
    return Response.json(spending, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/ock/spending] Falha ao ler os gastos:", error);
    return chatProblem(500, SERVER_PROBLEM);
  }
}

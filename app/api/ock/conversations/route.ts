// GET /api/ock/conversations: as conversas de quem está logado, das mais recentes para as mais antigas. Lidas com a
// sessão da pessoa: o banco só devolve as dela (nem o dono vê as dos funcionários).

import { chatCaller, chatProblem, SERVER_PROBLEM } from "@/lib/ock/chat-request";
import { listOwnConversations } from "@/lib/ock/task-store";

export async function GET(): Promise<Response> {
  const caller = await chatCaller();
  if (!caller.ok) return caller.response;
  try {
    const conversations = await listOwnConversations(caller.session);
    return Response.json({ conversations }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/ock/conversations] Falha ao listar as conversas:", error);
    return chatProblem(500, SERVER_PROBLEM);
  }
}

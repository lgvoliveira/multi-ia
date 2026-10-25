// GET /api/ock/conversations/[id]: uma conversa de quem está logado, com as mensagens mais recentes, quanto cada uma
// custou, os anexos e os arquivos que as IAs fizeram. Conversa de outra pessoa é "não encontrada".

import { chatCaller, chatProblem, isUuid, SERVER_PROBLEM } from "@/lib/ock/chat-request";
import { loadConversationView } from "@/lib/ock/conversation-view";

const NOT_FOUND = "Esta conversa não foi encontrada.";

export async function GET(_request: Request, context: RouteContext<"/api/ock/conversations/[id]">): Promise<Response> {
  const { id } = await context.params;
  const caller = await chatCaller();
  if (!caller.ok) return caller.response;
  if (!isUuid(id)) return chatProblem(404, NOT_FOUND);
  try {
    const view = await loadConversationView(caller.session, caller.me.id, id);
    if (!view) return chatProblem(404, NOT_FOUND);
    return Response.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(`[api/ock/conversations] Falha ao abrir a conversa ${id}:`, error);
    return chatProblem(500, SERVER_PROBLEM);
  }
}

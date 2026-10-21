// GET /api/ock/conversations?memberId=X        → lista os chats do funcionário.
// GET /api/ock/conversations?conversationId=Y   → as mensagens de um chat (nunca apagadas).

import { conversationTasks, listConversations } from "@/lib/ock/company";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId");
  const memberId = url.searchParams.get("memberId");
  try {
    if (conversationId) {
      const tasks = await conversationTasks(conversationId);
      return Response.json({ tasks }, { headers: { "Cache-Control": "no-store" } });
    }
    if (memberId) {
      const conversations = await listConversations(memberId);
      return Response.json({ conversations }, { headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ problem: "Informe memberId ou conversationId." }, { status: 400 });
  } catch (error) {
    console.error("[api/ock/conversations] Falha:", error);
    return Response.json({ problem: "Algo deu errado do nosso lado." }, { status: 500 });
  }
}

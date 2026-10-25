// GET /api/ock/deliveries: as entregas de quem está logado (os arquivos que as IAs fizeram para a pessoa), das mais
// novas para as mais antigas. Para baixar, cada uma passa por /api/ock/files/[id].

import { chatCaller, chatProblem, SERVER_PROBLEM } from "@/lib/ock/chat-request";
import { listOwnDeliveries } from "@/lib/ock/files";

export async function GET(): Promise<Response> {
  const caller = await chatCaller();
  if (!caller.ok) return caller.response;
  try {
    // Filtrar pela pessoa importa para o dono, que pela sessão enxerga as entregas da empresa toda.
    const deliveries = await listOwnDeliveries(caller.session, caller.me.id);
    return Response.json({ deliveries }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/ock/deliveries] Falha ao listar as entregas:", error);
    return chatProblem(500, SERVER_PROBLEM);
  }
}

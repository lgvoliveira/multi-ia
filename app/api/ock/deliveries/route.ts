// GET /api/ock/deliveries: as entregas de quem está logado (os arquivos que as IAs fizeram para a pessoa), das mais
// novas para as mais antigas, junto com as pastas ("tarefas") em que ela organiza. Para baixar, cada uma passa por
// /api/ock/files/[id].
// PATCH /api/ock/deliveries: move uma entrega da pessoa para uma pasta (ou para "sem pasta").

import { PAGE_MEMBER_FIELD } from "@/lib/auth/page-member";
import { chatCaller, chatProblem, isUuid, pageCaller, SERVER_PROBLEM } from "@/lib/ock/chat-request";
import { listFolders, listOwnDeliveries, moveDelivery } from "@/lib/ock/files";

export async function GET(): Promise<Response> {
  const caller = await chatCaller();
  if (!caller.ok) return caller.response;
  try {
    // Filtrar pela pessoa importa para o dono, que pela sessão enxerga as entregas da empresa toda.
    const [deliveries, folders] = await Promise.all([
      listOwnDeliveries(caller.session, caller.me.id),
      listFolders(caller.session, caller.me.id),
    ]);
    return Response.json({ deliveries, folders }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/ock/deliveries] Falha ao listar as entregas:", error);
    return chatProblem(500, SERVER_PROBLEM);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return chatProblem(400, "Não entendemos o pedido enviado.");
  }
  const data = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const caller = await pageCaller(data[PAGE_MEMBER_FIELD]);
  if (!caller.ok) return caller.response;

  const deliveryId = data.deliveryId;
  if (!isUuid(deliveryId)) return chatProblem(400, "Esta entrega não foi encontrada.");

  const rawFolder = data.folderId;
  let folderId: string | null;
  if (rawFolder === null || rawFolder === undefined) folderId = null;
  else if (isUuid(rawFolder)) folderId = rawFolder;
  else return chatProblem(400, "Esta tarefa não foi encontrada.");

  try {
    const moved = await moveDelivery(caller.session, { memberId: caller.me.id, deliveryId, folderId });
    if (!moved) return chatProblem(404, "Não encontramos essa entrega (ou a tarefa). Recarregue e tente de novo.");
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/ock/deliveries] Falha ao mover a entrega:", error);
    return chatProblem(500, SERVER_PROBLEM);
  }
}

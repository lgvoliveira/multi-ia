// POST /api/ock: uma mensagem do chat (a tarefa rápida). O Chefe decide quem responde, a IA responde e a OCK cobra da
// carteira da empresa (lib/ock/run-task.ts). Só para quem é da empresa, está ativo e é quem abriu a página (F34); a
// empresa e a pessoa vêm do login, nunca do pedido. Continua com a IA simulada, como as receitas, até o PR das IAs de
// verdade.

import { PAGE_MEMBER_FIELD } from "@/lib/auth/page-member";
import { chatProblem, pageCaller, parseSendBody, SERVER_PROBLEM } from "@/lib/ock/chat-request";
import { runQuickTask } from "@/lib/ock/run-task";

// Uma resposta (um projeto, por exemplo) pode levar minutos com as IAs de verdade.
export const maxDuration = 300;

/** Tamanho máximo do corpo do pedido. Folga grande: uma mensagem de 4.000 caracteres ocupa bem menos. */
const MAX_BODY_SIZE = 64 * 1024;

export async function POST(request: Request): Promise<Response> {
  // Só aceita JSON. Isso também impede que outro site mande mensagens pelo navegador de alguém.
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) return chatProblem(415, "Formato de pedido não aceito.");
  if (Number(request.headers.get("content-length")) > MAX_BODY_SIZE) {
    return chatProblem(413, "A mensagem é grande demais.");
  }
  const text = await request.text();
  if (text.length > MAX_BODY_SIZE) return chatProblem(413, "A mensagem é grande demais.");

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return chatProblem(400, "Não entendemos o pedido enviado.");
  }

  // Primeiro quem pede (e se é quem abriu a página, F34); depois o que veio.
  const pageMemberId = typeof body === "object" && body !== null ? (body as Record<string, unknown>)[PAGE_MEMBER_FIELD] : null;
  const caller = await pageCaller(pageMemberId);
  if (!caller.ok) return caller.response;
  const parsed = parseSendBody(body);
  if (!parsed.ok) return chatProblem(400, parsed.problem);

  const { message, conversationId, fileIds, agentId } = parsed.input;
  try {
    const outcome = await runQuickTask(caller.me, caller.session, { message, conversationId, fileIds, agentId });
    if (!outcome.ok) return chatProblem(outcome.status, outcome.problem);
    return Response.json(outcome.result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/ock] Falha ao responder a mensagem:", error);
    return chatProblem(500, SERVER_PROBLEM);
  }
}

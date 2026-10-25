// GET /api/ock/files/[id]: baixa um arquivo. O servidor confere pela sessão de quem está logado que a pessoa pode ver
// o arquivo (os dela e, para o dono, as entregas da empresa) e manda para um link de poucos minutos, que sempre baixa:
// nem um arquivo feito pela IA abre como página (AGENTS.md, seção 6).

import { chatCaller, chatProblem, isUuid, SERVER_PROBLEM } from "@/lib/ock/chat-request";
import { downloadLink, loadVisibleFile } from "@/lib/ock/files";

const NOT_FOUND = "Arquivo não encontrado.";

export async function GET(_request: Request, context: RouteContext<"/api/ock/files/[id]">): Promise<Response> {
  const { id } = await context.params;
  const caller = await chatCaller();
  if (!caller.ok) return caller.response;
  if (!isUuid(id)) return chatProblem(404, NOT_FOUND);
  try {
    const file = await loadVisibleFile(caller.session, id);
    if (!file) return chatProblem(404, NOT_FOUND);
    const link = await downloadLink(file);
    return new Response(null, { status: 302, headers: { Location: link, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(`[api/ock/files] Falha ao baixar o arquivo ${id}:`, error);
    return chatProblem(500, SERVER_PROBLEM);
  }
}

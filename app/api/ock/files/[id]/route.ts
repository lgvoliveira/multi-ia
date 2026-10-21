// GET /api/ock/files/[id]?member=<id> → redireciona para um link temporário de download do arquivo.

import { downloadUrl } from "@/lib/ock/files";

export async function GET(request: Request, context: RouteContext<"/api/ock/files/[id]">): Promise<Response> {
  const { id } = await context.params;
  const memberId = new URL(request.url).searchParams.get("member") ?? "";
  if (!memberId) return Response.json({ problem: "Funcionário inválido." }, { status: 400 });
  try {
    const url = await downloadUrl(id, memberId);
    if (!url) return Response.json({ problem: "Arquivo não encontrado." }, { status: 404 });
    return Response.redirect(url, 302);
  } catch (error) {
    console.error("[api/ock/files] Falha no download:", error);
    return Response.json({ problem: "Algo deu errado do nosso lado." }, { status: 500 });
  }
}

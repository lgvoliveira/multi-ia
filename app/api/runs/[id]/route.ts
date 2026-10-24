// GET /api/runs/[id]: o resumo da execução que a tela precisa para montar e retomar o acompanhamento.
// Lido com a sessão de quem está logado: só a própria pessoa vê a execução dela (execução de outra pessoa é
// "não encontrada"), e só o que ela pode ver: status, plano das fases, resultado final e tempo.

import { signedInSession } from "@/lib/auth/session";
import { isRunId } from "@/lib/runs/parse-request";
import { loadOwnRun } from "@/lib/runs/store";

export async function GET(_request: Request, context: RouteContext<"/api/runs/[id]">): Promise<Response> {
  const { id } = await context.params;
  const session = await signedInSession();
  if (!session) return problem(401, "Entre de novo para ver esta execução.");
  if (!isRunId(id)) return problem(404, "Execução não encontrada.");

  try {
    const run = await loadOwnRun(session, id);
    if (!run) return problem(404, "Execução não encontrada.");
    return Response.json(
      { status: run.status, plan: run.plan, result: run.result, durationMs: run.duration_ms },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(`[api/runs] Falha ao carregar a execução ${id}:`, error);
    return problem(500, "Algo deu errado do nosso lado.");
  }
}

function problem(status: number, message: string): Response {
  return Response.json({ problems: [message] }, { status, headers: { "Cache-Control": "no-store" } });
}

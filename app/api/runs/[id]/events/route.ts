// GET /api/runs/[id]/events?after=<seq>: as novidades da narração (eventos com posição maior que <seq>, em ordem) e
// o status da execução. É o replay (do início, com after=0) e a busca de novidades que a tela faz a cada segundo.
// Lido com a sessão de quem está logado: só a própria pessoa lê a narração dela.
// Cada busca também confere se a execução parou no meio e, se parou, a retoma (lib/runs/resume.ts).

import { signedInSession } from "@/lib/auth/session";
import { isRunId } from "@/lib/runs/parse-request";
import { resumeIfStalled } from "@/lib/runs/resume";
import { EVENTS_PAGE_SIZE, loadOwnEventsAfter, loadOwnRun } from "@/lib/runs/store";

export async function GET(request: Request, context: RouteContext<"/api/runs/[id]/events">): Promise<Response> {
  const { id } = await context.params;
  const session = await signedInSession();
  if (!session) return problem(401, "Entre de novo para acompanhar esta execução.");
  if (!isRunId(id)) return problem(404, "Execução não encontrada.");

  const after = Number(new URL(request.url).searchParams.get("after"));
  const afterSeq = Number.isFinite(after) && after > 0 ? Math.floor(after) : 0;

  try {
    // O status vem ANTES dos eventos: o servidor grava a narração inteira antes de marcar o fim, então, se o status
    // já é de fim, os eventos lidos logo depois trazem tudo até o fim.
    const run = await loadOwnRun(session, id);
    if (!run) return problem(404, "Execução não encontrada.");
    const events = await loadOwnEventsAfter(session, id, afterSeq);

    if (run.status === "queued" || run.status === "running") {
      // Se a conferência falhar, as novidades saem do mesmo jeito.
      await resumeIfStalled(id).catch((error) => {
        console.error(`[api/runs/events] Não consegui conferir se ${id} parou:`, error);
      });
    }

    return Response.json(
      { status: run.status, events, more: events.length === EVENTS_PAGE_SIZE },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(`[api/runs/events] Falha ao carregar os eventos de ${id}:`, error);
    return problem(500, "Algo deu errado do nosso lado.");
  }
}

function problem(status: number, message: string): Response {
  return Response.json({ problems: [message] }, { status, headers: { "Cache-Control": "no-store" } });
}

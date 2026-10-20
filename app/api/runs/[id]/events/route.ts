// GET /api/runs/[id]/events?after=<seq>: os eventos da narração com posição (seq) maior que <seq>, em ordem.
// É o "replay" (do início, com after=0) e a pesca (polling) do navegador, e a base do acompanhamento ao vivo.
// A tabela run_events é lida por qualquer um que tenha o id (UUID) da execução: o id funciona como senha.

import { loadEventsAfter } from "@/lib/runs/store";

export async function GET(request: Request, context: RouteContext<"/api/runs/[id]/events">): Promise<Response> {
  const { id } = await context.params;
  const afterParam = new URL(request.url).searchParams.get("after");
  const after = Number(afterParam);
  const afterSeq = Number.isFinite(after) && after > 0 ? Math.floor(after) : 0;

  try {
    const events = await loadEventsAfter(id, afterSeq);
    return Response.json({ events }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(`[api/runs/events] Falha ao carregar os eventos de ${id}:`, error);
    return Response.json({ events: [] }, { status: 500 });
  }
}

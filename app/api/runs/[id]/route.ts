// GET /api/runs/[id]: o resumo da execução que a tela precisa para montar e retomar o acompanhamento.
// Só o que o usuário pode ver: status, plano das fases, resultado final e tempo. Nada de colunas internas
// (hash do dono, chaves, erro técnico, reserva...).

import { loadRun } from "@/lib/runs/store";

export async function GET(_request: Request, context: RouteContext<"/api/runs/[id]">): Promise<Response> {
  const { id } = await context.params;

  try {
    const run = await loadRun(id);
    if (!run) return Response.json({ problems: ["Execução não encontrada."] }, { status: 404 });
    return Response.json(
      { status: run.status, plan: run.plan, result: run.result, durationMs: run.duration_ms },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(`[api/runs] Falha ao carregar a execução ${id}:`, error);
    return Response.json({ problems: ["Algo deu errado do nosso lado."] }, { status: 500 });
  }
}

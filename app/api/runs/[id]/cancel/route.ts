// POST /api/runs/[id]/cancel { pageMemberId }: a pessoa cancelou a própria execução.
// Só quem começou cancela: a execução é procurada com a sessão de quem está logado (a de outra pessoa nem aparece),
// e o login tem de ser o de quem abriu a página (F34). Marca 'cancelled' e anexa um evento de cancelamento à narração.
// Quem estiver rodando a fase percebe em poucos segundos e para a IA no meio; a corrente de fases para junto.

import { checkPageMember, PAGE_MEMBER_FIELD } from "@/lib/auth/page-member";
import { createSessionClient } from "@/lib/auth/session";
import { getViewer } from "@/lib/auth/viewer";
import { getRecipe } from "@/lib/recipes/catalog";
import { stageSteps } from "@/lib/recipes/types";
import { isPlainObject, isRunId } from "@/lib/runs/parse-request";
import { appendEvents, cancelRun, FINAL_STATUSES, loadOwnRun } from "@/lib/runs/store";

export async function POST(request: Request, context: RouteContext<"/api/runs/[id]/cancel">): Promise<Response> {
  const { id } = await context.params;

  // Só aceita JSON, como a rota de começar: outro site não consegue cancelar pelo navegador de alguém.
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) return problem(415, "Formato de pedido não aceito.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problem(400, "Não entendemos o pedido enviado.");
  }

  const check = checkPageMember(await getViewer(), isPlainObject(body) ? body[PAGE_MEMBER_FIELD] : undefined);
  if (!check.ok) return problem(check.status, check.message);

  const session = await createSessionClient();
  if (!session || !isRunId(id)) return problem(404, "Execução não encontrada.");

  try {
    // Pela sessão: só aparece se a execução for de quem está logado.
    const run = await loadOwnRun(session, id);
    if (!run) return problem(404, "Execução não encontrada.");

    // Já acabou? Nada a fazer; devolve o status atual.
    if (FINAL_STATUSES.includes(run.status)) return Response.json({ status: run.status });

    if (await cancelRun(id)) {
      await appendEvents(
        { id, company_id: check.me.companyId },
        [{ type: "run-cancelled", stepId: cancelledStepId(run.recipe_id, run.cursor.stageIndex) }],
      );
    }
    return Response.json({ status: "cancelled" });
  } catch (error) {
    console.error(`[api/runs/cancel] Falha ao cancelar ${id}:`, error);
    return problem(500, "Não deu para cancelar agora. Tente de novo.");
  }
}

/** A etapa que a tela marca como parada: a primeira da fase em que a execução estava. */
function cancelledStepId(recipeId: string, stageIndex: number): string {
  const recipe = getRecipe(recipeId);
  const stage = recipe?.stages[stageIndex];
  return stage ? stageSteps(stage)[0].id : "";
}

function problem(status: number, message: string): Response {
  return Response.json({ problems: [message] }, { status });
}

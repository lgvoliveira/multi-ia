// POST /api/runs/[id]/resume { pageMemberId }: a pessoa apertou "Continuar" numa execução pausada (o custo ia passar
// do que foi reservado). Fecha a reserva antiga e reserva o máximo que ainda falta gastar, calculado aqui de novo; o
// banco confere de novo o saldo e o teto do mês. Deu certo: a execução volta para a fila e o time segue. Recusou: ela
// continua pausada, e a tela mostra o que fazer.
// Só quem começou continua (a execução é procurada com a sessão de quem está logado), e o login tem de ser o de quem
// abriu a página (F34). Parar, em vez de continuar, é o cancelamento de sempre (/api/runs/[id]/cancel).

import { checkPageMember, PAGE_MEMBER_FIELD } from "@/lib/auth/page-member";
import { createSessionClient } from "@/lib/auth/session";
import { getViewer } from "@/lib/auth/viewer";
import { getRecipe } from "@/lib/recipes/catalog";
import { estimateCents, stepCosts } from "@/lib/runs/estimate";
import { isPlainObject, isRunId } from "@/lib/runs/parse-request";
import { appendEvents, loadOwnRun, lockPausedRun, requeuePausedRun, unlockPausedRun } from "@/lib/runs/store";
import { triggerContinue } from "@/lib/runs/trigger";
import { closeRunHolds, reserveForRun, WalletRefusedError, walletRefusalMessage } from "@/lib/runs/wallet";

export async function POST(request: Request, context: RouteContext<"/api/runs/[id]/resume">): Promise<Response> {
  const { id } = await context.params;

  // Só aceita JSON, como as rotas de começar e cancelar: outro site não consegue continuar pelo navegador de alguém.
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
  const { me } = check;

  const session = await createSessionClient();
  if (!session || !isRunId(id)) return problem(404, "Execução não encontrada.");

  try {
    // Pela sessão: só aparece se a execução for de quem está logado.
    const own = await loadOwnRun(session, id);
    if (!own) return problem(404, "Execução não encontrada.");
    // Não está pausada (já continuou, acabou ou foi cancelada): nada a fazer; devolve o status atual.
    if (own.status !== "paused") return Response.json({ status: own.status });

    const recipe = getRecipe(own.recipe_id);
    if (!recipe) return problem(404, "Execução não encontrada.");

    // Outro clique em "Continuar" já está reservando: este não faz nada.
    const row = await lockPausedRun(id);
    if (!row) return Response.json({ status: "paused" });

    // O máximo que ainda falta, com o time de agora (uma IA reserva pode ter assumido um papel).
    const needed = estimateCents(stepCosts(recipe, row.cursor), row.team);
    try {
      // A reserva antiga fecha antes: o que sobrou dela volta ao saldo e entra na conta da nova.
      await closeRunHolds(id);
      await reserveForRun(me.id, id, needed);
    } catch (error) {
      await unlockPausedRun(id);
      if (error instanceof WalletRefusedError) {
        return problem(402, walletRefusalMessage(error.reason, me.role === "owner", needed));
      }
      throw error;
    }

    // A narração vai antes da mudança de status (a tela confia nessa ordem).
    await appendEvents(row, [{ type: "run-resumed" }]);
    if (!(await requeuePausedRun(id))) {
      // A pessoa cancelou enquanto reservávamos: a reserva nova volta ao saldo.
      await closeRunHolds(id);
      return Response.json({ status: "cancelled" });
    }
    triggerContinue(id);
    return Response.json({ status: "queued" });
  } catch (error) {
    console.error(`[api/runs/resume] Falha ao continuar ${id}:`, error);
    return problem(500, "Não deu para continuar agora. Tente de novo.");
  }
}

function problem(status: number, message: string): Response {
  return Response.json({ problems: [message] }, { status });
}

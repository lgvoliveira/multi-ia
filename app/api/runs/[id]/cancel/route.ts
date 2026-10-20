// POST /api/runs/[id]/cancel { ownerToken }: a pessoa cancelou a própria execução.
// Só o dono cancela: confere o hash do token contra o guardado (o id sozinho não basta para cancelar).
// Marca 'cancelled' e anexa um evento de cancelamento à narração, para quem acompanha ver na hora.
// A corrente de segmentos para sozinha: o próximo /continue não reivindica uma execução 'cancelled'.

import { createHash } from "node:crypto";
import { stageSteps } from "@/lib/recipes/types";
import { getRecipe } from "@/lib/recipes/catalog";
import { appendEvents, loadRun, setStatus } from "@/lib/runs/store";

export async function POST(request: Request, context: RouteContext<"/api/runs/[id]/cancel">): Promise<Response> {
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ problems: ["Não entendemos o pedido enviado."] }, { status: 400 });
  }
  const ownerToken = readOwnerToken(body);

  const run = await loadRun(id);
  if (!run) return Response.json({ problems: ["Execução não encontrada."] }, { status: 404 });

  // Confere o dono. Sem bater, ninguém cancela a execução de outra pessoa.
  if (!ownerToken || sha256(ownerToken) !== run.owner_token) {
    return Response.json({ problems: ["Você não pode cancelar esta execução."] }, { status: 403 });
  }

  // Já acabou? Nada a fazer; devolve o status atual.
  if (run.status === "finished" || run.status === "failed" || run.status === "cancelled") {
    return Response.json({ status: run.status });
  }

  await setStatus(id, "cancelled", { finished_at: new Date().toISOString(), lease_until: null });
  await appendEvents(id, [{ type: "run-cancelled", stepId: cancelledStepId(run.recipe_id, run.cursor.stageIndex) }]);
  return Response.json({ status: "cancelled" });
}

/** A etapa que a tela marca como parada: a primeira da fase em que a execução estava. */
function cancelledStepId(recipeId: string, stageIndex: number): string {
  const recipe = getRecipe(recipeId);
  const stage = recipe?.stages[stageIndex];
  return stage ? stageSteps(stage)[0].id : "";
}

function readOwnerToken(body: unknown): string {
  if (typeof body === "object" && body !== null && "ownerToken" in body) {
    const value = (body as { ownerToken: unknown }).ownerToken;
    if (typeof value === "string") return value;
  }
  return "";
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

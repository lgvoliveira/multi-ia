// POST /api/runs: cria uma execução PERSISTIDA, em nome de quem está logado, e dispara o primeiro segmento. Não roda
// nada aqui dentro: devolve só o id. O navegador acompanha depois buscando as novidades (lib/runs/live-client.ts),
// e a execução roda em chamadas curtas e separadas em /api/runs/[id]/continue, sobrevivendo ao navegador sair.
// Só para quem é da empresa e está ativo; a empresa e a pessoa vêm do login, nunca do pedido.
// Pedido inválido não começa: volta na hora, com a lista de problemas em português.

import { checkPageMember, PAGE_MEMBER_FIELD } from "@/lib/auth/page-member";
import { getViewer } from "@/lib/auth/viewer";
import { resolveTeam } from "@/lib/engine/run";
import type { ProviderId } from "@/lib/providers/types";
import { stageSteps, type Recipe } from "@/lib/recipes/types";
import { isPlainObject, parseRunRequest, type RunRefusalBody } from "@/lib/runs/parse-request";
import type { PublicPlannedStage } from "@/lib/runs/public-events";
import { createRun } from "@/lib/runs/store";
import { triggerContinue } from "@/lib/runs/trigger";

// Esta chamada só cria a execução e dispara o primeiro segmento: é curta por natureza.
export const maxDuration = 15;

/** Tamanho máximo do corpo do pedido. Folga grande: um pedido de 4.000 caracteres ocupa bem menos. */
const MAX_BODY_SIZE = 64 * 1024;

export async function POST(request: Request): Promise<Response> {
  // Só aceita JSON. Isso também impede que outro site dispare execuções pelo navegador de alguém.
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return refuse(415, ["Formato de pedido não aceito."]);
  }
  if (Number(request.headers.get("content-length")) > MAX_BODY_SIZE) {
    return refuse(413, ["O pedido é grande demais."]);
  }

  const text = await request.text();
  if (text.length > MAX_BODY_SIZE) return refuse(413, ["O pedido é grande demais."]);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return refuse(400, ["Não entendemos o pedido enviado."]);
  }

  // Quem pede: logado, da empresa, ativo, e o mesmo que abriu a página (F34).
  const check = checkPageMember(await getViewer(), isPlainObject(body) ? body[PAGE_MEMBER_FIELD] : undefined);
  if (!check.ok) return refuse(check.status, [check.message]);
  const { me } = check;

  const parsed = parseRunRequest(body);
  if (!parsed.ok) return refuse(400, parsed.problems);

  const { recipe, request: userRequest, team: teamChoice } = parsed.input;
  // IA de cada papel já decidida (a escolhida ou a sugerida): guardada e usada do começo ao fim.
  const team = resolveTeam(recipe, teamChoice);

  let runId: string;
  try {
    runId = await createRun({
      company_id: me.companyId,
      member_id: me.id,
      recipe_id: recipe.id,
      request: userRequest.trim(),
      team,
      plan: buildPlan(recipe, team),
    });
  } catch (error) {
    console.error("[api/runs] Não consegui criar a execução:", error);
    return refuse(500, ["Algo deu errado do nosso lado. Tente de novo daqui a pouco."]);
  }

  // Dispara o primeiro segmento (dispara e esquece); se a chamada se perder, a tela retoma depois.
  triggerContinue(runId);
  return Response.json({ runId }, { status: 201 });
}

/** Monta o plano público das fases: tipo de cada fase e a IA decidida para cada etapa. */
function buildPlan(recipe: Recipe, team: Record<string, ProviderId>): PublicPlannedStage[] {
  return recipe.stages.map((stage) => ({
    stageId: stage.id,
    kind: stage.kind,
    steps: stageSteps(stage).map((step) => ({ stepId: step.id, provider: step.provider ?? team[step.roleId] })),
  }));
}

function refuse(status: number, problems: string[]): Response {
  return Response.json({ problems } satisfies RunRefusalBody, { status });
}

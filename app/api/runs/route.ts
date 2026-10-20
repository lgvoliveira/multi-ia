// POST /api/runs: cria uma execução PERSISTIDA e dispara o primeiro segmento. Não roda nada aqui dentro
// nem transmite narração: devolve só o id da execução. O navegador acompanha depois pelo Realtime/replay
// (ver lib/runs/live-client.ts). A execução roda em chamadas curtas e separadas em /api/runs/[id]/continue,
// sobrevivendo ao navegador sair e cabendo no teto de tempo da função.
// Pedido inválido não começa: volta na hora, com a lista de problemas em português.

import { createHash } from "node:crypto";
import { resolveTeam } from "@/lib/engine/run";
import type { ProviderId } from "@/lib/providers/types";
import { stageSteps, type Recipe } from "@/lib/recipes/types";
import { encryptKeys } from "@/lib/runs/crypto";
import { parseRunRequest, type RunRefusalBody } from "@/lib/runs/parse-request";
import type { PublicPlannedStage } from "@/lib/runs/public-events";
import { createRun, saveSecret } from "@/lib/runs/store";
import { originFromRequest, triggerContinue } from "@/lib/runs/trigger";

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

  const parsed = parseRunRequest(body);
  if (!parsed.ok) return refuse(400, parsed.problems);

  const { recipe, request: userRequest, team: teamChoice } = parsed.input;
  // IA de cada papel já decidida (a escolhida ou a sugerida): guardada e usada do começo ao fim.
  const team = resolveTeam(recipe, teamChoice);
  const plan = buildPlan(recipe, team);
  // Só guardamos o hash do token do dono: dá para conferir quem pode cancelar, sem guardar o token em si.
  const ownerToken = readOwnerToken(body);

  let runId: string;
  try {
    runId = await createRun({
      owner_token: sha256(ownerToken),
      recipe_id: recipe.id,
      request: userRequest.trim(),
      team,
      plan,
    });
    // Chaves do usuário só quando ele conectou alguma: guardadas criptografadas e apagadas ao fim da execução.
    if (Object.keys(parsed.keys).length > 0) {
      await saveSecret(runId, encryptKeys(parsed.keys));
    }
  } catch (error) {
    console.error("[api/runs] Não consegui criar a execução:", error);
    return refuse(500, ["Algo deu errado do nosso lado. Tente de novo daqui a pouco."]);
  }

  // Dispara o primeiro segmento (dispara e esquece); se a chamada se perder, o varredor retoma depois.
  triggerContinue(runId, originFromRequest(request));
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

/** Lê o token do dono do corpo do pedido, se veio em formato válido. */
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

function refuse(status: number, problems: string[]): Response {
  return Response.json({ problems } satisfies RunRefusalBody, { status });
}

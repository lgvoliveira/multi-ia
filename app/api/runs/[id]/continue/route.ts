// POST /api/runs/[id]/continue: roda UM segmento (uma fase) de uma execução persistida e encadeia o próximo.
// É interna: só o próprio servidor chama, com o segredo INTERNAL_RUN_SECRET. O navegador nunca chama isto.
// Fluxo: reivindica a execução → reconstrói o estado do banco → roda um segmento → guarda eventos, etapas
// e o novo estado → se acabou, encerra e apaga as chaves; senão, volta para a fila e dispara a próxima.
// Se algo estourar no meio, a reserva (lease) é deixada intacta: o varredor retoma depois que ela vencer.

import { runSegment } from "@/lib/engine/segment";
import type { RunSnapshot } from "@/lib/engine/types";
import { createGetProvider, type ProviderKeys } from "@/lib/providers/registry";
import { getRecipe } from "@/lib/recipes/catalog";
import { decryptKeys } from "@/lib/runs/crypto";
import { toPublicEvent, type PublicRunEvent } from "@/lib/runs/public-events";
import {
  appendEvents,
  appendSteps,
  claimRun,
  deleteSecret,
  getSecret,
  loadRun,
  saveSnapshot,
  setStatus,
  type RunError,
  type RunRow,
  type StepRow,
} from "@/lib/runs/store";
import { originFromRequest, triggerContinue } from "@/lib/runs/trigger";

// Um segmento pode levar minutos (uma fase com IAs reais): pede o teto de tempo de função.
export const maxDuration = 300;

export async function POST(request: Request, context: RouteContext<"/api/runs/[id]/continue">): Promise<Response> {
  if (request.headers.get("x-internal-secret") !== process.env.INTERNAL_RUN_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await context.params;

  // Reivindica a execução para rodar agora. Se já está rodando em outro lugar (reserva válida) ou acabou, não faz nada.
  const row = await claimRun(id);
  if (!row) return new Response(null, { status: 200 });

  try {
    await runOneSegment(id, row, originFromRequest(request));
    return new Response(null, { status: 200 });
  } catch (error) {
    // Defeito nosso no meio do segmento: NÃO mexe na reserva. O varredor retoma quando ela vencer.
    // Nunca registramos as chaves do usuário: só a mensagem do erro.
    console.error(`[api/runs/continue] Falha ao rodar o segmento de ${id}:`, error);
    return new Response(null, { status: 500 });
  }
}

/** Roda um segmento: reconstrói o estado, executa uma fase, guarda tudo e encadeia a próxima (ou encerra). */
async function runOneSegment(id: string, row: RunRow, originHint?: string): Promise<void> {
  const recipe = getRecipe(row.recipe_id);
  if (!recipe) throw new Error(`Receita desconhecida: "${row.recipe_id}".`);

  const keys = await loadKeys(id);
  const getProvider = createGetProvider(keys);

  const snapshot = hydrate(row);

  const events: PublicRunEvent[] = [];
  const steps: StepRow[] = [];
  let finalResult: string | null = null;
  let finalDurationMs: number | null = null;
  let runError: RunError | null = null;

  const generator = runSegment(snapshot, recipe, { getProvider });
  let next = await generator.next();
  while (!next.done) {
    const event = next.value;
    if (event.type === "step-finished") {
      // Campos internos (modelo, tokens) existem AQUI, antes de toPublicEvent apagá-los: viram o histórico interno.
      steps.push({
        step_id: event.stepId,
        round: event.round ?? 1,
        provider: event.provider,
        model: event.model,
        input_tokens: event.usage.inputTokens,
        output_tokens: event.usage.outputTokens,
        truncated: event.truncated,
        duration_ms: event.durationMs,
        status: "done",
      });
    } else if (event.type === "run-finished") {
      finalResult = event.result;
      finalDurationMs = event.durationMs;
    } else if (event.type === "run-failed") {
      runError = {
        stepId: event.stepId,
        provider: event.provider,
        retryable: event.retryable,
        errorMessage: event.errorMessage,
      };
    }
    events.push(toPublicEvent(event));
    next = await generator.next();
  }
  const updated = next.value;

  // Guarda o histórico interno de etapas e os eventos (em ordem), e então o novo estado.
  await appendSteps(id, steps);
  await appendEvents(id, events);
  await saveSnapshot(id, {
    outputs: updated.outputs,
    results: updated.results,
    team: updated.team,
    cursor: updated.cursor,
  });

  if (updated.done) {
    // Terminou (sucesso, falha ou cancelamento): encerra e apaga as chaves — não as guardamos além do necessário.
    await setStatus(id, updated.status ?? "finished", {
      result: finalResult,
      duration_ms: finalDurationMs,
      finished_at: new Date().toISOString(),
      lease_until: null,
      error: runError,
    });
    await deleteSecret(id);
    return;
  }

  // Ainda há fases. Se a pessoa cancelou enquanto este segmento rodava, para a corrente aqui.
  const fresh = await loadRun(id);
  if (fresh?.status === "cancelled") return;
  // Volta para a fila (libera a reserva) e dispara o próximo segmento.
  await setStatus(id, "queued", { lease_until: null });
  triggerContinue(id, originHint);
}

/** Lê e descriptografa as chaves do usuário; sem chaves (ninguém conectou), roda tudo na IA simulada. */
async function loadKeys(id: string): Promise<ProviderKeys> {
  const blob = await getSecret(id);
  return blob ? decryptKeys(blob) : {};
}

/** Reconstrói o RunSnapshot a partir da linha do banco, para a execução continuar de onde parou. */
function hydrate(row: RunRow): RunSnapshot {
  return {
    recipeId: row.recipe_id,
    request: row.request,
    team: row.team,
    outputs: row.outputs ?? {},
    results: row.results ?? [],
    cursor: row.cursor,
    done: false,
  };
}

// POST /api/runs/[id]/continue: roda UM segmento (uma fase) de uma execução persistida e encadeia o próximo.
// É interna: só o próprio servidor chama, com o segredo interno (lib/runs/internal-secret.ts). O navegador nunca.
// Fluxo: reivindica a execução → reconstrói o estado do banco → roda um segmento, gravando a narração aos poucos
// (F35) → guarda as chamadas às IAs e o novo estado → se acabou, encerra; senão, volta para a fila e dispara a próxima.
// Enquanto a fase roda, renova a reserva a cada poucos segundos e, se a pessoa cancelou, para a IA no meio.
// Se algo estourar no meio, a reserva para de ser renovada e vence logo: a próxima busca da tela retoma a execução.
// Até a parte 3b do PR 3 (estimativa e cobrança), as receitas rodam só com a IA simulada, que não custa nada.

import { runSegment } from "@/lib/engine/segment";
import type { RunEvent, RunSnapshot } from "@/lib/engine/types";
import { getProvider } from "@/lib/providers/registry";
import { getRecipe } from "@/lib/recipes/catalog";
import { createEventBuffer } from "@/lib/runs/event-buffer";
import { isInternalCall } from "@/lib/runs/internal-secret";
import { toPublicEvent } from "@/lib/runs/public-events";
import {
  appendEvents,
  claimRun,
  loadRun,
  recordAiCalls,
  renewLease,
  saveSnapshot,
  setStatus,
  type AiCallRow,
  type RunError,
  type RunRow,
} from "@/lib/runs/store";
import { triggerContinue } from "@/lib/runs/trigger";

// Um segmento pode levar minutos (uma fase com IAs reais): pede o teto de tempo de função.
export const maxDuration = 300;

/** De quanto em quanto tempo quem roda renova a reserva e confere se a pessoa cancelou. */
const HEARTBEAT_MS = 2000;

export async function POST(request: Request, context: RouteContext<"/api/runs/[id]/continue">): Promise<Response> {
  if (!isInternalCall(request)) return new Response("Unauthorized", { status: 401 });

  const { id } = await context.params;

  // Reivindica a execução para rodar agora. Se já está rodando em outro lugar (reserva válida) ou acabou, não faz nada.
  const row = await claimRun(id);
  if (!row) return new Response(null, { status: 200 });
  const claimedAt = Date.now();

  try {
    await runOneSegment(row, claimedAt);
    return new Response(null, { status: 200 });
  } catch (error) {
    // Defeito nosso no meio do segmento: a reserva vence sozinha e a execução é retomada depois.
    console.error(`[api/runs/continue] Falha ao rodar o segmento de ${id}:`, error);
    return new Response(null, { status: 500 });
  }
}

/**
 * Roda um segmento: reconstrói o estado, executa uma fase, guarda tudo e encadeia a próxima (ou encerra).
 * `claimedAt` é quando este servidor reivindicou a execução, no relógio dele.
 */
async function runOneSegment(row: RunRow, claimedAt: number): Promise<void> {
  const recipe = getRecipe(row.recipe_id);
  if (!recipe) throw new Error(`Receita desconhecida: "${row.recipe_id}".`);

  const controller = new AbortController();
  const heartbeat = startHeartbeat(row, controller);
  // Se outro servidor assumiu a execução, nada mais deste segmento é gravado: ele recomeça a fase do zero.
  const narration = createEventBuffer(async (events) => {
    if (heartbeat.lost()) throw new Error("Outro servidor assumiu a execução no meio do segmento.");
    await appendEvents(row, events);
  });
  const aiCalls: AiCallRow[] = [];
  let finalResult: string | null = null;
  let finalDurationMs: number | null = null;
  let runError: RunError | null = null;
  let updated: RunSnapshot;

  try {
    const generator = runSegment(hydrate(row), recipe, { getProvider, signal: controller.signal });
    let next = await generator.next();
    while (!next.done) {
      let event = next.value;
      logFailure(event);
      if (event.type === "step-finished") {
        // Campos internos (modelo, tokens) existem AQUI, antes de toPublicEvent apagá-los: viram o registro interno.
        aiCalls.push({
          company_id: row.company_id,
          member_id: row.member_id,
          run_id: row.id,
          step_id: event.stepId,
          provider: event.provider,
          model: event.model,
          input_tokens: event.usage.inputTokens,
          output_tokens: event.usage.outputTokens,
          status: "ok",
          duration_ms: event.durationMs,
        });
      } else if (event.type === "run-finished") {
        // O motor conta só o tempo deste segmento; a pessoa esperou desde que pediu.
        event = { ...event, durationMs: waitedMs(row, claimedAt) };
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
      narration.push(toPublicEvent(event));
      next = await generator.next();
    }
    updated = next.value;
    // A narração inteira vai para o banco ANTES de o status mudar (a tela confia nessa ordem).
    await narration.flush();
  } finally {
    heartbeat.stop();
  }
  if (heartbeat.lost()) throw new Error("Outro servidor assumiu a execução no meio do segmento.");

  await recordAiCalls(aiCalls);
  await saveSnapshot(row.id, {
    outputs: updated.outputs,
    results: updated.results,
    team: updated.team,
    cursor: updated.cursor,
  });

  if (updated.done) {
    // Terminou (sucesso, falha ou cancelamento): encerra.
    await setStatus(row.id, updated.status ?? "finished", {
      result: finalResult,
      duration_ms: finalDurationMs,
      finished_at: new Date().toISOString(),
      lease_until: null,
      error: runError,
    });
    return;
  }

  // Ainda há fases. Se a pessoa cancelou enquanto este segmento rodava, para a corrente aqui.
  const fresh = await loadRun(row.id);
  if (fresh?.status === "cancelled") return;
  // Volta para a fila (libera a reserva) e dispara o próximo segmento.
  await setStatus(row.id, "queued", { lease_until: null });
  triggerContinue(row.id);
}

/**
 * Renova a reserva a cada poucos segundos enquanto a fase roda. Se a pessoa cancelou, para a IA no meio: o motor narra
 * o cancelamento e devolve o estado. Se outro servidor pegou a execução (a reserva venceu antes), para também, e
 * `lost()` passa a dizer que nada deste segmento deve ser gravado.
 */
function startHeartbeat(row: RunRow, controller: AbortController): { stop: () => void; lost: () => boolean } {
  let lost = false;
  const timer = setInterval(async () => {
    try {
      // row.attempt já é o número desta reivindicação (claimRun devolve a linha depois de somar 1).
      const status = await renewLease(row.id, row.attempt);
      if (status === null) lost = true;
      if (status === null || status === "cancelled") controller.abort();
    } catch (error) {
      // Sem conseguir renovar agora: tenta de novo no próximo intervalo.
      console.error(`[api/runs/continue] Não consegui renovar a reserva de ${row.id}:`, error);
    }
  }, HEARTBEAT_MS);
  return { stop: () => clearInterval(timer), lost: () => lost };
}

/**
 * Quanto a pessoa esperou, do pedido até agora. O pedido (created_at) e a reivindicação (updated_at, gravado pelo
 * banco no claimRun) vêm do relógio do banco; o tempo desde a reivindicação vem do relógio deste servidor. Assim,
 * um relógio do servidor adiantado ou atrasado em relação ao do banco não muda a conta.
 */
function waitedMs(row: RunRow, claimedAt: number): number {
  const untilClaim = Date.parse(row.updated_at) - Date.parse(row.created_at);
  return Math.max(0, untilClaim + (Date.now() - claimedAt));
}

/** Registra no terminal do servidor cada falha de IA, com a mensagem técnica (a tela nunca a recebe). */
function logFailure(event: RunEvent): void {
  switch (event.type) {
    case "step-retrying":
      console.warn(
        `[api/runs] A etapa "${event.stepId}" falhou (${event.provider}); ` +
          `tentativa ${event.attempt} daqui a ${event.delayMs} ms: ${event.errorMessage}`,
      );
      return;
    case "step-switched":
      console.warn(
        `[api/runs] A etapa "${event.stepId}" falhou (${event.from}); ` +
          `${event.to} assumiu o papel "${event.roleId}": ${event.errorMessage}`,
      );
      return;
    case "run-failed":
      console.error(`[api/runs] A etapa "${event.stepId}" falhou (${event.provider}): ${event.errorMessage}`);
      return;
  }
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

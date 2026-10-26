// POST /api/runs/[id]/continue: roda UM segmento (uma fase) de uma execução persistida e encadeia o próximo.
// É interna: só o próprio servidor chama, com o segredo interno (lib/runs/internal-secret.ts). O navegador nunca.
// Fluxo: reivindica a execução → confere a reserva na carteira (sem o bastante para o que falta, pausa e pergunta) →
// roda um segmento, gravando a narração aos poucos (F35) → grava o novo estado → cobra as etapas concluídas e registra
// todas as chamadas às IAs → se acabou, guarda o site pronto como entrega da pessoa (F47), fecha a reserva e encerra;
// senão, volta para a fila e dispara a próxima.
// Enquanto a fase roda, renova a reserva de quem roda a cada poucos segundos e, se a pessoa cancelou, para a IA no meio.
// Se algo estourar no meio, a reserva de quem roda vence logo e a próxima busca da tela retoma a execução.
// As receitas rodam com a IA simulada, que custa o mesmo que a IA de verdade equivalente (as reais entram num PR
// próprio, antes da compra de créditos).

import { runSegment } from "@/lib/engine/segment";
import type { AiCallReport, RunEvent, RunSnapshot } from "@/lib/engine/types";
import { getProvider } from "@/lib/providers/registry";
import { getRecipe } from "@/lib/recipes/catalog";
import type { Recipe } from "@/lib/recipes/types";
import { aiCallRows, chargeCompletedSteps } from "@/lib/runs/billing";
import { estimateCents, stepCosts } from "@/lib/runs/estimate";
import { createEventBuffer } from "@/lib/runs/event-buffer";
import { isInternalCall } from "@/lib/runs/internal-secret";
import { toPublicEvent } from "@/lib/runs/public-events";
import { finalSite, saveSiteDelivery } from "@/lib/runs/site-delivery";
import {
  appendEvents,
  claimRun,
  recordAiCalls,
  releaseRun,
  renewLease,
  saveSnapshot,
  setStatus,
  type RunError,
  type RunRow,
} from "@/lib/runs/store";
import { triggerContinue } from "@/lib/runs/trigger";
import { closeRunHolds, findOpenRunHold, holdRemainingCents, type RunHold } from "@/lib/runs/wallet";

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
 * Roda um segmento: confere o dinheiro reservado, reconstrói o estado, executa uma fase, guarda tudo, cobra e encadeia
 * a próxima (ou encerra). `claimedAt` é quando este servidor reivindicou a execução, no relógio dele.
 */
async function runOneSegment(row: RunRow, claimedAt: number): Promise<void> {
  const recipe = getRecipe(row.recipe_id);
  if (!recipe) throw new Error(`Receita desconhecida: "${row.recipe_id}".`);

  // Todas as fases já rodaram: o servidor caiu entre gravar a última e encerrar. Cobra o que faltou e só encerra.
  if (row.cursor.stageIndex >= recipe.stages.length) {
    await finishInterruptedRun(row, recipe, claimedAt);
    return;
  }

  // Nenhuma IA trabalha sem dinheiro reservado para o que falta. Se não há, pausa e pergunta (AGENTS.md, seção 5).
  const hold = await settleBeforeSegment(row, recipe);
  if (!hold) return;

  const controller = new AbortController();
  const heartbeat = startHeartbeat(row, controller);
  // Se outro servidor assumiu a execução, nada mais deste segmento é gravado: ele recomeça a fase do zero.
  const narration = createEventBuffer(async (events) => {
    if (heartbeat.lost()) throw new Error("Outro servidor assumiu a execução no meio do segmento.");
    await appendEvents(row, events);
  });
  // Toda chamada às IAs, inclusive as que falharam: o custo real, cobrado ou não (F26).
  const calls: AiCallReport[] = [];
  let finalResult: string | null = null;
  let finalDurationMs: number | null = null;
  let runError: RunError | null = null;
  let updated: RunSnapshot;

  try {
    const generator = runSegment(hydrate(row), recipe, {
      getProvider,
      signal: controller.signal,
      onAiCall: (call) => calls.push(call),
    });
    let next = await generator.next();
    while (!next.done) {
      let event = next.value;
      logFailure(event);
      if (event.type === "run-finished") {
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

  // Grava o estado ANTES de cobrar: se o servidor cair entre os dois, a fase não roda de novo, e a próxima chamada
  // cobra o que faltou (chargeCompletedSteps). Assim nenhuma etapa é cobrada duas vezes.
  const saved = await saveSnapshot(row.id, row.attempt, {
    outputs: updated.outputs,
    results: updated.results,
    team: updated.team,
    cursor: updated.cursor,
  });
  if (!saved) throw new Error("Outro servidor assumiu a execução antes de gravar o segmento.");

  const charged = await chargeCompletedSteps(row.id, recipe, updated.results, hold.id);
  await recordAiCalls(aiCallRows(row, calls, new Set(charged.map((result) => result.stepId))));

  if (updated.done) {
    // Terminou (sucesso, falha ou cancelamento): encerra e devolve ao saldo o que sobrou da reserva. O site vai para as
    // entregas antes de a execução aparecer como terminada, para a aba Entregas já o mostrar quando a tela avisar.
    const status = updated.status ?? "finished";
    if (status === "finished") await keepSiteQuietly(row, recipe, finalResult);
    await setStatus(row.id, status, {
      result: finalResult,
      duration_ms: finalDurationMs,
      finished_at: new Date().toISOString(),
      lease_until: null,
      error: runError,
    });
    await closeHoldsQuietly(row.id);
    return;
  }

  // Ainda há fases: volta para a fila (libera a reserva de quem roda) e dispara o próximo segmento. Se não deu, a
  // pessoa cancelou enquanto este segmento rodava: a corrente para aqui, e o que sobrou da reserva volta ao saldo.
  if (!(await releaseRun(row.id, row.attempt, "queued"))) {
    await closeHoldsQuietly(row.id);
    return;
  }
  triggerContinue(row.id);
}

/**
 * Antes de rodar uma fase: cobra o que ficou sem cobrar (se o servidor caiu entre gravar a fase anterior e cobrar) e
 * confere se a reserva aberta cobre o máximo que ainda falta gastar, com o time de agora (uma IA reserva mais cara
 * pode ter assumido um papel). Se não cobre, ou se não há reserva válida, pausa a execução e devolve null.
 */
async function settleBeforeSegment(row: RunRow, recipe: Recipe): Promise<RunHold | null> {
  let hold = await findOpenRunHold(row.id);
  if (hold && (await chargeCompletedSteps(row.id, recipe, row.results ?? [], hold.id)).length > 0) {
    hold = await findOpenRunHold(row.id);
  }

  const neededCents = estimateCents(stepCosts(recipe, row.cursor), row.team);
  // Reserva vencida (a execução ficou parada mais de uma hora) já não segura o saldo: precisa reservar de novo.
  const valid = hold !== null && Date.parse(hold.expiresAt) > Date.now();
  if (hold && valid && holdRemainingCents(hold) >= neededCents) return hold;

  // A narração do pedido de pausa vai antes da mudança de status (a tela confia nessa ordem).
  await appendEvents(row, [{ type: "run-paused", neededCents }]);
  // Não deu para pausar: a pessoa cancelou neste instante. O que sobrou da reserva volta ao saldo.
  if (!(await releaseRun(row.id, row.attempt, "paused"))) await closeHoldsQuietly(row.id);
  return null;
}

/**
 * Encerra a execução cujas fases já rodaram todas, mas que não chegou a ser encerrada (o servidor caiu no meio do
 * caminho). A narração do fim já está gravada (ela vai antes do estado); falta cobrar, fechar a reserva e o status.
 */
async function finishInterruptedRun(row: RunRow, recipe: Recipe, claimedAt: number): Promise<void> {
  const hold = await findOpenRunHold(row.id);
  if (hold) await chargeCompletedSteps(row.id, recipe, row.results ?? [], hold.id);
  const result = row.results.at(-1)?.output ?? null;
  await keepSiteQuietly(row, recipe, result);
  await setStatus(row.id, "finished", {
    result,
    duration_ms: waitedMs(row, claimedAt),
    finished_at: new Date().toISOString(),
    lease_until: null,
  });
  await closeHoldsQuietly(row.id);
}

/**
 * Guarda o site pronto nas entregas da pessoa (F47). Se não der, a execução termina assim mesmo: o site continua na tela
 * do resultado, com o botão de baixar; só não aparece em Entregas.
 */
async function keepSiteQuietly(row: RunRow, recipe: Recipe, result: string | null): Promise<void> {
  const site = finalSite(recipe, result);
  if (!site) return;
  try {
    await saveSiteDelivery(row, site);
  } catch (error) {
    console.error(`[api/runs/continue] Não consegui guardar o site de ${row.id} nas entregas:`, error);
  }
}

/** Fecha as reservas da execução. Se falhar, a reserva vence sozinha em uma hora e deixa de segurar o saldo. */
async function closeHoldsQuietly(runId: string): Promise<void> {
  try {
    await closeRunHolds(runId);
  } catch (error) {
    console.error(`[api/runs/continue] Não consegui fechar a reserva de ${runId}:`, error);
  }
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

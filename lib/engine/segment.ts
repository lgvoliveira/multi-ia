// Executa a receita UMA unidade de cada vez, a partir de um RunSnapshot, e devolve o estado atualizado.
// Uma unidade é uma fase sequencial, uma fase em paralelo ou UMA rodada de revisão. Guardando o snapshot
// que sai daqui e alimentando a próxima chamada com ele, dá para parar e continuar a execução depois —
// a base para, num commit futuro, retomar uma execução entre chamadas diferentes do servidor.
// Por enquanto nada é persistido: o snapshot só vive na memória.

import { stageSteps, type Recipe } from "@/lib/recipes/types";
import {
  describeError,
  firstStepId,
  hydrateContext,
  planStages,
  resolveTeam,
  runParallelStage,
  runReviewRound,
  runSequentialStage,
  StageStepError,
  sumUsage,
  type RunOptions,
  type StageContext,
} from "./run";
import type { RunCursor, RunEvent, RunInput, RunSnapshot } from "./types";

/** O estado de partida de uma execução: nada rodou ainda, o cursor aponta para a 1ª fase. */
export function initialSnapshot(input: RunInput): RunSnapshot {
  return {
    recipeId: input.recipe.id,
    request: input.request.trim(),
    team: resolveTeam(input.recipe, input.team),
    outputs: {},
    results: [],
    cursor: { stageIndex: 0, round: 1 },
    done: false,
  };
}

/**
 * Roda UMA unidade a partir do cursor do snapshot e devolve o snapshot atualizado.
 * - No primeiro segmento (cursor na 1ª fase, nada concluído), anuncia o começo com o plano das fases.
 * - Despacha a fase do cursor: sequencial/paralela rodam inteiras e o cursor avança uma fase; a revisão roda
 *   uma rodada e, se aprovou ou esgotou as rodadas, avança — senão fica na mesma fase, na rodada seguinte.
 * - Quando o cursor passa da última fase, marca `done` e narra o resultado final (`run-finished`).
 * - Se uma IA falhar (ou o usuário cancelar), narra a falha/cancelamento, marca `done` e o `status`.
 * A ordem dos eventos é exatamente a de `runRecipe`: ele é só um laço sobre esta função (veja o teste de equivalência).
 */
export async function* runSegment(
  snapshot: RunSnapshot,
  recipe: Recipe,
  options: RunOptions,
): AsyncGenerator<RunEvent, RunSnapshot> {
  const now = options.now ?? Date.now;
  const { signal } = options;
  const segmentStartedAt = now();
  const context = hydrateContext(snapshot, recipe, options);
  const { cursor } = snapshot;

  // Primeiro segmento: anuncia o começo da execução com o plano de cada fase.
  if (cursor.stageIndex === 0 && context.results.length === 0) {
    yield { type: "run-started", recipeId: recipe.id, stages: planStages(context) };
  }

  const stage = recipe.stages[cursor.stageIndex];

  // Cancelou antes de rodar esta fase: para e aponta a etapa que ia começar.
  if (signal?.aborted) {
    yield { type: "run-cancelled", stepId: firstStepId(stage) };
    return serialize(context, cursor, true, "cancelled");
  }

  let nextCursor: RunCursor;
  try {
    switch (stage.kind) {
      case "sequential":
        yield* runSequentialStage(context, stage, 1);
        nextCursor = { stageIndex: cursor.stageIndex + 1, round: 1 };
        break;
      case "parallel":
        yield* runParallelStage(context, stage, 1);
        nextCursor = { stageIndex: cursor.stageIndex + 1, round: 1 };
        break;
      case "review": {
        const { approved } = yield* runReviewRound(context, stage, cursor.round);
        // Aprovou ou esgotou as rodadas: segue em frente. Senão, repete a revisão na rodada seguinte.
        nextCursor =
          approved || cursor.round >= stage.maxRounds
            ? { stageIndex: cursor.stageIndex + 1, round: 1 }
            : { stageIndex: cursor.stageIndex, round: cursor.round + 1 };
        break;
      }
      default: {
        // Tipo de fase desconhecido: nunca deveria acontecer (os testes da receita barram).
        const exhaustive: never = stage;
        throw new Error(`Fase desconhecida: ${JSON.stringify(exhaustive)}`);
      }
    }
  } catch (error) {
    // Se foi o usuário quem cancelou, o erro é só a IA parando de escrever: não é falha.
    const stepId = error instanceof StageStepError ? error.stepId : firstStepId(stage);
    if (signal?.aborted) {
      yield { type: "run-cancelled", stepId };
      return serialize(context, cursor, true, "cancelled");
    }
    if (error instanceof StageStepError) {
      yield { type: "run-failed", stepId, provider: error.provider, ...describeError(error.cause) };
    } else {
      // Erro fora de uma etapa (raro, defeito nosso): aponta a primeira etapa da fase.
      const roleId = stageSteps(stage)[0].roleId;
      yield { type: "run-failed", stepId, provider: context.team[roleId], ...describeError(error) };
    }
    return serialize(context, cursor, true, "failed");
  }

  // Passou da última fase: entrega o resultado final.
  if (nextCursor.stageIndex === recipe.stages.length) {
    const { results } = context;
    yield {
      type: "run-finished",
      result: results[results.length - 1].output,
      steps: results,
      usage: sumUsage(results),
      durationMs: now() - segmentStartedAt,
    };
    return serialize(context, nextCursor, true, "finished");
  }

  return serialize(context, nextCursor, false);
}

/** Converte o estado interno (StageContext) de volta num RunSnapshot: o mapa de saídas vira objeto; time e etapas são copiados. */
function serialize(
  context: StageContext,
  cursor: RunCursor,
  done: boolean,
  status?: RunSnapshot["status"],
): RunSnapshot {
  const snapshot: RunSnapshot = {
    recipeId: context.recipe.id,
    request: context.request,
    team: { ...context.team },
    outputs: Object.fromEntries(context.outputs),
    results: [...context.results],
    cursor,
    done,
  };
  if (status) snapshot.status = status;
  return snapshot;
}

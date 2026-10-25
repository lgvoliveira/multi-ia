// A conta de uma execução: quanto cobrar de cada etapa concluída e o que registrar de cada chamada às IAs. SÓ do
// servidor. Regras (AGENTS.md, seção 5): cada etapa concluída é cobrada pelo consumo real; etapa que falhou e etapa
// interrompida pelo cancelamento não são cobradas, mas o custo delas fica no registro interno (F26).

import type { AiCallReport, StepResult } from "@/lib/engine/types";
import { costInCents, costInUsd, USD_TO_BRL } from "@/lib/ock/pricing";
import { DEFAULT_TIER } from "@/lib/providers/types";
import { stageSteps, type Recipe } from "@/lib/recipes/types";
import type { AiCallRow, RunRow } from "./store";
import { chargeStep, countRunCharges } from "./wallet";

/** No registro interno, o modelo de uma chamada que falhou sem o conector dizer qual era. */
export const UNKNOWN_MODEL = "desconhecido";

/**
 * Quanto cobrar por uma etapa concluída, em centavos: o consumo real, com no mínimo 1 centavo. O mínimo garante que
 * cada etapa vire exatamente uma linha de gasto, que é como se sabe o que já foi cobrado (countRunCharges).
 */
export function stepChargeCents(result: StepResult): number {
  const { inputTokens, outputTokens } = result.usage;
  return Math.max(1, costInCents(result.provider, DEFAULT_TIER, inputTokens, outputTokens));
}

/** A descrição da linha de gasto no extrato: a receita e a etapa ("Criar um site · Front-end"), nunca o pedido. */
export function chargeDescription(recipe: Recipe, stepId: string): string {
  const step = recipe.stages.flatMap(stageSteps).find((candidate) => candidate.id === stepId);
  return `${recipe.name} · ${step?.name ?? stepId}`.slice(0, 200);
}

/**
 * Cobra na reserva, na ordem em que terminaram, as etapas concluídas (`results`) que ainda não viraram linha de gasto.
 * Assim, se o servidor cair entre gravar uma fase e cobrar, a próxima chamada cobra o que faltou, e nada é cobrado
 * duas vezes. Devolve as etapas cobradas agora. Se a reserva foi fechada no meio (a pessoa cancelou), para de cobrar.
 */
export async function chargeCompletedSteps(
  runId: string,
  recipe: Recipe,
  results: readonly StepResult[],
  holdId: string,
): Promise<StepResult[]> {
  const charged: StepResult[] = [];
  const alreadyCharged = await countRunCharges(runId);
  for (const result of results.slice(alreadyCharged)) {
    const remaining = await chargeStep(holdId, runId, {
      amountCents: stepChargeCents(result),
      description: chargeDescription(recipe, result.stepId),
      provider: result.provider,
    });
    if (remaining === null) break;
    charged.push(result);
  }
  return charged;
}

/**
 * As linhas da tabela interna ai_calls para as chamadas às IAs de um segmento. Só a chamada que deu certo de uma etapa
 * cobrada agora (`chargedStepIds`) fica marcada como cobrada.
 */
export function aiCallRows(
  run: Pick<RunRow, "id" | "company_id" | "member_id">,
  calls: readonly AiCallReport[],
  chargedStepIds: ReadonlySet<string>,
): AiCallRow[] {
  return calls.map((call) => ({
    company_id: run.company_id,
    member_id: run.member_id,
    run_id: run.id,
    step_id: call.stepId,
    attempt: call.attempt,
    provider: call.provider,
    model: call.model ?? UNKNOWN_MODEL,
    tier: call.tier,
    input_tokens: call.usage.inputTokens,
    output_tokens: call.usage.outputTokens,
    // A coluna guarda 6 casas depois da vírgula.
    cost_usd: Number(costInUsd(call.provider, call.tier, call.usage.inputTokens, call.usage.outputTokens).toFixed(6)),
    usd_brl: USD_TO_BRL,
    charged: call.ok && chargedStepIds.has(call.stepId),
    status: call.ok ? "ok" : "error",
    error_message: call.errorMessage?.slice(0, 2000) ?? null,
    duration_ms: Math.max(0, Math.round(call.durationMs)),
  }));
}

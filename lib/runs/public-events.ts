// O que da narração do motor pode chegar ao usuário. Os eventos do motor trazem dados só internos
// (modelo exato, tokens, mensagem técnica de erro); aqui eles ficam de fora.
// Vale para qualquer canal: a tela agora, o conector MCP e o WhatsApp no futuro.

import type { RunEvent } from "@/lib/engine/types";
import type { ProviderId } from "@/lib/providers/types";
import type { StageKind } from "@/lib/recipes/types";

/** Uma fase na versão do usuário: o tipo e as etapas, cada uma com a IA decidida. */
export interface PublicPlannedStage {
  stageId: string;
  kind: StageKind;
  steps: { stepId: string; provider: ProviderId }[];
}

/** A narração que o usuário vê: os mesmos eventos do motor, só com o que ele pode ver. */
export type PublicRunEvent =
  | { type: "run-started"; stages: PublicPlannedStage[] }
  /** Uma fase começou (rodada `round`; vale mais de 1 quando a revisão mandou refazer a fase). */
  | { type: "stage-started"; stageId: string; round: number }
  | { type: "step-started"; stepId: string; provider: ProviderId; round?: number }
  | { type: "step-text"; stepId: string; text: string; round?: number }
  /** A IA teve um problema e vai recomeçar a etapa (tentativa número `attempt`). */
  | { type: "step-retrying"; stepId: string; attempt: number; round?: number }
  /** A IA `from` não conseguiu, e `to` assumiu o papel, nesta etapa e nas próximas dele. */
  | { type: "step-switched"; stepId: string; roleId: string; from: ProviderId; to: ProviderId }
  /** O veredito de uma rodada de revisão: aprovou ou mandou refazer. */
  | { type: "review-result"; stageId: string; round: number; approved: boolean }
  | { type: "step-finished"; stepId: string; durationMs: number; round?: number }
  | { type: "run-finished"; result: string; durationMs: number }
  | { type: "run-failed"; stepId: string }
  | { type: "run-cancelled"; stepId: string };

/**
 * Copia só os campos liberados para o usuário. É uma lista do que PODE sair, e não do que não pode:
 * um campo interno novo no motor fica de fora sem ninguém precisar lembrar.
 */
export function toPublicEvent(event: RunEvent): PublicRunEvent {
  switch (event.type) {
    case "run-started":
      return {
        type: event.type,
        stages: event.stages.map((stage) => ({
          stageId: stage.stageId,
          kind: stage.kind,
          steps: stage.steps.map(({ stepId, provider }) => ({ stepId, provider })),
        })),
      };
    case "stage-started":
      return { type: event.type, stageId: event.stageId, round: event.round };
    case "step-started":
      return withRound({ type: event.type, stepId: event.stepId, provider: event.provider }, event.round);
    case "step-text":
      return withRound({ type: event.type, stepId: event.stepId, text: event.text }, event.round);
    case "step-retrying":
      return withRound({ type: event.type, stepId: event.stepId, attempt: event.attempt }, event.round);
    case "step-switched":
      return {
        type: event.type,
        stepId: event.stepId,
        roleId: event.roleId,
        from: event.from,
        to: event.to,
      };
    case "review-result":
      return { type: event.type, stageId: event.stageId, round: event.round, approved: event.approved };
    case "step-finished":
      return withRound({ type: event.type, stepId: event.stepId, durationMs: event.durationMs }, event.round);
    case "run-finished":
      return { type: event.type, result: event.result, durationMs: event.durationMs };
    case "run-failed":
    case "run-cancelled":
      return { type: event.type, stepId: event.stepId };
  }
}

/** Acrescenta a rodada só quando ela existe (a 1ª rodada é implícita, então vem sem o campo). */
function withRound<E extends PublicRunEvent>(event: E, round: number | undefined): E {
  return round === undefined ? event : { ...event, round };
}

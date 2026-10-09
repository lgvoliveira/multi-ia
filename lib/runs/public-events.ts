// O que da narração do motor pode chegar ao usuário. Os eventos do motor trazem dados só internos
// (modelo exato, tokens, mensagem técnica de erro); aqui eles ficam de fora.
// Vale para qualquer canal: a tela agora, o conector MCP e o WhatsApp no futuro.

import type { PlannedStep, RunEvent } from "@/lib/engine/types";
import type { ProviderId } from "@/lib/providers/types";

/** A narração que o usuário vê: os mesmos eventos do motor, só com o que ele pode ver. */
export type PublicRunEvent =
  | { type: "run-started"; steps: PlannedStep[] }
  | { type: "step-started"; stepId: string; provider: ProviderId }
  | { type: "step-text"; stepId: string; text: string }
  /** A IA teve um problema e vai recomeçar a etapa (tentativa número `attempt`). */
  | { type: "step-retrying"; stepId: string; attempt: number }
  /** A IA `from` não conseguiu, e `to` assumiu o papel, nesta etapa e nas próximas dele. */
  | { type: "step-switched"; stepId: string; roleId: string; from: ProviderId; to: ProviderId }
  | { type: "step-finished"; stepId: string; durationMs: number }
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
        steps: event.steps.map(({ stepId, provider }) => ({ stepId, provider })),
      };
    case "step-started":
      return { type: event.type, stepId: event.stepId, provider: event.provider };
    case "step-text":
      return { type: event.type, stepId: event.stepId, text: event.text };
    case "step-retrying":
      return { type: event.type, stepId: event.stepId, attempt: event.attempt };
    case "step-switched":
      return {
        type: event.type,
        stepId: event.stepId,
        roleId: event.roleId,
        from: event.from,
        to: event.to,
      };
    case "step-finished":
      return { type: event.type, stepId: event.stepId, durationMs: event.durationMs };
    case "run-finished":
      return { type: event.type, result: event.result, durationMs: event.durationMs };
    case "run-failed":
    case "run-cancelled":
      return { type: event.type, stepId: event.stepId };
  }
}

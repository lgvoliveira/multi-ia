// O que entra e o que sai do motor. Quem usa o motor (a tela agora; o conector MCP e o WhatsApp
// no futuro) manda um RunInput e recebe uma sequência de RunEvent: a "narração" da execução.

import type { ProviderId, Usage } from "@/lib/providers/types";
import type { Recipe } from "@/lib/recipes/types";

/** IA escolhida pelo usuário para cada papel (id do papel → IA). Papel ausente usa a IA sugerida pela receita. */
export type TeamChoice = Partial<Record<string, ProviderId>>;

/** Pedido de execução: qual receita, com qual time, para fazer o quê. */
export interface RunInput {
  recipe: Recipe;
  /** O que o usuário quer, escrito por ele. */
  request: string;
  team?: TeamChoice;
}

/** Uma etapa como ela vai rodar, já com a IA decidida. */
export interface PlannedStep {
  stepId: string;
  provider: ProviderId;
}

/** O que uma etapa concluída produziu. */
export interface StepResult {
  stepId: string;
  provider: ProviderId;
  /** Resposta completa da IA. */
  output: string;
  /** Modelo exato. Só interno: vai para o histórico interno, não para a tela do usuário. */
  model: string;
  /** Consumo em tokens. Só interno: é a base do custo. */
  usage: Usage;
  /** true quando a resposta foi cortada por atingir o limite de tamanho da etapa. */
  truncated: boolean;
  /** Tempo da etapa inteira, contando as tentativas que falharam e as esperas entre elas. */
  durationMs: number;
}

/**
 * A narração. Toda execução começa com "run-started" e termina com exatamente um destes:
 * "run-finished", "run-failed" ou "run-cancelled".
 * Cada etapa começa com "step-started" e termina com "step-finished". No meio vêm os pedaços de texto e, se a IA
 * falhar, "step-retrying" ou "step-switched": a etapa recomeça do zero, e o texto escrito antes deles não vale mais.
 */
export type RunEvent =
  | { type: "run-started"; recipeId: string; steps: PlannedStep[] }
  | { type: "step-started"; stepId: string; provider: ProviderId }
  /** Um pedaço da resposta, assim que a IA escreve. */
  | { type: "step-text"; stepId: string; text: string }
  /** A IA falhou, mas vale tentar de novo: depois de `delayMs`, ela recomeça a etapa (tentativa número `attempt`). */
  | {
      type: "step-retrying";
      stepId: string;
      provider: ProviderId;
      attempt: number;
      delayMs: number;
      /** Mensagem técnica do erro. Só interna. */
      errorMessage: string;
    }
  /**
   * A IA do papel não conseguiu fazer a etapa, e `to` assumiu o papel: recomeça a etapa agora e
   * segue no papel nas próximas etapas dele.
   */
  | {
      type: "step-switched";
      stepId: string;
      roleId: string;
      from: ProviderId;
      to: ProviderId;
      /** Mensagem técnica do erro de `from`. Só interna. */
      errorMessage: string;
    }
  | ({ type: "step-finished" } & StepResult)
  | {
      type: "run-finished";
      /** O resultado final: a resposta da última etapa. */
      result: string;
      steps: StepResult[];
      /** Soma do consumo de todas as etapas. */
      usage: Usage;
      durationMs: number;
    }
  | {
      type: "run-failed";
      stepId: string;
      /** A última IA que tentou fazer a etapa. */
      provider: ProviderId;
      /** Se vale a pena tentar de novo (ex.: IA sobrecarregada). */
      retryable: boolean;
      /** Mensagem técnica. Só interna: a tela mostra um texto próprio, sem jargão. */
      errorMessage: string;
    }
  /** O usuário cancelou. `stepId` é a etapa que estava rodando ou que ia começar. */
  | { type: "run-cancelled"; stepId: string };

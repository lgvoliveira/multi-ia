// O que entra e o que sai do motor. Quem usa o motor (a tela agora; o conector MCP e o WhatsApp
// no futuro) manda um RunInput e recebe uma sequência de RunEvent: a "narração" da execução.

import type { ModelTier, ProviderId, Usage } from "@/lib/providers/types";
import type { Recipe, StageKind } from "@/lib/recipes/types";

/** IA escolhida pelo usuário para cada papel (id do papel → IA). Papel ausente usa a IA sugerida pela receita. */
export type TeamChoice = Partial<Record<string, ProviderId>>;

/** Pedido de execução: qual receita, com qual time, para fazer o quê. */
export interface RunInput {
  recipe: Recipe;
  /** O que o usuário quer, escrito por ele. */
  request: string;
  team?: TeamChoice;
}

/**
 * Onde a execução está, para poder parar e continuar depois.
 * `stageIndex` é a fase atual em `recipe.stages`; igual a `recipe.stages.length` quer dizer "acabou".
 * `round` é a rodada da revisão (1 nas outras fases).
 */
export interface RunCursor {
  stageIndex: number;
  round: number;
}

/**
 * O estado inteiro de uma execução num instante: dá para guardar, recarregar e continuar de onde parou.
 * Por enquanto só vive na memória; um commit futuro vai persistir isto para retomar entre chamadas do servidor.
 */
export interface RunSnapshot {
  recipeId: string;
  /** O pedido do usuário, já sem espaços nas pontas. */
  request: string;
  /** IA atual de cada papel. Muda quando uma IA falha e outra assume. */
  team: Record<string, ProviderId>;
  /** A resposta de cada etapa já concluída, por identificador (inclui o veredito da revisão). */
  outputs: Record<string, string>;
  /** Cada etapa concluída, na ordem em que terminou. */
  results: StepResult[];
  cursor: RunCursor;
  /** true quando a execução terminou (por sucesso, falha ou cancelamento). */
  done: boolean;
  /** Como a execução terminou. Ausente enquanto ela ainda não acabou. */
  status?: "finished" | "failed" | "cancelled";
}

/** Uma etapa como ela vai rodar, já com a IA decidida. */
export interface PlannedStep {
  stepId: string;
  provider: ProviderId;
}

/** Uma fase como ela vai rodar: o tipo dela e as etapas, já com a IA de cada uma decidida. */
export interface PlannedStage {
  stageId: string;
  kind: StageKind;
  steps: PlannedStep[];
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
 * Uma chamada a uma IA que terminou, bem ou mal: as que deram certo, as tentativas que falharam e a que parou no meio
 * (cancelamento, ou etapa irmã que falhou numa fase em paralelo). Só interno: é o custo real que a plataforma paga,
 * cobrado ou não da empresa (F26).
 */
export interface AiCallReport {
  stepId: string;
  provider: ProviderId;
  /** Modelo exato, quando se sabe (numa falha, o conector pode não dizer). */
  model: string | null;
  tier: ModelTier;
  /** Consumo. Numa falha sem o número da IA, é a conta pelo tamanho do texto enviado e do que ela escreveu. */
  usage: Usage;
  /** true quando a IA terminou a resposta. */
  ok: boolean;
  /** Mensagem técnica, quando não terminou. */
  errorMessage?: string;
  /** Número da tentativa com esta IA nesta etapa (1 é a primeira). */
  attempt: number;
  durationMs: number;
  /** O custo em dólar, quando ele não sai do preço por token do nível (a imagem criada tem preço próprio). */
  costUsd?: number;
}

/**
 * A narração. Toda execução começa com "run-started" e termina com exatamente um destes:
 * "run-finished", "run-failed" ou "run-cancelled".
 * Cada fase começa com "stage-started". Cada etapa começa com "step-started" e termina com "step-finished".
 * No meio vêm os pedaços de texto e, se a IA falhar, "step-retrying" ou "step-switched": a etapa recomeça do zero,
 * e o texto escrito antes deles não vale mais. Numa revisão, as etapas podem rodar mais de uma rodada (`round`):
 * a revisão pode mandar refazer a fase e, nessa nova rodada, as etapas recomeçam com o que ela pediu.
 */
export type RunEvent =
  | { type: "run-started"; recipeId: string; stages: PlannedStage[] }
  /** Uma fase começou (rodada `round`; vale mais de 1 quando a revisão mandou refazer a fase). */
  | { type: "stage-started"; stageId: string; round: number }
  | { type: "step-started"; stepId: string; provider: ProviderId; round?: number }
  /** Um pedaço da resposta, assim que a IA escreve. */
  | { type: "step-text"; stepId: string; text: string; round?: number }
  /** A IA falhou, mas vale tentar de novo: depois de `delayMs`, ela recomeça a etapa (tentativa número `attempt`). */
  | {
      type: "step-retrying";
      stepId: string;
      provider: ProviderId;
      attempt: number;
      delayMs: number;
      round?: number;
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
  /** O veredito de uma rodada de revisão: aprovou ou mandou refazer. */
  | { type: "review-result"; stageId: string; round: number; approved: boolean }
  | ({ type: "step-finished"; round?: number } & StepResult)
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

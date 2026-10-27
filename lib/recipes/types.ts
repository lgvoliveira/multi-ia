// Formato de uma receita. Receita é DADO, não código: o motor é um só e lê este formato.
// Uma receita nova é um arquivo novo neste formato; os testes conferem se ela está bem montada.

import type { Effort, ProviderId } from "@/lib/providers/types";

/** Um papel do time (ex.: Chefe). Diz QUEM a IA é. */
export interface Role {
  id: string;
  /** Nome mostrado na tela. */
  name: string;
  /** Uma frase sobre o que o papel faz, mostrada na tela "Montar o time". */
  description: string;
  /** IA recomendada para o papel. O usuário pode trocar. */
  suggestedProvider: ProviderId;
  /**
   * IA reserva: assume o papel quando a recomendada falha (precisa ser outra).
   * Se o usuário escolheu outra IA e é ela que falha, quem assume é a recomendada.
   */
  backupProvider: ProviderId;
  /** Quem a IA é neste papel: a base do prompt de sistema, igual em todas as etapas do papel. */
  systemPrompt: string;
}

/** De onde vem cada parte da entrada de uma etapa. */
export type StepInput =
  | { from: "request"; label: string }
  | { from: "step"; stepId: string; label: string }
  /**
   * O que a revisão pediu para corrigir. Só vale em etapas de uma fase que uma revisão manda refazer.
   * Na primeira rodada ainda não há revisão, então chega vazio.
   */
  | { from: "review"; label: string };

/** Uma etapa da execução. Diz O QUE o papel faz naquele momento. */
export interface Step {
  id: string;
  /** Papel que executa a etapa. Um papel pode ter mais de uma etapa (o Chefe planeja e consolida). */
  roleId: string;
  /** Nome mostrado no cartão da etapa (ex.: "Revisor", "Consolidação"). */
  name: string;
  /** Frase mostrada enquanto a etapa espera a vez (ex.: "Vai testar o site e apontar erros"). */
  summary: string;
  /** Frase mostrada no resultado, depois que a etapa terminou (ex.: "Testou o site e apontou o que corrigir"). */
  doneSummary: string;
  /** Tarefa desta etapa. Somada ao prompt de sistema do papel. */
  instruction: string;
  /** O que a etapa recebe: o pedido do usuário e/ou o que etapas anteriores produziram. */
  inputs: StepInput[];
  /** Limite de tamanho da resposta, em tokens. Fica na etapa porque o mesmo papel pode precisar de limites diferentes. */
  maxOutputTokens: number;
  /**
   * Quanto a IA deve "pensar" nesta etapa (padrão da receita). Tarefa simples → "low" (rápido e barato);
   * caso difícil → "high". O Chefe pode ajustar isto em tempo de execução (otimização de tempo+tokens).
   * Sem valor, o motor usa "medium".
   */
  effort?: Effort;
  /**
   * IA fixa desta etapa, independente do papel. Usada quando a etapa precisa de uma IA específica
   * seja qual for o time — por exemplo, a revisão ser sempre de uma FAMÍLIA DIFERENTE de quem escreveu
   * o código (uma IA não enxerga bem o próprio erro). Sem valor, usa a IA do papel (`roleId`).
   */
  provider?: ProviderId;
  /** Resposta de exemplo, devolvida pela IA simulada. */
  sampleOutput: string;
  /** O que a etapa escreve: texto comum ou um site (HTML). Diz à tela como mostrar a resposta. */
  format: OutputFormat;
}

/** Formato da resposta de uma etapa. O da última etapa é o formato do resultado final. */
export type OutputFormat = "html" | "text";

/** Como as etapas de uma fase rodam: uma atrás da outra, todas juntas ou uma revisão que pode mandar refazer. */
export type StageKind = "sequential" | "parallel" | "review";

/**
 * Uma fase da execução: um grupo de etapas que rodam de um jeito.
 * - sequential: as etapas rodam em ordem, uma usando o que a anterior produziu.
 * - parallel: as etapas rodam ao mesmo tempo. Por isso, nenhuma pode depender da outra (from:"step"),
 *   e cada uma precisa de um papel diferente (o motor guarda a IA atual por papel).
 * - review: uma etapa revisa o trabalho e aprova ou manda refazer a fase `reworkStageId`, até `maxRounds` rodadas.
 */
export type Stage =
  | { id: string; kind: "sequential"; steps: Step[] }
  | { id: string; kind: "parallel"; steps: Step[] }
  | {
      id: string;
      kind: "review";
      /** A etapa que revisa e dá o veredito (começa a resposta com "APROVADO" ou "REVISAR:"). */
      step: Step;
      /** Fase (em paralelo, anterior) que é refeita quando a revisão pede. */
      reworkStageId: string;
      /** Quantas rodadas de revisão no máximo (pelo menos 1). */
      maxRounds: number;
    };

/** Monta uma fase sequencial com uma única etapa. Atalho para as fases de uma etapa só. */
export function soloStage(step: Step): Stage {
  return { id: step.id, kind: "sequential", steps: [step] };
}

/** As etapas de uma fase, em ordem, qualquer que seja o tipo dela. */
export function stageSteps(stage: Stage): Step[] {
  return stage.kind === "review" ? [stage.step] : stage.steps;
}

/** A etapa que escreve o resultado final: a última da última fase. */
export function finalStep(recipe: Pick<Recipe, "stages">): Step | undefined {
  const lastStage = recipe.stages.at(-1);
  return lastStage ? stageSteps(lastStage).at(-1) : undefined;
}

export interface Recipe {
  id: string;
  name: string;
  /** Uma frase para o cartão da receita. */
  description: string;
  /** Exemplo mostrado na caixa "O que você quer?". */
  requestPlaceholder: string;
  /** O título da tela do resultado (ex.: "Seu site está pronto"). */
  resultTitle: string;
  /**
   * O nome do arquivo Word do resultado, sem a extensão (ex.: "Proposta comercial"). Obrigatório quando o resultado
   * final é texto. Fixo na receita: nunca sai do pedido, que o dono da empresa não pode ler (F49).
   */
  documentName?: string;
  roles: Role[];
  /** Executadas em ordem. A saída da última etapa da última fase é o resultado final. */
  stages: Stage[];
}

/** O que aparece no cartão da receita, inclusive das que ainda não estão prontas. */
export interface RecipeSummary {
  id: string;
  name: string;
  description: string;
  available: boolean;
  team: { roleName: string; provider: ProviderId }[];
}

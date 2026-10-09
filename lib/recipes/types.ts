// Formato de uma receita. Receita é DADO, não código: o motor é um só e lê este formato.
// Uma receita nova é um arquivo novo neste formato; os testes conferem se ela está bem montada.

import type { ProviderId } from "@/lib/providers/types";

/** Um papel do time (ex.: Chefe). Diz QUEM a IA é. */
export interface Role {
  id: string;
  /** Nome mostrado na tela. */
  name: string;
  /** Uma frase sobre o que o papel faz, mostrada na tela "Montar o time". */
  description: string;
  /** IA recomendada para o papel. O usuário pode trocar. */
  suggestedProvider: ProviderId;
  /** Quem a IA é neste papel: a base do prompt de sistema, igual em todas as etapas do papel. */
  systemPrompt: string;
}

/** De onde vem cada parte da entrada de uma etapa. */
export type StepInput =
  | { from: "request"; label: string }
  | { from: "step"; stepId: string; label: string };

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
  /** Resposta de exemplo, devolvida pela IA simulada. */
  sampleOutput: string;
  /** O que a etapa escreve: texto comum ou um site (HTML). Diz à tela como mostrar a resposta. */
  format: OutputFormat;
}

/** Formato da resposta de uma etapa. O da última etapa é o formato do resultado final. */
export type OutputFormat = "html" | "text";

export interface Recipe {
  id: string;
  name: string;
  /** Uma frase para o cartão da receita. */
  description: string;
  /** Exemplo mostrado na caixa "O que você quer?". */
  requestPlaceholder: string;
  roles: Role[];
  /** Executadas em ordem. A saída da última é o resultado final. */
  steps: Step[];
}

/** O que aparece no cartão da receita, inclusive das que ainda não estão prontas. */
export interface RecipeSummary {
  id: string;
  name: string;
  description: string;
  available: boolean;
  team: { roleName: string; provider: ProviderId }[];
}

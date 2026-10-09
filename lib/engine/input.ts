// Monta o que cada IA recebe numa etapa: quem ela é (prompt de sistema)
// e o material de trabalho (o pedido e as respostas das etapas anteriores).

import type { Role, Step, StepInput } from "@/lib/recipes/types";

/** Quem a IA é (o papel) + o que ela faz agora (a etapa). */
export function buildSystemPrompt(role: Role, step: Step): string {
  return `${role.systemPrompt}\n\n${step.instruction}`;
}

/**
 * Junta, na ordem da receita, o que a etapa recebe, cada parte com o seu nome.
 * As marcas <parte> separam bem as partes mesmo quando o conteúdo tem títulos ou código HTML.
 */
export function buildStepInput(
  step: Step,
  request: string,
  outputs: ReadonlyMap<string, string>,
): string {
  return step.inputs
    .map((input) => `<parte nome="${input.label}">\n${contentOf(input, request, outputs)}\n</parte>`)
    .join("\n\n");
}

function contentOf(input: StepInput, request: string, outputs: ReadonlyMap<string, string>): string {
  if (input.from === "request") return request;
  const output = outputs.get(input.stepId);
  if (output === undefined) {
    throw new Error(`Falta a resposta da etapa "${input.stepId}", que deveria ter rodado antes.`);
  }
  return output;
}

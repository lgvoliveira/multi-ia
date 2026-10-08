// Confere se uma receita está bem montada. Os testes rodam isto em todas as receitas,
// então uma receita nova com erro é barrada antes de chegar à tela.

import { isProviderId } from "@/lib/providers/catalog";
import type { Recipe } from "./types";

/** Devolve a lista de problemas da receita. Lista vazia = receita bem montada. */
export function findRecipeProblems(recipe: Recipe): string[] {
  const problems: string[] = [];
  const roleIds = new Set<string>();

  for (const role of recipe.roles) {
    if (roleIds.has(role.id)) problems.push(`Papel repetido: "${role.id}".`);
    roleIds.add(role.id);
    if (!role.systemPrompt.trim()) problems.push(`O papel "${role.id}" está sem prompt de sistema.`);
    if (!isProviderId(role.suggestedProvider)) {
      problems.push(`O papel "${role.id}" sugere uma IA que não existe: "${role.suggestedProvider}".`);
    }
  }

  if (recipe.steps.length === 0) problems.push("A receita não tem etapas.");

  // Etapas já vistas, na ordem: uma etapa só pode usar o que veio ANTES dela.
  const earlierSteps = new Set<string>();
  for (const step of recipe.steps) {
    if (earlierSteps.has(step.id)) problems.push(`Etapa repetida: "${step.id}".`);
    if (!roleIds.has(step.roleId)) {
      problems.push(`A etapa "${step.id}" usa um papel que não existe: "${step.roleId}".`);
    }
    if (!step.instruction.trim()) problems.push(`A etapa "${step.id}" está sem instrução.`);
    if (!step.sampleOutput.trim()) problems.push(`A etapa "${step.id}" está sem resposta de exemplo.`);
    if (!(step.maxOutputTokens >= 1)) {
      problems.push(`A etapa "${step.id}" precisa de um limite de resposta de pelo menos 1 token.`);
    }
    if (step.inputs.length === 0) problems.push(`A etapa "${step.id}" não recebe nada.`);
    for (const input of step.inputs) {
      if (input.from === "step" && !earlierSteps.has(input.stepId)) {
        problems.push(`A etapa "${step.id}" depende de "${input.stepId}", que não vem antes dela.`);
      }
    }
    earlierSteps.add(step.id);
  }

  for (const roleId of roleIds) {
    if (!recipe.steps.some((step) => step.roleId === roleId)) {
      problems.push(`O papel "${roleId}" não participa de nenhuma etapa.`);
    }
  }

  return problems;
}

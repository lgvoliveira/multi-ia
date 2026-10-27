// Confere se uma receita está bem montada. Os testes rodam isto em todas as receitas,
// então uma receita nova com erro é barrada antes de chegar à tela.

import { isProviderId } from "@/lib/providers/catalog";
import { finalStep, stageSteps, type Recipe, type Stage, type Step } from "./types";

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
    if (!isProviderId(role.backupProvider)) {
      problems.push(`O papel "${role.id}" tem uma IA reserva que não existe: "${role.backupProvider}".`);
    } else if (role.backupProvider === role.suggestedProvider) {
      problems.push(`A IA reserva do papel "${role.id}" precisa ser diferente da recomendada.`);
    }
  }

  if (recipe.stages.length === 0) problems.push("A receita não tem etapas.");
  if (!recipe.resultTitle.trim()) problems.push("A receita está sem o título da tela do resultado.");
  if (finalStep(recipe)?.format === "text" && !recipe.documentName?.trim()) {
    problems.push("A receita termina num texto e está sem o nome do arquivo Word (documentName).");
  }

  // Fases que uma revisão manda refazer: só nelas vale from:"review" (o recado da revisão).
  const reworkTargets = new Set<string>();
  for (const stage of recipe.stages) {
    if (stage.kind === "review") reworkTargets.add(stage.reworkStageId);
  }

  // Conjuntos que avançam por FASE: uma etapa só pode usar o que veio de fases ANTERIORES.
  // Dentro de uma fase em paralelo, as etapas irmãs não enxergam umas às outras (rodam ao mesmo tempo).
  const earlierSteps = new Set<string>();
  const earlierParallelStages = new Set<string>();
  const stageIds = new Set<string>();
  const allStepIds = new Set<string>();

  for (const stage of recipe.stages) {
    if (stageIds.has(stage.id)) problems.push(`Fase repetida: "${stage.id}".`);
    stageIds.add(stage.id);

    const steps = stageSteps(stage);
    const isReworkTarget = reworkTargets.has(stage.id);
    for (const step of steps) {
      checkStep(step, { problems, roleIds, earlierSteps, isReworkTarget });
    }

    if (stage.kind === "parallel") {
      const stageRoleIds = steps.map((step) => step.roleId);
      if (new Set(stageRoleIds).size !== stageRoleIds.length) {
        problems.push(
          `A fase em paralelo "${stage.id}" tem duas etapas no mesmo papel; numa fase em paralelo cada etapa precisa de um papel diferente.`,
        );
      }
    }

    if (stage.kind === "review") checkReviewStage(stage, { problems, earlierParallelStages });

    // Só depois de conferir a fase inteira as etapas dela passam a ser "anteriores".
    for (const step of steps) {
      if (allStepIds.has(step.id)) problems.push(`Etapa repetida: "${step.id}".`);
      allStepIds.add(step.id);
      earlierSteps.add(step.id);
    }
    if (stage.kind === "parallel") earlierParallelStages.add(stage.id);
  }

  for (const roleId of roleIds) {
    if (!recipe.stages.some((stage) => stageSteps(stage).some((step) => step.roleId === roleId))) {
      problems.push(`O papel "${roleId}" não participa de nenhuma etapa.`);
    }
  }

  return problems;
}

interface StepCheckContext {
  problems: string[];
  roleIds: ReadonlySet<string>;
  earlierSteps: ReadonlySet<string>;
  /** true quando a fase da etapa é refeita por uma revisão (só aí vale from:"review"). */
  isReworkTarget: boolean;
}

function checkStep(step: Step, context: StepCheckContext): void {
  const { problems, roleIds, earlierSteps, isReworkTarget } = context;
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
    if (input.from === "review" && !isReworkTarget) {
      problems.push(`A etapa "${step.id}" espera uma revisão, mas a fase dela não é refeita por nenhuma revisão.`);
    }
  }
}

interface ReviewCheckContext {
  problems: string[];
  earlierParallelStages: ReadonlySet<string>;
}

function checkReviewStage(stage: Extract<Stage, { kind: "review" }>, context: ReviewCheckContext): void {
  const { problems, earlierParallelStages } = context;
  if (!earlierParallelStages.has(stage.reworkStageId)) {
    problems.push(
      `A revisão "${stage.id}" manda refazer a fase "${stage.reworkStageId}", que não é uma fase em paralelo anterior.`,
    );
  }
  if (!(stage.maxRounds >= 1)) {
    problems.push(`A revisão "${stage.id}" precisa de pelo menos 1 rodada.`);
  }
}

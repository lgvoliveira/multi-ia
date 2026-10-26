// O que a tela de uma receita recebe do servidor: o nome, o exemplo de pedido, os papéis (nome, frase e IA sugerida) e
// as fases com as etapas (nome e frases dos cartões). Nunca as instruções das IAs, os limites nem as respostas de
// exemplo: isso fica no servidor.

import type { Recipe, Role, StageKind, Step } from "./types";
import { stageSteps } from "./types";

export type ScreenRole = Pick<Role, "id" | "name" | "description" | "suggestedProvider">;

export type ScreenStep = Pick<Step, "id" | "roleId" | "name" | "summary" | "doneSummary" | "format"> & {
  stageId: string;
};

export interface ScreenStage {
  id: string;
  kind: StageKind;
  steps: ScreenStep[];
}

export interface RecipeScreen {
  id: string;
  name: string;
  requestPlaceholder: string;
  roles: ScreenRole[];
  stages: ScreenStage[];
}

export function recipeScreen(recipe: Recipe): RecipeScreen {
  return {
    id: recipe.id,
    name: recipe.name,
    requestPlaceholder: recipe.requestPlaceholder,
    roles: recipe.roles.map(({ id, name, description, suggestedProvider }) => ({
      id,
      name,
      description,
      suggestedProvider,
    })),
    stages: recipe.stages.map((stage) => ({
      id: stage.id,
      kind: stage.kind,
      steps: stageSteps(stage).map(({ id, roleId, name, summary, doneSummary, format }) => ({
        id,
        stageId: stage.id,
        roleId,
        name,
        summary,
        doneSummary,
        format,
      })),
    })),
  };
}

// Lista de receitas. As prontas ficam em RECIPES; as do MVP que ainda não foram feitas
// aparecem como "Em breve", só com nome, descrição e time.

import { createSiteRecipe } from "./create-site";
import type { Recipe, RecipeSummary } from "./types";

export const RECIPES: readonly Recipe[] = [createSiteRecipe];

const COMING_SOON: readonly RecipeSummary[] = [
  {
    id: "write-review-text",
    name: "Escrever e revisar um texto",
    description: "Uma IA escreve e outra critica como um editor exigente.",
    available: false,
    team: [
      { roleName: "Redator", provider: "claude" },
      { roleName: "Revisor crítico", provider: "gpt" },
    ],
  },
  {
    id: "cross-checked-research",
    name: "Pesquisa com checagem cruzada",
    description: "Uma pesquisa, outra confere as fontes e uma terceira resume.",
    available: false,
    team: [
      { roleName: "Pesquisador", provider: "gemini" },
      { roleName: "Verificador", provider: "claude" },
      { roleName: "Síntese", provider: "gpt" },
    ],
  },
  {
    id: "investment-committee",
    name: "Comitê de investimento",
    description: "Tese, advogado do diabo e um parecer final sobre uma ideia de investimento.",
    available: false,
    team: [
      { roleName: "Analista", provider: "claude" },
      { roleName: "Advogado do diabo", provider: "gpt" },
      { roleName: "Consolidador", provider: "gemini" },
    ],
  },
];

export function getRecipe(id: string): Recipe | undefined {
  return RECIPES.find((recipe) => recipe.id === id);
}

/** Cartões da página inicial: primeiro as receitas prontas, depois as que estão "Em breve". */
export function listRecipeSummaries(): RecipeSummary[] {
  return [...RECIPES.map(summarize), ...COMING_SOON];
}

function summarize(recipe: Recipe): RecipeSummary {
  return {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    available: true,
    team: recipe.roles.map((role) => ({ roleName: role.name, provider: role.suggestedProvider })),
  };
}

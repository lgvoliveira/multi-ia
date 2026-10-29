// Lista de receitas. As prontas ficam em RECIPES; as do MVP que ainda não foram feitas
// aparecem como "Em breve", só com nome, descrição e time.

import { commercialProposalRecipe } from "./commercial-proposal";
import { createSiteRecipe } from "./create-site";
import { socialPostsRecipe } from "./social-posts";
import type { Recipe, RecipeSummary } from "./types";

export const RECIPES: readonly Recipe[] = [createSiteRecipe, commercialProposalRecipe, socialPostsRecipe];

// As receitas para PMEs escolhidas pelo Luis em 26/10 (issue #54) que ainda vão ser feitas.
const COMING_SOON: readonly RecipeSummary[] = [
  {
    id: "client-report",
    name: "Relatório mensal para cliente",
    description: "Um analista organiza os números, um redator escreve e um conferente checa cada número.",
    available: false,
    team: [
      { roleName: "Analista", provider: "claude" },
      { roleName: "Redator", provider: "gpt" },
      { roleName: "Conferente", provider: "claude" },
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

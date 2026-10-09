import { describe, expect, it } from "vitest";
import { RECIPES } from "./catalog";
import type { Recipe, Role } from "./types";
import { findRecipeProblems } from "./validate";

const ROLE: Role = {
  id: "writer",
  name: "Redator",
  description: "",
  suggestedProvider: "claude",
  backupProvider: "gpt",
  systemPrompt: "Escreva.",
};

describe("verificador de receitas", () => {
  it("todas as receitas prontas estão bem montadas", () => {
    for (const recipe of RECIPES) {
      expect(findRecipeProblems(recipe), recipe.id).toEqual([]);
    }
  });

  it("aponta etapa que depende de outra que vem depois, papel inexistente e papel sem etapa", () => {
    const brokenRecipe: Recipe = {
      id: "broken",
      name: "Receita com defeitos",
      description: "Só para teste.",
      requestPlaceholder: "",
      roles: [
        { ...ROLE, id: "writer", name: "Redator" },
        { ...ROLE, id: "idle", name: "Parado" },
      ],
      steps: [
        {
          id: "draft",
          roleId: "writer",
          name: "Rascunho",
          summary: "",
          doneSummary: "",
          instruction: "Escreva um rascunho.",
          inputs: [{ from: "step", stepId: "final", label: "Texto final" }],
          maxOutputTokens: 100,
          sampleOutput: "Rascunho.",
          format: "text",
        },
        {
          id: "final",
          roleId: "ghost",
          name: "Final",
          summary: "",
          doneSummary: "",
          instruction: "Finalize.",
          inputs: [{ from: "request", label: "Pedido" }],
          maxOutputTokens: 100,
          sampleOutput: "Final.",
          format: "text",
        },
      ],
    };

    expect(findRecipeProblems(brokenRecipe)).toEqual([
      'A etapa "draft" depende de "final", que não vem antes dela.',
      'A etapa "final" usa um papel que não existe: "ghost".',
      'O papel "idle" não participa de nenhuma etapa.',
    ]);
  });

  it("aponta IA reserva igual à recomendada ou que não existe", () => {
    const [recipe] = RECIPES;
    const [chief, programmer, ...others] = recipe.roles;
    const brokenRecipe: Recipe = {
      ...recipe,
      roles: [
        { ...chief, backupProvider: chief.suggestedProvider },
        { ...programmer, backupProvider: "llama" as Role["backupProvider"] },
        ...others,
      ],
    };

    expect(findRecipeProblems(brokenRecipe)).toEqual([
      `A IA reserva do papel "${chief.id}" precisa ser diferente da recomendada.`,
      `O papel "${programmer.id}" tem uma IA reserva que não existe: "llama".`,
    ]);
  });
});

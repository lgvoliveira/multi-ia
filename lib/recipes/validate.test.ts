import { describe, expect, it } from "vitest";
import { RECIPES } from "./catalog";
import type { Recipe } from "./types";
import { findRecipeProblems } from "./validate";

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
        { id: "writer", name: "Redator", description: "", suggestedProvider: "claude", systemPrompt: "Escreva." },
        { id: "idle", name: "Parado", description: "", suggestedProvider: "gpt", systemPrompt: "Nada." },
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
});

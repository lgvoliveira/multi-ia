import { describe, expect, it } from "vitest";
import { RECIPES } from "./catalog";
import type { Recipe, Role, Step } from "./types";
import { findRecipeProblems } from "./validate";

const ROLE: Role = {
  id: "writer",
  name: "Redator",
  description: "",
  suggestedProvider: "claude",
  backupProvider: "gpt",
  systemPrompt: "Escreva.",
};

/** Uma etapa mínima e bem formada, para variar só o que cada teste quer. */
function makeStep(id: string, roleId: string, overrides: Partial<Step> = {}): Step {
  return {
    id,
    roleId,
    name: id,
    summary: "",
    doneSummary: "",
    instruction: "Faça algo.",
    inputs: [{ from: "request", label: "Pedido" }],
    maxOutputTokens: 100,
    sampleOutput: "Exemplo.",
    format: "text",
    ...overrides,
  };
}

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
      stages: [
        {
          id: "draft-stage",
          kind: "sequential",
          steps: [makeStep("draft", "writer", { inputs: [{ from: "step", stepId: "final", label: "Texto final" }] })],
        },
        {
          id: "final-stage",
          kind: "sequential",
          steps: [makeStep("final", "ghost")],
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
    const [first, second, ...others] = recipe.roles;
    const brokenRecipe: Recipe = {
      ...recipe,
      roles: [
        { ...first, backupProvider: first.suggestedProvider },
        { ...second, backupProvider: "llama" as Role["backupProvider"] },
        ...others,
      ],
    };

    expect(findRecipeProblems(brokenRecipe)).toEqual([
      `A IA reserva do papel "${first.id}" precisa ser diferente da recomendada.`,
      `O papel "${second.id}" tem uma IA reserva que não existe: "llama".`,
    ]);
  });

  it("numa fase em paralelo, uma etapa não pode depender de uma irmã", () => {
    const recipe: Recipe = {
      id: "parallel-cross-ref",
      name: "Fase em paralelo com referência cruzada",
      description: "",
      requestPlaceholder: "",
      roles: [
        { ...ROLE, id: "a", name: "A" },
        { ...ROLE, id: "b", name: "B" },
      ],
      stages: [
        {
          id: "build",
          kind: "parallel",
          steps: [
            makeStep("one", "a"),
            makeStep("two", "b", { inputs: [{ from: "step", stepId: "one", label: "A etapa A" }] }),
          ],
        },
      ],
    };

    expect(findRecipeProblems(recipe)).toEqual([
      'A etapa "two" depende de "one", que não vem antes dela.',
    ]);
  });

  it("numa fase em paralelo, duas etapas não podem ter o mesmo papel", () => {
    const recipe: Recipe = {
      id: "parallel-same-role",
      name: "Fase em paralelo com papel repetido",
      description: "",
      requestPlaceholder: "",
      roles: [{ ...ROLE, id: "a", name: "A" }],
      stages: [
        {
          id: "build",
          kind: "parallel",
          steps: [makeStep("one", "a"), makeStep("two", "a")],
        },
      ],
    };

    expect(findRecipeProblems(recipe)).toEqual([
      'A fase em paralelo "build" tem duas etapas no mesmo papel; numa fase em paralelo cada etapa precisa de um papel diferente.',
    ]);
  });

  it("a revisão precisa refazer uma fase em paralelo anterior e ter pelo menos 1 rodada", () => {
    const recipe: Recipe = {
      id: "bad-review",
      name: "Revisão mal configurada",
      description: "",
      requestPlaceholder: "",
      roles: [{ ...ROLE, id: "a", name: "A" }],
      stages: [
        { id: "brief", kind: "sequential", steps: [makeStep("brief", "a")] },
        {
          id: "review",
          kind: "review",
          reworkStageId: "nao-existe",
          maxRounds: 0,
          step: makeStep("review", "a"),
        },
      ],
    };

    expect(findRecipeProblems(recipe)).toEqual([
      'A revisão "review" manda refazer a fase "nao-existe", que não é uma fase em paralelo anterior.',
      'A revisão "review" precisa de pelo menos 1 rodada.',
    ]);
  });

  it("from:\"review\" só vale numa fase que uma revisão manda refazer", () => {
    const recipe: Recipe = {
      id: "stray-review-input",
      name: "Entrada de revisão fora de lugar",
      description: "",
      requestPlaceholder: "",
      roles: [{ ...ROLE, id: "a", name: "A" }],
      stages: [
        {
          id: "brief",
          kind: "sequential",
          steps: [makeStep("brief", "a", { inputs: [{ from: "review", label: "O que revisar" }] })],
        },
      ],
    };

    expect(findRecipeProblems(recipe)).toEqual([
      'A etapa "brief" espera uma revisão, mas a fase dela não é refeita por nenhuma revisão.',
    ]);
  });
});

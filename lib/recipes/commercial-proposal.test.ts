import { describe, expect, it } from "vitest";
import { commercialProposalRecipe } from "./commercial-proposal";
import { NO_MADE_UP_DATA, TEXT_FORMAT_RULES } from "./text-format";
import { finalStep, stageSteps, type Step } from "./types";
import { findRecipeProblems } from "./validate";

const recipe = commercialProposalRecipe;

/** A etapa pelo identificador, procurando em todas as fases. */
function step(id: string): Step {
  const found = recipe.stages.flatMap(stageSteps).find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Etapa não encontrada: ${id}`);
  return found;
}

/** De onde cada entrada de uma etapa vem, no formato "request" | "review" | id da etapa. */
function inputsOf(stepId: string): string[] {
  return step(stepId).inputs.map((input) => (input.from === "step" ? input.stepId : input.from));
}

describe('receita "Proposta comercial"', () => {
  it("está bem montada", () => {
    expect(findRecipeProblems(recipe)).toEqual([]);
  });

  it("tem o time: Consultor/Claude, Redator/GPT e Cliente exigente/Claude, cada um com uma reserva de outra IA", () => {
    expect(recipe.roles.map((role) => [role.name, role.suggestedProvider, role.backupProvider])).toEqual([
      ["Consultor", "claude", "gpt"],
      ["Redator", "gpt", "claude"],
      ["Cliente exigente", "claude", "gpt"],
    ]);
  });

  it("roda 4 etapas, uma depois da outra: roteiro, proposta, crítica e versão final", () => {
    expect(recipe.stages.map((stage) => [stage.id, stage.kind])).toEqual([
      ["brief", "sequential"],
      ["draft", "sequential"],
      ["critique", "sequential"],
      ["final", "sequential"],
    ]);
    expect(recipe.stages.flatMap(stageSteps).map((s) => [s.id, s.roleId])).toEqual([
      ["brief", "consultant"],
      ["draft", "writer"],
      ["critique", "client"],
      ["final", "writer"],
    ]);
  });

  it("quem critica é de outra família de IA, diferente de quem escreveu", () => {
    const writer = recipe.roles.find((role) => role.id === "writer")!;
    const client = recipe.roles.find((role) => role.id === "client")!;
    expect(client.suggestedProvider).not.toBe(writer.suggestedProvider);
  });

  it("cada etapa recebe o que precisa: a versão final parte da proposta e dos apontamentos", () => {
    expect(inputsOf("brief")).toEqual(["request"]);
    expect(inputsOf("draft")).toEqual(["request", "brief"]);
    expect(inputsOf("critique")).toEqual(["request", "draft"]);
    expect(inputsOf("final")).toEqual(["request", "draft", "critique"]);
  });

  it("termina num texto que vira o Word \"Proposta comercial\", com o título da tela", () => {
    expect(finalStep(recipe)?.format).toBe("text");
    expect(recipe.documentName).toBe("Proposta comercial");
    expect(recipe.resultTitle).toBe("Sua proposta está pronta");
  });

  it("quem escreve segue as marcas do texto, e ninguém inventa dados", () => {
    for (const id of ["draft", "final"]) expect(step(id).instruction).toContain(TEXT_FORMAT_RULES);
    for (const id of ["brief", "draft", "final"]) expect(step(id).instruction).toContain(NO_MADE_UP_DATA);
    expect(step("critique").instruction).toMatch(/inventado/);
  });

  it("as etapas têm limite de resposta e esforço definidos (a versão final, baixo)", () => {
    for (const s of recipe.stages.flatMap(stageSteps)) {
      expect(s.maxOutputTokens).toBeGreaterThan(0);
      expect(s.effort).toBeDefined();
    }
    expect(step("final").effort).toBe("low");
  });
});

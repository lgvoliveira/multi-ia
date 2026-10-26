import { describe, expect, it } from "vitest";
import { getRecipe } from "./catalog";
import { recipeScreen } from "./screen";
import { stageSteps } from "./types";

const recipe = getRecipe("create-site")!;

describe("o que a tela de uma receita recebe", () => {
  it("leva os papéis com nome, frase e IA sugerida", () => {
    const screen = recipeScreen(recipe);
    expect(screen.name).toBe("Criar um site");
    expect(screen.roles.map((role) => [role.name, role.suggestedProvider])).toEqual(
      recipe.roles.map((role) => [role.name, role.suggestedProvider]),
    );
  });

  it("leva todas as etapas, cada uma com a fase a que pertence", () => {
    const screen = recipeScreen(recipe);
    expect(screen.stages.map((stage) => stage.id)).toEqual(recipe.stages.map((stage) => stage.id));
    for (const [index, stage] of screen.stages.entries()) {
      expect(stage.steps.map((step) => step.id)).toEqual(stageSteps(recipe.stages[index]).map((step) => step.id));
      for (const step of stage.steps) expect(step.stageId).toBe(stage.id);
    }
  });

  it("nunca leva as instruções das IAs, os limites nem as respostas de exemplo", () => {
    const text = JSON.stringify(recipeScreen(recipe));
    for (const role of recipe.roles) expect(text).not.toContain(role.systemPrompt);
    for (const stage of recipe.stages) {
      for (const step of stageSteps(stage)) {
        expect(text).not.toContain(step.instruction);
        expect(text).not.toContain(step.sampleOutput.slice(0, 80));
      }
    }
    expect(text).not.toMatch(/systemPrompt|instruction|maxOutputTokens|sampleOutput|backupProvider/);
  });
});

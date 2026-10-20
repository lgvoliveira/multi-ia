import { describe, expect, it } from "vitest";
import { createSiteRecipe } from "./create-site";
import { SAMPLE_FINAL_SITE, SAMPLE_FRONT } from "./create-site.samples";
import { stageSteps, type Stage, type Step } from "./types";

const recipe = createSiteRecipe;

/** A fase pelo identificador. */
function stage(id: string): Stage {
  const found = recipe.stages.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Fase não encontrada: ${id}`);
  return found;
}

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

describe('receita "Criar um site"', () => {
  it("tem o time: Chefe/Claude, Pesquisador/Gemini, Front-end/GPT e Back-end/Claude", () => {
    expect(recipe.roles.map((role) => [role.name, role.suggestedProvider])).toEqual([
      ["Chefe", "claude"],
      ["Pesquisador", "gemini"],
      ["Front-end", "gpt"],
      ["Back-end", "claude"],
    ]);
  });

  it("cada papel tem uma IA reserva, diferente da recomendada", () => {
    expect(recipe.roles.map((role) => [role.name, role.backupProvider])).toEqual([
      ["Chefe", "gpt"],
      ["Pesquisador", "claude"],
      ["Front-end", "claude"],
      ["Back-end", "gpt"],
    ]);
  });

  it("roda 4 fases: planejar (sozinho), construir (em paralelo), revisar e consolidar", () => {
    expect(recipe.stages.map((s) => [s.id, s.kind])).toEqual([
      ["brief", "sequential"],
      ["build", "parallel"],
      ["review", "review"],
      ["final", "sequential"],
    ]);
  });

  it("na fase em paralelo, Front-end, Back-end e Pesquisador trabalham ao mesmo tempo", () => {
    const build = stage("build");
    expect(build.kind).toBe("parallel");
    expect(stageSteps(build).map((s) => [s.id, s.roleId])).toEqual([
      ["front", "frontend"],
      ["back", "backend"],
      ["research", "researcher"],
    ]);
  });

  it("os três que trabalham em paralelo têm papéis diferentes e não dependem um do outro", () => {
    const build = stageSteps(stage("build"));
    const roles = build.map((s) => s.roleId);
    expect(new Set(roles).size).toBe(roles.length);

    const siblingIds = new Set(build.map((s) => s.id));
    for (const s of build) {
      for (const input of s.inputs) {
        if (input.from === "step") expect(siblingIds.has(input.stepId)).toBe(false);
      }
    }
  });

  it("o Front-end e o Back-end recebem o que a revisão pediu; só eles usam from:\"review\"", () => {
    expect(inputsOf("front")).toEqual(["request", "brief", "review"]);
    expect(inputsOf("back")).toEqual(["request", "brief", "review"]);
    expect(inputsOf("research")).toEqual(["request", "brief"]);
    // "review" aqui é a entrada from:"review" (o recado da revisão), não a etapa de revisão.
    expect(step("front").inputs.some((input) => input.from === "review")).toBe(true);
    expect(step("research").inputs.some((input) => input.from === "review")).toBe(false);
  });

  it("a revisão manda refazer a fase em paralelo, em 1 rodada (por velocidade)", () => {
    const review = stage("review");
    expect(review.kind).toBe("review");
    if (review.kind !== "review") return;
    expect(review.reworkStageId).toBe("build");
    expect(review.maxRounds).toBe(1);
    expect(review.step.roleId).toBe("chief");
  });

  it("a consolidação recebe tudo o que veio antes", () => {
    expect(inputsOf("consolidate")).toEqual(["request", "brief", "front", "back", "research", "review"]);
  });

  it("o Front-end e a consolidação escrevem HTML; os demais escrevem texto", () => {
    expect(recipe.stages.flatMap(stageSteps).map((s) => [s.id, s.format])).toEqual([
      ["brief", "text"],
      ["front", "html"],
      ["back", "text"],
      ["research", "text"],
      ["review", "text"],
      ["consolidate", "html"],
    ]);
  });

  it("os sites de exemplo são HTML completos, em português e sem carregar nada de fora", () => {
    for (const site of [SAMPLE_FRONT, SAMPLE_FINAL_SITE]) {
      expect(site.startsWith("<!DOCTYPE html>")).toBe(true);
      expect(site).toContain('<html lang="pt-BR">');
      expect(site).not.toMatch(/<script[^>]+src=/i); // script de outro lugar
      expect(site).not.toMatch(/<link[^>]+stylesheet/i); // CSS de outro lugar
      expect(site).not.toMatch(/src="http|url\(http|@import/i); // imagem, fonte ou CSS de fora
    }
  });

  it("o JavaScript do exemplo é só enfeite: só esconde os cartões depois de marcar a página com 'js'", () => {
    const hidingRules = SAMPLE_FINAL_SITE.split("\n").filter((line) => line.includes("opacity: 0;"));
    const hidingOutsideAnimation = hidingRules.filter((line) => !line.includes("@keyframes"));
    expect(hidingOutsideAnimation.length).toBeGreaterThan(0);
    for (const rule of hidingOutsideAnimation) {
      expect(rule.trim().startsWith(".js ")).toBe(true);
    }
  });

  it("o site final corrige o que o rascunho do visual deixou pendente", () => {
    expect(SAMPLE_FRONT).not.toContain('role="img"');
    expect(SAMPLE_FINAL_SITE).toContain('role="img" aria-label="Foto do bolo de chocolate"');
    expect(SAMPLE_FINAL_SITE).toContain("padding-bottom: 96px");
    expect(SAMPLE_FRONT).not.toContain("prefers-reduced-motion");
    expect(SAMPLE_FINAL_SITE).toContain("prefers-reduced-motion: reduce");
  });

  it("as respostas de exemplo cabem no limite de cada etapa (1 token ≈ 4 caracteres)", () => {
    for (const s of recipe.stages.flatMap(stageSteps)) {
      expect(s.sampleOutput.length, s.id).toBeLessThanOrEqual(s.maxOutputTokens * 4);
    }
  });
});

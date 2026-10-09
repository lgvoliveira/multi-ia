import { describe, expect, it } from "vitest";
import { createSiteRecipe } from "./create-site";
import { SAMPLE_FINAL_SITE, SAMPLE_FIRST_SITE } from "./create-site.samples";

describe('receita "Criar um site"', () => {
  it("tem o time do protótipo: Chefe com Claude, Programador com GPT e Revisor com Gemini", () => {
    expect(createSiteRecipe.roles.map((role) => [role.name, role.suggestedProvider])).toEqual([
      ["Chefe", "claude"],
      ["Programador", "gpt"],
      ["Revisor", "gemini"],
    ]);
  });

  it("cada papel tem uma IA reserva, e o revisor reserva não é a IA do programador", () => {
    expect(createSiteRecipe.roles.map((role) => [role.name, role.backupProvider])).toEqual([
      ["Chefe", "gpt"],
      ["Programador", "claude"],
      ["Revisor", "claude"],
    ]);
  });

  it("roda 4 etapas na ordem: planejar, programar, revisar e consolidar", () => {
    expect(createSiteRecipe.steps.map((step) => [step.id, step.roleId])).toEqual([
      ["plan", "chief"],
      ["code", "programmer"],
      ["review", "reviewer"],
      ["consolidate", "chief"],
    ]);
  });

  it("o programador recebe o plano do chefe, e a consolidação recebe tudo o que veio antes", () => {
    const inputsOf = (stepId: string) =>
      createSiteRecipe.steps
        .find((step) => step.id === stepId)
        ?.inputs.map((input) => (input.from === "step" ? input.stepId : "request"));

    expect(inputsOf("code")).toEqual(["request", "plan"]);
    expect(inputsOf("consolidate")).toEqual(["request", "plan", "code", "review"]);
  });

  it("o programador e a consolidação escrevem o site, e o resultado final é HTML", () => {
    expect(createSiteRecipe.steps.map((step) => [step.id, step.format])).toEqual([
      ["plan", "text"],
      ["code", "html"],
      ["review", "text"],
      ["consolidate", "html"],
    ]);
  });

  it("os sites de exemplo são HTML completos, em português e sem carregar nada de fora", () => {
    for (const site of [SAMPLE_FIRST_SITE, SAMPLE_FINAL_SITE]) {
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

  it("o site final corrige o que a revisão apontou no primeiro site", () => {
    expect(SAMPLE_FIRST_SITE).not.toContain('role="img"');
    expect(SAMPLE_FINAL_SITE).toContain('role="img" aria-label="Foto do bolo de chocolate"');
    expect(SAMPLE_FINAL_SITE).toContain("padding-bottom: 96px");
    expect(SAMPLE_FIRST_SITE).not.toContain("prefers-reduced-motion");
    expect(SAMPLE_FINAL_SITE).toContain("prefers-reduced-motion: reduce");
  });

  it("as respostas de exemplo cabem no limite de cada etapa (1 token ≈ 4 caracteres)", () => {
    for (const step of createSiteRecipe.steps) {
      expect(step.sampleOutput.length, step.id).toBeLessThanOrEqual(step.maxOutputTokens * 4);
    }
  });
});

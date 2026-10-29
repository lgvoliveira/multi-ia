import { describe, expect, it } from "vitest";
import { parseRichText } from "@/lib/ock/rich-text";
import { POST_RULES, socialPostsRecipe } from "./social-posts";
import { SAMPLE_POSTS_FINAL } from "./social-posts.samples";
import { NO_MADE_UP_DATA, TEXT_FORMAT_RULES } from "./text-format";
import { finalStep, stageSteps, type Step } from "./types";
import { findRecipeProblems } from "./validate";

const recipe = socialPostsRecipe;

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

function role(id: string) {
  const found = recipe.roles.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Papel não encontrado: ${id}`);
  return found;
}

describe('receita "Posts para redes sociais"', () => {
  it("está bem montada", () => {
    expect(findRecipeProblems(recipe)).toEqual([]);
  });

  it("tem o time: Estrategista/Claude, Redator 1/GPT, Redator 2/Claude e Editor/GPT, cada um com uma reserva", () => {
    expect(recipe.roles.map((r) => [r.name, r.suggestedProvider, r.backupProvider])).toEqual([
      ["Estrategista", "claude", "gpt"],
      ["Redator 1", "gpt", "gemini"],
      ["Redator 2", "claude", "gemini"],
      ["Editor", "gpt", "claude"],
    ]);
  });

  it("roda a estratégia, depois os dois redatores ao mesmo tempo, depois o editor", () => {
    expect(recipe.stages.map((stage) => [stage.id, stage.kind])).toEqual([
      ["brief", "sequential"],
      ["drafts", "parallel"],
      ["final", "sequential"],
    ]);
    expect(recipe.stages.flatMap(stageSteps).map((s) => [s.id, s.roleId])).toEqual([
      ["brief", "strategist"],
      ["draft1", "writer1"],
      ["draft2", "writer2"],
      ["final", "editor"],
    ]);
  });

  it("os dois redatores são de IAs diferentes, e continuam diferentes se um deles falhar e a reserva assumir", () => {
    const [first, second] = [role("writer1"), role("writer2")];
    expect(first.suggestedProvider).not.toBe(second.suggestedProvider);
    expect(first.backupProvider).not.toBe(second.suggestedProvider);
    expect(second.backupProvider).not.toBe(first.suggestedProvider);
  });

  it("os dois redatores recebem a mesma tarefa, e o editor recebe os posts dos dois", () => {
    expect(step("draft1").instruction).toBe(step("draft2").instruction);
    expect(inputsOf("brief")).toEqual(["request"]);
    expect(inputsOf("draft1")).toEqual(["request", "brief"]);
    expect(inputsOf("draft2")).toEqual(["request", "brief"]);
    expect(inputsOf("final")).toEqual(["request", "brief", "draft1", "draft2"]);
  });

  it('termina num texto que vira o Word "Posts para redes sociais", com o título da tela', () => {
    expect(finalStep(recipe)?.format).toBe("text");
    expect(recipe.documentName).toBe("Posts para redes sociais");
    expect(recipe.resultTitle).toBe("Seus posts estão prontos");
  });

  it("quem escreve segue as regras dos posts, o editor segue as marcas do texto, e ninguém inventa dados", () => {
    for (const id of ["draft1", "draft2", "final"]) expect(step(id).instruction).toContain(POST_RULES);
    for (const id of ["brief", "draft1", "draft2", "final"]) expect(step(id).instruction).toContain(NO_MADE_UP_DATA);
    expect(step("final").instruction).toContain(TEXT_FORMAT_RULES);
  });

  it("as etapas têm limite de resposta e esforço definidos (os redatores, baixo)", () => {
    for (const s of recipe.stages.flatMap(stageSteps)) {
      expect(s.maxOutputTokens).toBeGreaterThan(0);
      expect(s.effort).toBeDefined();
    }
    expect(step("draft1").effort).toBe("low");
    expect(step("draft2").effort).toBe("low");
  });

  it("os posts de exemplo têm o título, as 3 opções e o que preencher, e as hashtags não viram títulos", () => {
    const blocks = parseRichText(SAMPLE_POSTS_FINAL);
    const text = (index: number) => blocks[index].spans.map((span) => span.text).join("");
    expect(blocks[0].kind).toBe("title");
    expect(blocks.flatMap((block, index) => (block.kind === "heading" ? [text(index)] : []))).toEqual([
      "Opção 1 — O convite",
      "Opção 2 — Programa em família",
      "Opção 3 — O pão quentinho",
      "Antes de publicar",
    ]);
    const hashtags = blocks.filter((block) => block.spans[0]?.text === "Hashtags:");
    expect(hashtags).toHaveLength(3);
    for (const block of hashtags) expect(block.kind).toBe("paragraph");
  });
});

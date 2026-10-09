import { describe, expect, it } from "vitest";
import type { ProviderId } from "@/lib/providers/types";
import { createSiteRecipe } from "@/lib/recipes/create-site";
import type { TeamChoice } from "./types";
import { findRunProblems, MAX_REQUEST_CHARS } from "./validate";

const recipe = createSiteRecipe;

describe("conferência do pedido de execução", () => {
  it("aceita um pedido normal, com ou sem troca de IA", () => {
    expect(findRunProblems({ recipe, request: "Quero um site para minha confeitaria." })).toEqual([]);
    expect(
      findRunProblems({ recipe, request: "Quero um site.", team: { programmer: "claude" } }),
    ).toEqual([]);
  });

  it("recusa pedido vazio ou só com espaços", () => {
    expect(findRunProblems({ recipe, request: "   \n " })).toEqual([
      "Escreva o que você quer que o time faça.",
    ]);
  });

  it("aceita até 4.000 caracteres e recusa a partir daí", () => {
    expect(MAX_REQUEST_CHARS).toBe(4000);
    expect(findRunProblems({ recipe, request: "a".repeat(4000) })).toEqual([]);
    expect(findRunProblems({ recipe, request: "a".repeat(4001) })).toEqual([
      "O pedido passou do limite de 4.000 caracteres (tem 4.001).",
    ]);
  });

  it("não conta os espaços do começo e do fim", () => {
    expect(findRunProblems({ recipe, request: `  ${"a".repeat(4000)}  ` })).toEqual([]);
  });

  it("recusa papel que a receita não tem e IA que não existe", () => {
    // Simula um pedido adulterado vindo do navegador.
    const team: TeamChoice = { designer: "claude", reviewer: "llama" as ProviderId };

    expect(findRunProblems({ recipe, request: "Quero um site.", team })).toEqual([
      'A receita não tem o papel "designer".',
      'IA desconhecida para o papel "reviewer": "llama".',
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { createSiteRecipe } from "@/lib/recipes/create-site";
import { parseRunRequest } from "./parse-request";

const VALID = { recipeId: "create-site", request: "Quero um site para minha confeitaria." };

function refusal(...problems: string[]) {
  return { ok: false, problems };
}

describe("conferência do pedido que chega pela internet", () => {
  it("aceita um pedido válido e entrega ao motor a receita completa, com o time escolhido", () => {
    expect(parseRunRequest({ ...VALID, team: { frontend: "claude" }, keys: { claude: "sk-x" } })).toEqual({
      ok: true,
      input: { recipe: createSiteRecipe, request: VALID.request, team: { frontend: "claude" } },
      keys: { claude: "sk-x" },
    });
    expect(parseRunRequest(VALID).ok).toBe(true);
  });

  it("recusa o que nem é um pedido", () => {
    for (const body of [null, "Quero um site.", 42, [VALID]]) {
      expect(parseRunRequest(body)).toEqual(refusal("Não entendemos o pedido enviado."));
    }
  });

  it("recusa receita que não existe ou que ainda está em breve", () => {
    for (const recipeId of [undefined, 7, "receita-inventada", "write-review-text"]) {
      expect(parseRunRequest({ ...VALID, recipeId })).toEqual(refusal("Receita não encontrada."));
    }
  });

  it("recusa pedido que não é texto, vazio ou acima de 4.000 caracteres", () => {
    expect(parseRunRequest({ ...VALID, request: 123 })).toEqual(
      refusal("Escreva o que você quer que o time faça."),
    );
    expect(parseRunRequest({ ...VALID, request: "  \n " })).toEqual(
      refusal("Escreva o que você quer que o time faça."),
    );
    expect(parseRunRequest({ ...VALID, request: "a".repeat(4001) })).toEqual(
      refusal("O pedido passou do limite de 4.000 caracteres (tem 4.001)."),
    );
  });

  it("recusa time em formato errado, papel que a receita não tem e IA que não existe", () => {
    for (const team of [null, "claude", ["claude"]]) {
      expect(parseRunRequest({ ...VALID, team })).toEqual(refusal("O time enviado não é válido."));
    }
    expect(parseRunRequest({ ...VALID, team: { designer: "claude", frontend: "llama" } })).toEqual(
      refusal('A receita não tem o papel "designer".', 'IA desconhecida para o papel "frontend": "llama".'),
    );
  });
});

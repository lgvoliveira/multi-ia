import { describe, expect, it } from "vitest";
import { getRecipe, listRecipeSummaries } from "./catalog";

describe("catálogo de receitas", () => {
  it("mostra as 4 receitas do MVP para PMEs: o site e a proposta prontos, os posts e o relatório em breve", () => {
    expect(listRecipeSummaries().map((recipe) => [recipe.name, recipe.available])).toEqual([
      ["Criar um site", true],
      ["Proposta comercial", true],
      ["Posts para redes sociais", false],
      ["Relatório mensal para cliente", false],
    ]);
  });

  it("o cartão de uma receita pronta mostra o time sugerido", () => {
    expect(listRecipeSummaries()[0].team).toEqual([
      { roleName: "Chefe", provider: "claude" },
      { roleName: "Pesquisador", provider: "gemini" },
      { roleName: "Front-end", provider: "gpt" },
      { roleName: "Back-end", provider: "claude" },
    ]);
    expect(listRecipeSummaries()[1].team).toEqual([
      { roleName: "Consultor", provider: "claude" },
      { roleName: "Redator", provider: "gpt" },
      { roleName: "Cliente exigente", provider: "claude" },
    ]);
  });

  it("não repete identificadores", () => {
    const ids = listRecipeSummaries().map((recipe) => recipe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("encontra receitas prontas pelo identificador e devolve nada para as outras", () => {
    expect(getRecipe("create-site")?.name).toBe("Criar um site");
    expect(getRecipe("commercial-proposal")?.name).toBe("Proposta comercial");
    expect(getRecipe("social-posts")).toBeUndefined();
    expect(getRecipe("nao-existe")).toBeUndefined();
  });
});

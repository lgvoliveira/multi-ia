import { describe, expect, it } from "vitest";
import { getRecipe, listRecipeSummaries } from "./catalog";

describe("catálogo de receitas", () => {
  it("mostra as 4 receitas do MVP, com só a primeira pronta", () => {
    expect(listRecipeSummaries().map((recipe) => [recipe.name, recipe.available])).toEqual([
      ["Criar um site", true],
      ["Escrever e revisar um texto", false],
      ["Pesquisa com checagem cruzada", false],
      ["Comitê de investimento", false],
    ]);
  });

  it("o cartão de uma receita pronta mostra o time sugerido", () => {
    expect(listRecipeSummaries()[0].team).toEqual([
      { roleName: "Chefe", provider: "claude" },
      { roleName: "Programador", provider: "gpt" },
      { roleName: "Revisor", provider: "gemini" },
    ]);
  });

  it("não repete identificadores", () => {
    const ids = listRecipeSummaries().map((recipe) => recipe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("encontra receitas prontas pelo identificador e devolve nada para as outras", () => {
    expect(getRecipe("create-site")?.name).toBe("Criar um site");
    expect(getRecipe("investment-committee")).toBeUndefined();
    expect(getRecipe("nao-existe")).toBeUndefined();
  });
});

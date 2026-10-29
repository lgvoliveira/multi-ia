import { describe, expect, it } from "vitest";
import { getRecipe, listRecipeSummaries } from "./catalog";

describe("catálogo de receitas", () => {
  it("mostra as 4 receitas do MVP para PMEs: o site, a proposta e os posts prontos, o relatório em breve", () => {
    expect(listRecipeSummaries().map((recipe) => [recipe.name, recipe.available])).toEqual([
      ["Criar um site", true],
      ["Proposta comercial", true],
      ["Posts para redes sociais", true],
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
    expect(listRecipeSummaries()[2].team).toEqual([
      { roleName: "Estrategista", provider: "claude" },
      { roleName: "Redator 1", provider: "gpt" },
      { roleName: "Redator 2", provider: "claude" },
      { roleName: "Editor", provider: "gpt" },
    ]);
  });

  it("não repete identificadores", () => {
    const ids = listRecipeSummaries().map((recipe) => recipe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("encontra receitas prontas pelo identificador e devolve nada para as outras", () => {
    expect(getRecipe("create-site")?.name).toBe("Criar um site");
    expect(getRecipe("commercial-proposal")?.name).toBe("Proposta comercial");
    expect(getRecipe("social-posts")?.name).toBe("Posts para redes sociais");
    expect(getRecipe("client-report")).toBeUndefined();
    expect(getRecipe("nao-existe")).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { readWorkspaceView, recipeHref, workspaceSearch } from "./workspace-view";

const READY = ["create-site"];

describe("aba e receita no endereço do espaço de trabalho", () => {
  it("sem nada no endereço, abre o Chat", () => {
    expect(readWorkspaceView({}, READY)).toEqual({ tab: "chat", recipeId: null });
  });

  it("lê a aba pelo nome em português", () => {
    expect(readWorkspaceView({ aba: "receitas" }, READY)).toEqual({ tab: "recipes", recipeId: null });
    expect(readWorkspaceView({ aba: "entregas" }, READY).tab).toBe("deliveries");
    expect(readWorkspaceView({ aba: "gastos" }, READY).tab).toBe("spending");
  });

  it("com uma receita pronta e sem aba, abre a aba Receitas com ela", () => {
    expect(readWorkspaceView({ receita: "create-site" }, READY)).toEqual({ tab: "recipes", recipeId: "create-site" });
  });

  it("mantém a receita aberta mesmo com outra aba à vista", () => {
    expect(readWorkspaceView({ aba: "chat", receita: "create-site" }, READY)).toEqual({
      tab: "chat",
      recipeId: "create-site",
    });
  });

  it("ignora aba desconhecida e receita que não está pronta", () => {
    expect(readWorkspaceView({ aba: "xyz" }, READY)).toEqual({ tab: "chat", recipeId: null });
    expect(readWorkspaceView({ aba: "receitas", receita: "investment-committee" }, READY)).toEqual({
      tab: "recipes",
      recipeId: null,
    });
  });

  it("com o mesmo parâmetro repetido, usa o primeiro", () => {
    expect(readWorkspaceView({ aba: ["entregas", "gastos"] }, READY).tab).toBe("deliveries");
  });
});

describe("escrever a aba e a receita no endereço", () => {
  it("o Chat sem receita deixa o endereço limpo", () => {
    expect(workspaceSearch("?aba=gastos", { tab: "chat", recipeId: null })).toBe("");
  });

  it("o Chat com uma receita aberta aparece no endereço, e recarregar volta para o Chat", () => {
    const search = workspaceSearch("?aba=receitas&receita=create-site&run=abc", { tab: "chat", recipeId: "create-site" });
    expect(search).toBe("?aba=chat&receita=create-site&run=abc");
    const params = Object.fromEntries(new URLSearchParams(search));
    expect(readWorkspaceView(params, READY)).toEqual({ tab: "chat", recipeId: "create-site" });
  });

  it("escreve a aba e a receita, mantendo a execução acompanhada", () => {
    expect(workspaceSearch("?run=abc", { tab: "recipes", recipeId: "create-site" })).toBe(
      "?run=abc&aba=receitas&receita=create-site",
    );
  });

  it("fechar a receita tira também a execução", () => {
    expect(workspaceSearch("?aba=receitas&receita=create-site&run=abc", { tab: "recipes", recipeId: null })).toBe(
      "?aba=receitas",
    );
  });
});

describe("endereço de uma receita", () => {
  it("leva para a aba Receitas, com a execução quando houver", () => {
    expect(recipeHref("create-site")).toBe("/trabalho?aba=receitas&receita=create-site");
    expect(recipeHref("create-site", "abc")).toBe("/trabalho?aba=receitas&receita=create-site&run=abc");
  });
});

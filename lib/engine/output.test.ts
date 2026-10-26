import { describe, expect, it } from "vitest";
import { finalStepOutput, unwrapHtml } from "./output";

const PAGE = '<!DOCTYPE html>\n<html lang="pt-BR">\n<body><h1>Doce Encanto</h1></body>\n</html>';

describe("o site sem as marcas de código", () => {
  it("tira a cerca ```html em volta do site", () => {
    expect(unwrapHtml("```html\n" + PAGE + "\n```")).toBe(PAGE);
    expect(unwrapHtml("```\n" + PAGE + "\n```\n")).toBe(PAGE);
  });

  it("tira também a frase antes e depois da cerca", () => {
    expect(unwrapHtml("Aqui está o site pronto:\n\n```html\n" + PAGE + "\n```\n\nEspero que goste!")).toBe(PAGE);
  });

  it("com mais de um bloco, fica o que tem cara de página", () => {
    const text = "Use estas cores:\n```css\nbody { color: red; }\n```\nE o site:\n```html\n" + PAGE + "\n```";
    expect(unwrapHtml(text)).toBe(PAGE);
  });

  it("sem cerca, o texto passa exatamente como veio", () => {
    expect(unwrapHtml(PAGE + "\n")).toBe(PAGE + "\n");
  });

  it("cerca aberta e não fechada (resposta cortada no teto): tira só a abertura", () => {
    expect(unwrapHtml("```html\n<!DOCTYPE html>\n<html><body>pela met")).toBe("<!DOCTYPE html>\n<html><body>pela met");
  });

  it("só o site é arrumado; o texto comum (o plano, a revisão) passa como veio", () => {
    const plan = "Plano:\n```\n1. Topo\n2. Cardápio\n```";
    expect(finalStepOutput(plan, "text")).toBe(plan);
    expect(finalStepOutput("```html\n" + PAGE + "\n```", "html")).toBe(PAGE);
  });
});

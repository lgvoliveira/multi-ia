import { describe, expect, it } from "vitest";
import { SAMPLE_PROPOSAL_FINAL } from "@/lib/recipes/commercial-proposal.samples";
import { parseRichText, plainText } from "./rich-text";

describe("o texto final de uma receita, lido em partes", () => {
  it("separa o título, as seções, os itens e os parágrafos", () => {
    const blocks = parseRichText("# Proposta\n\n## Solução\nTexto da solução.\n- Item um\n* Item dois\n• Item três");
    expect(blocks.map((block) => [block.kind, block.spans.map((span) => span.text).join("")])).toEqual([
      ["title", "Proposta"],
      ["heading", "Solução"],
      ["paragraph", "Texto da solução."],
      ["item", "Item um"],
      ["item", "Item dois"],
      ["item", "Item três"],
    ]);
  });

  it("os destaques viram pedaços em negrito, e o resto fica como está", () => {
    expect(parseRichText("A **Agência Ponto**, de __Campinas__, e um * solto")[0].spans).toEqual([
      { text: "A ", bold: false },
      { text: "Agência Ponto", bold: true },
      { text: ", de ", bold: false },
      { text: "Campinas", bold: true },
      { text: ", e um * solto", bold: false },
    ]);
  });

  it("uma linha que começa com destaque não vira item de lista", () => {
    expect(parseRichText("**Investimento:** [valor]")[0].kind).toBe("paragraph");
  });

  it("ignora linhas em branco, cercas de código e linhas de separação", () => {
    const blocks = parseRichText("```markdown\n# Título\n\n---\nTexto\n***\n```");
    expect(blocks.map((block) => block.kind)).toEqual(["title", "paragraph"]);
  });

  it("### e níveis mais fundos também são títulos de seção", () => {
    expect(parseRichText("### Prazo\n#### Etapas").map((block) => block.kind)).toEqual(["heading", "heading"]);
  });

  it("a proposta de exemplo começa pelo título e tem seções e itens", () => {
    const blocks = parseRichText(SAMPLE_PROPOSAL_FINAL);
    expect(blocks[0]).toEqual({ kind: "title", spans: [{ text: "Proposta comercial — Clínica Sorriso", bold: false }] });
    expect(blocks.filter((block) => block.kind === "heading").length).toBe(6);
    expect(blocks.some((block) => block.kind === "item")).toBe(true);
  });

  it("o texto para copiar sai sem as marcas, com uma linha em branco antes de cada título", () => {
    expect(plainText(parseRichText("# Proposta\nOi **você**.\n## Prazo\n- 3 meses"))).toBe(
      "Proposta\nOi você.\n\nPrazo\n- 3 meses",
    );
  });
});

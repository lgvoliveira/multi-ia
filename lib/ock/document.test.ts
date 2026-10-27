import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { SAMPLE_PROPOSAL_FINAL } from "@/lib/recipes/commercial-proposal.samples";
import { textDocument } from "./document";

/** O texto do corpo do Word (word/document.xml). */
async function bodyXml(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("O arquivo Word está sem o corpo.");
  return file.async("string");
}

describe("o resultado em texto de uma receita vira um arquivo Word", () => {
  it("leva o nome da receita, sem acento nem espaço, e o tipo do Word", async () => {
    const doc = await textDocument("Proposta comercial", SAMPLE_PROPOSAL_FINAL);
    expect(doc.name).toBe("Proposta-comercial.docx");
    expect(doc.mime).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  });

  it("o título e as seções viram títulos do Word; os itens, lista; os destaques, negrito", async () => {
    const xml = await bodyXml((await textDocument("Proposta comercial", SAMPLE_PROPOSAL_FINAL)).bytes);
    expect(xml).toContain("Proposta comercial — Clínica Sorriso");
    expect(xml).toContain('w:val="Heading1"');
    expect(xml).toContain('w:val="Heading2"');
    expect(xml).toContain("<w:numPr>");
    expect(xml).toContain("<w:b/>");
    expect(xml).toContain("Agência Ponto");
    // As marcas da IA não aparecem no arquivo.
    expect(xml).not.toMatch(/\*\*|## /);
  });

  it("um texto vazio ainda vira um arquivo Word que abre", async () => {
    const doc = await textDocument("Proposta comercial", "");
    expect(await bodyXml(doc.bytes)).toContain("<w:body>");
  });
});

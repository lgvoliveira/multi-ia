import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { generateDocument } from "./document";
import { columnName, csvToXlsx, parseCsv } from "./spreadsheet";

async function sheetXml(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  return (await zip.file("xl/worksheets/sheet1.xml")?.async("string")) ?? "";
}

describe("ler o CSV que a IA escreveu", () => {
  it("separa por vírgula, respeitando campos entre aspas (com vírgula, quebra de linha e aspas dobradas)", () => {
    const csv = 'Produto,Obs\n"Bolo, chocolate","Diz ""ótimo"""\n"Duas\nlinhas",x\r\n';
    expect(parseCsv(csv)).toEqual([
      ["Produto", "Obs"],
      ["Bolo, chocolate", 'Diz "ótimo"'],
      ["Duas\nlinhas", "x"],
    ]);
  });

  it("aceita ponto e vírgula, comum no Brasil, e ignora linhas em branco e a marca do começo (BOM)", () => {
    expect(parseCsv("﻿Nome;Valor\n\nAna;1234,56\n\n")).toEqual([
      ["Nome", "Valor"],
      ["Ana", "1234,56"],
    ]);
  });
});

describe("montar a planilha Excel (.xlsx)", () => {
  it("é um .zip com as partes que o Excel espera", async () => {
    const zip = await JSZip.loadAsync(await csvToXlsx("A,B\n1,2\n"));
    for (const part of [
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
    ]) {
      expect(zip.file(part), part).not.toBeNull();
    }
    expect(await zip.file("xl/workbook.xml")?.async("string")).toContain('name="Planilha"');
  });

  it("números viram números; o resto, texto; a primeira linha sai em negrito", async () => {
    const xml = await sheetXml(await csvToXlsx("Produto,Preço\nBolo,45.5\nPão,-3\n"));
    expect(xml).toContain('<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">Produto</t></is></c>');
    expect(xml).toContain('<c r="B2"><v>45.5</v></c>');
    expect(xml).toContain('<c r="B3"><v>-3</v></c>');
  });

  it("com ponto e vírgula, a vírgula decimal vira número", async () => {
    expect(await sheetXml(await csvToXlsx("Nome;Valor\nAna;1234,56\n"))).toContain('<c r="B2"><v>1234.56</v></c>');
  });

  it("um valor que começa com '=' fica como texto, nunca fórmula; os sinais do XML são trocados", async () => {
    const xml = await sheetXml(await csvToXlsx('A,B\n=HYPERLINK("http://x"),<b>&\n'));
    expect(xml).not.toContain("<f>");
    expect(xml).toContain("=HYPERLINK(&quot;http://x&quot;)");
    expect(xml).toContain("&lt;b&gt;&amp;");
  });

  it("caracteres de controle, que o XML não aceita, saem", async () => {
    expect(await sheetXml(await csvToXlsx("A\nx\u0001y\n"))).toContain(">xy<");
  });

  it("o documento pedido em Excel sai como .xlsx, com o tipo certo", async () => {
    const doc = await generateDocument("Planilha", "A,B\n1,2\n", "xlsx");
    expect(doc.name).toBe("Planilha.xlsx");
    expect(doc.mime).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(await sheetXml(doc.bytes)).toContain('<c r="A2"><v>1</v></c>');
  });
});

describe("o nome das colunas", () => {
  it("segue o Excel: A a Z, depois AA, AB…", () => {
    expect([0, 1, 25, 26, 27, 51, 52, 701, 702].map(columnName)).toEqual(["A", "B", "Z", "AA", "AB", "AZ", "BA", "ZZ", "AAA"]);
  });
});

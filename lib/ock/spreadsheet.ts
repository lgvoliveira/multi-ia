// A planilha Excel (.xlsx) que a OCK monta a partir do CSV escrito pela IA. Montada aqui mesmo: um .xlsx é um .zip
// com alguns arquivos XML, e o jszip (que o projeto já usa para o .zip dos projetos) basta. Antes, isso passava pelo
// pacote xlsx, que tem falhas de segurança conhecidas justamente ao ler texto, e sem correção no npm (F15). SÓ do
// servidor.
//
// Tudo o que não é número entra como texto: um valor que começa com "=" vira texto, nunca fórmula (o CSV vem de uma IA,
// que pode ter sido influenciada por um texto colado no pedido).

import JSZip from "jszip";

/** Uma planilha com mais linhas ou colunas que isto é cortada (a IA escreve tabelas pequenas; isto só evita abuso). */
const MAX_ROWS = 10_000;
const MAX_COLUMNS = 200;

/**
 * Lê um CSV (o formato comum: campos entre aspas podem ter vírgula, quebra de linha e aspas dobradas). Aceita ponto e
 * vírgula como separador, comum no Brasil, quando a primeira linha usa mais ponto e vírgula do que vírgula.
 */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, "");
  const separator = guessSeparator(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field === "") {
      quoted = true;
    } else if (char === separator) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Linhas em branco (comuns no fim do texto da IA) ficam de fora.
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

function guessSeparator(text: string): "," | ";" {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const outsideQuotes = firstLine.replace(/"[^"]*"/g, "");
  const count = (char: string) => outsideQuotes.split(char).length - 1;
  return count(";") > count(",") ? ";" : ",";
}

/** Um valor da planilha: número (para dar para somar no Excel) ou texto. */
type Cell = { kind: "number"; value: number } | { kind: "text"; value: string };

/** "12", "-3.5" e, com ponto e vírgula como separador, "1234,56" viram número; o resto é texto. */
function toCell(raw: string, decimalComma: boolean): Cell {
  const value = raw.trim();
  const normalized = decimalComma ? value.replace(",", ".") : value;
  if (/^-?\d{1,15}(\.\d{1,10})?$/.test(normalized)) return { kind: "number", value: Number(normalized) };
  return { kind: "text", value: raw };
}

/** Monta o .xlsx a partir do CSV. A primeira linha (os nomes das colunas) sai em negrito. */
export async function csvToXlsx(csv: string): Promise<Uint8Array> {
  const decimalComma = guessSeparator(csv.replace(/^﻿/, "")) === ";";
  const rows = parseCsv(csv)
    .slice(0, MAX_ROWS)
    .map((cells) => cells.slice(0, MAX_COLUMNS).map((cell) => toCell(cell, decimalComma)));

  const sheetRows = rows
    .map((cells, rowIndex) => {
      const style = rowIndex === 0 ? ' s="1"' : "";
      const xmlCells = cells
        .map((cell, columnIndex) => {
          const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
          if (cell.kind === "number") return `<c r="${ref}"${style}><v>${cell.value}</v></c>`;
          return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${xmlCells}</row>`;
    })
    .join("");

  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file("_rels/.rels", ROOT_RELS);
  zip.file("xl/workbook.xml", WORKBOOK);
  zip.file("xl/_rels/workbook.xml.rels", WORKBOOK_RELS);
  zip.file("xl/styles.xml", STYLES);
  zip.file(
    "xl/worksheets/sheet1.xml",
    `${XML_HEADER}<worksheet xmlns="${MAIN_NS}"><sheetData>${sheetRows}</sheetData></worksheet>`,
  );
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

/** O nome da coluna como no Excel: 0 → "A", 25 → "Z", 26 → "AA". */
export function columnName(index: number): string {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

/** O texto dentro do XML: sem os caracteres de controle que o XML não aceita e com os sinais especiais trocados. */
function escapeXml(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const DOC_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

const CONTENT_TYPES =
  `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
  "</Types>";

const ROOT_RELS =
  `${XML_HEADER}<Relationships xmlns="${REL_NS}">` +
  `<Relationship Id="rId1" Type="${DOC_REL}/officeDocument" Target="xl/workbook.xml"/>` +
  "</Relationships>";

const WORKBOOK =
  `${XML_HEADER}<workbook xmlns="${MAIN_NS}" xmlns:r="${DOC_REL}">` +
  '<sheets><sheet name="Planilha" sheetId="1" r:id="rId1"/></sheets>' +
  "</workbook>";

const WORKBOOK_RELS =
  `${XML_HEADER}<Relationships xmlns="${REL_NS}">` +
  `<Relationship Id="rId1" Type="${DOC_REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="${DOC_REL}/styles" Target="styles.xml"/>` +
  "</Relationships>";

// Duas fontes (a comum e a negrita) e dois estilos de célula: 0 é o comum, 1 é o negrito dos nomes das colunas.
const STYLES =
  `${XML_HEADER}<styleSheet xmlns="${MAIN_NS}">` +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>";

// Geração de ARQUIVO a partir do conteúdo que a IA monta. É a "mão" que faltava: a IA (API) devolve
// texto; aqui a OCK transforma esse texto num arquivo de verdade (PDF, CSV ou TXT) para baixar.
// PDF é renderizado com pdf-lib (JS puro, roda no servidor). Só o servidor usa.

import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";
import * as XLSX from "xlsx";

export type DocFormat = "pdf" | "csv" | "txt" | "xlsx" | "docx";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface GeneratedDoc {
  name: string;
  mime: string;
  bytes: Uint8Array;
}

/** Decide o formato do arquivo a partir do pedido. O formato pedido explicitamente ganha (ex.: "pdf"). */
export function pickFormat(message: string): DocFormat {
  const t = message.toLowerCase();
  if (/\bpdf\b/.test(t)) return "pdf"; // se a pessoa escreveu "pdf", é PDF — mesmo falando de uma planilha.
  if (/\b(excel|xlsx|planilha)\b/.test(t)) return "xlsx";
  if (/\b(word|docx)\b/.test(t)) return "docx";
  if (/\b(csv|tabela)\b/.test(t)) return "csv";
  if (/\b(txt|bloco de notas|texto puro)\b/.test(t)) return "txt";
  return "pdf";
}

/** Monta o arquivo final a partir do conteúdo (texto) produzido pela IA. */
export async function generateDocument(title: string, content: string, format: DocFormat): Promise<GeneratedDoc> {
  const base = safeName(title) || "documento";
  if (format === "csv") {
    return { name: `${base}.csv`, mime: "text/csv", bytes: new TextEncoder().encode(content) };
  }
  if (format === "txt") {
    return { name: `${base}.txt`, mime: "text/plain", bytes: new TextEncoder().encode(content) };
  }
  if (format === "xlsx") {
    return { name: `${base}.xlsx`, mime: XLSX_MIME, bytes: renderXlsx(content) };
  }
  if (format === "docx") {
    return { name: `${base}.docx`, mime: DOCX_MIME, bytes: await renderDocx(title, content) };
  }
  return { name: `${base}.pdf`, mime: "application/pdf", bytes: await renderPdf(title, content) };
}

/** Converte o CSV que a IA montou numa planilha Excel (.xlsx) de verdade. */
function renderXlsx(csv: string): Uint8Array {
  const wb = XLSX.read(csv, { type: "string", raw: false });
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Uint8Array(buf);
}

/** Converte o texto que a IA montou num documento Word (.docx). */
async function renderDocx(title: string, content: string): Promise<Uint8Array> {
  const children: Paragraph[] = [new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 })];
  for (const line of content.split("\n")) {
    children.push(new Paragraph({ children: [new TextRun(line)] }));
  }
  const doc = new Document({ sections: [{ children }] });
  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(buf);
}

const PAGE_W = 595.28; // A4 em pontos
const PAGE_H = 841.89;
const MARGIN = 56;

async function renderPdf(title: string, content: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const size = 11;
  const titleSize = 16;
  const lineH = size * 1.5;
  const maxW = PAGE_W - MARGIN * 2;

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  for (const tline of wrap(title, bold, titleSize, maxW)) {
    page.drawText(tline, { x: MARGIN, y: y - titleSize, size: titleSize, font: bold });
    y -= titleSize * 1.5;
  }
  y -= lineH * 0.5;

  for (const raw of content.replace(/\t/g, "  ").split("\n")) {
    const lines = raw.length ? wrap(raw, font, size, maxW) : [""];
    for (const line of lines) {
      if (y < MARGIN + lineH) {
        page = doc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
      }
      if (line) page.drawText(line, { x: MARGIN, y: y - size, size, font });
      y -= lineH;
    }
  }
  return doc.save();
}

/** Quebra uma linha em várias que cabem na largura da página. */
function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const clean = sanitize(text);
  if (!clean) return [""];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (cur && font.widthOfTextAtSize(candidate, size) > maxW) {
      lines.push(cur);
      cur = w;
    } else {
      cur = candidate;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

/** As fontes padrão do PDF só desenham caracteres WinAnsi (ASCII + Latin-1). Tira emoji e o resto. */
function sanitize(s: string): string {
  return s.replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

function safeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

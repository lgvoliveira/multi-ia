// O texto final de uma receita, do jeito que as IAs escrevem (lib/recipes/text-format.ts), lido em partes para a tela e
// para o Word: o título ("# "), os títulos de seção ("## "), os itens de lista ("- ") e os destaques (**assim**). Tudo
// vira texto: nada do que a IA escreveu entra na página como código (AGENTS.md, seção 6). Vai para a tela.

/** Um pedaço de uma linha, com ou sem destaque. */
export interface TextSpan {
  text: string;
  bold: boolean;
}

/** Uma linha do texto, já com o papel dela. */
export interface TextBlock {
  kind: "title" | "heading" | "item" | "paragraph";
  spans: TextSpan[];
}

const HEADING = /^(#{1,6})\s+(.*)$/;
const LIST_ITEM = /^[-*•]\s+(.*)$/;
/** Linhas que as IAs às vezes escrevem e que não são conteúdo: cercas de código e linhas de separação. */
const NOISE = /^(```.*|-{3,}|\*{3,}|_{3,})$/;
/** Um destaque: **assim** ou __assim__. */
const BOLD = /\*\*(.+?)\*\*|__(.+?)__/g;

/** Lê o texto linha a linha. Linhas em branco só separam; o título é o "# ", e os outros "#" são seções. */
export function parseRichText(text: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || NOISE.test(line)) continue;
    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ kind: heading[1].length === 1 ? "title" : "heading", spans: spansOf(heading[2]) });
      continue;
    }
    const item = LIST_ITEM.exec(line);
    blocks.push(item ? { kind: "item", spans: spansOf(item[1]) } : { kind: "paragraph", spans: spansOf(line) });
  }
  return blocks;
}

/** O texto sem as marcas, para copiar e colar num e-mail ou no WhatsApp. */
export function plainText(blocks: readonly TextBlock[]): string {
  return blocks
    .map((block, index) => {
      const text = block.spans.map((span) => span.text).join("");
      if (block.kind === "item") return `- ${text}`;
      // Uma linha em branco antes de cada título separa as seções.
      return (block.kind === "title" || block.kind === "heading") && index > 0 ? `\n${text}` : text;
    })
    .join("\n");
}

function spansOf(line: string): TextSpan[] {
  const spans: TextSpan[] = [];
  let last = 0;
  for (const match of line.matchAll(BOLD)) {
    if (match.index > last) spans.push({ text: line.slice(last, match.index), bold: false });
    spans.push({ text: match[1] ?? match[2], bold: true });
    last = match.index + match[0].length;
  }
  if (last < line.length) spans.push({ text: line.slice(last), bold: false });
  return spans;
}

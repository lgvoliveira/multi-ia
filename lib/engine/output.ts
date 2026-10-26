// O texto final de uma etapa, arrumado conforme o formato. As IAs de verdade às vezes cercam o site com as marcas de
// código do Markdown (```html … ```), às vezes com uma frase antes ("Aqui está o site:") ou depois. Na prévia, no arquivo
// baixado e na etapa seguinte, isso quebraria o site. A narração ao vivo continua mostrando o que a IA escreveu.

import type { OutputFormat } from "@/lib/recipes/types";

/** Um bloco cercado por ``` (com ou sem o nome da linguagem), do jeito que as IAs escrevem. */
const FENCED_BLOCK = /```[a-zA-Z0-9_-]*[^\S\n]*\n([\s\S]*?)\n?```/g;

/** O texto final de uma etapa: o site sem as marcas de código; o texto comum, como veio. */
export function finalStepOutput(output: string, format: OutputFormat): string {
  return format === "html" ? unwrapHtml(output) : output;
}

/**
 * Tira as marcas de código em volta do site. Se houver mais de um bloco cercado, fica o que tem cara de página (com
 * <html> ou <!doctype>), ou o maior. Sem blocos cercados, devolve o texto exatamente como veio.
 */
export function unwrapHtml(output: string): string {
  const blocks = [...output.matchAll(FENCED_BLOCK)].map((match) => match[1]);
  if (blocks.length === 0) return unclosedFence(output);
  const page = blocks.find((block) => /<!doctype html|<html[\s>]/i.test(block));
  const chosen = page ?? blocks.reduce((largest, block) => (block.length > largest.length ? block : largest));
  return chosen.trim();
}

/** A IA abriu a cerca e não fechou (ex.: a resposta foi cortada no teto): tira só a abertura. */
function unclosedFence(text: string): string {
  const match = /^\s*```[a-zA-Z0-9_-]*[^\S\n]*\n/.exec(text);
  return match ? text.slice(match[0].length).trim() : text;
}

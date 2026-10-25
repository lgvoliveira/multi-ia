// Ler o que a pessoa anexou, para a IA: o texto de PDFs e de arquivos de texto, e as imagens (que a IA "enxerga").
// SÓ do servidor. O tipo vem da extensão do nome: o tipo que o navegador informa pode vir errado ou inventado.

import { extractText, getDocumentProxy } from "unpdf";
import { fileExtension, TEXT_EXTENSIONS } from "./chat";

const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export type AttachmentContent =
  | { kind: "text"; text: string }
  | { kind: "image"; mime: string; base64: string }
  /** Um tipo que a IA não lê (a rota de anexar já recusa; aqui é só por garantia). */
  | null;

/** O que a IA recebe de um anexo. */
export async function readAttachment(name: string, bytes: Uint8Array): Promise<AttachmentContent> {
  const extension = fileExtension(name);
  if (extension === "pdf") return { kind: "text", text: await pdfText(bytes) };
  if ((TEXT_EXTENSIONS as readonly string[]).includes(extension)) {
    return { kind: "text", text: new TextDecoder().decode(bytes) };
  }
  const mime = IMAGE_MIME[extension];
  if (mime) return { kind: "image", mime, base64: Buffer.from(bytes).toString("base64") };
  return null;
}

/** O tipo do arquivo para guardar na tabela, pela extensão (o informado pelo navegador não é confiável). */
export function attachmentMime(name: string): string {
  const extension = fileExtension(name);
  if (extension === "pdf") return "application/pdf";
  if (extension === "csv") return "text/csv";
  if (extension === "json") return "application/json";
  if ((TEXT_EXTENSIONS as readonly string[]).includes(extension)) return "text/plain";
  return IMAGE_MIME[extension] ?? "application/octet-stream";
}

async function pdfText(bytes: Uint8Array): Promise<string> {
  try {
    const pdf = await getDocumentProxy(bytes);
    const result = await extractText(pdf, { mergePages: true });
    return Array.isArray(result.text) ? result.text.join("\n") : result.text;
  } catch {
    return "[Não consegui ler o conteúdo deste PDF.]";
  }
}

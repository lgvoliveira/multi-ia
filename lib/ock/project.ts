// Entrega um PROJETO/código como .zip: a IA monta os arquivos (JSON) e a OCK compacta tudo para baixar.
// Nada roda no nosso servidor — só empacotamos o texto que a IA escreveu. Só o servidor usa.

import JSZip from "jszip";

export interface ProjectFile {
  path: string;
  content: string;
}

/** Lê o JSON de arquivos que a IA devolveu. Aceita {arquivos:[{caminho,conteudo}]} ou {files:[{path,content}]}. */
export function parseProjectFiles(text: string): ProjectFile[] {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  let data: unknown;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (typeof data !== "object" || data === null) return [];
  const raw = (data as Record<string, unknown>).arquivos ?? (data as Record<string, unknown>).files;
  if (!Array.isArray(raw)) return [];
  const files: ProjectFile[] = [];
  for (const item of raw) {
    const o = (item ?? {}) as Record<string, unknown>;
    const path = typeof o.caminho === "string" ? o.caminho : typeof o.path === "string" ? o.path : "";
    const content = typeof o.conteudo === "string" ? o.conteudo : typeof o.content === "string" ? o.content : "";
    const safe = safePath(path);
    if (safe) files.push({ path: safe, content });
  }
  return files.slice(0, 60);
}

/** Compacta os arquivos num .zip. */
export async function generateZip(files: ProjectFile[]): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const f of files) zip.file(f.path, f.content);
  return zip.generateAsync({ type: "uint8array" });
}

/** Limpa o caminho do arquivo dentro do zip (sem subir pastas, sem caracteres perigosos). */
function safePath(p: string): string {
  return p
    .replace(/\\/g, "/")
    .split("/")
    .map((seg) => seg.replace(/[^a-zA-Z0-9._-]+/g, "_"))
    .filter((seg) => seg && seg !== "." && seg !== "..")
    .join("/")
    .slice(0, 120);
}

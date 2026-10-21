// Os arquivos do funcionário: o conteúdo vai para o Storage (bucket ock-files) e os metadados para ock_files.
// A IA "lê" um arquivo quando o servidor extrai o texto dele (.txt/.csv/.md/.json e PDF) e coloca na entrada.
// Só o servidor usa (cliente de serviço).

import { randomUUID } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import { supabaseAdmin } from "@/lib/runs/supabase-server";
import type { Company, Member } from "./company";

const BUCKET = "ock-files";

export interface StoredFile {
  id: string;
  name: string;
  mime: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

/** Sobe um arquivo para a pasta do funcionário e guarda os metadados.
 *  kind="upload" = arquivo que o funcionário anexou; kind="delivery" = arquivo que a IA PRODUZIU (entrega). */
export async function uploadFile(
  company: Company,
  member: Member,
  file: { name: string; mime: string | null; bytes: Uint8Array },
  kind: "upload" | "delivery" = "upload",
): Promise<StoredFile> {
  const db = supabaseAdmin();
  const path = `${company.id}/${member.id}/${randomUUID()}-${safeName(file.name)}`;
  const { error: upErr } = await db.storage.from(BUCKET).upload(path, file.bytes, {
    contentType: file.mime ?? "application/octet-stream",
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data, error } = await db
    .from("ock_files")
    .insert({
      company_id: company.id,
      member_id: member.id,
      name: file.name,
      path,
      mime: file.mime,
      size_bytes: file.bytes.byteLength,
      kind,
    })
    .select("id, name, mime, size_bytes, created_at")
    .single();
  if (error) throw error;
  const r = data as { id: string; name: string; mime: string | null; size_bytes: number | null; created_at: string };
  return { id: r.id, name: r.name, mime: r.mime, sizeBytes: r.size_bytes, createdAt: r.created_at };
}

/** Uma entrega (arquivo produzido pela IA) com link de download pronto. */
export interface Delivery {
  id: string;
  name: string;
  mime: string | null;
  sizeBytes: number | null;
  createdAt: string;
  url: string | null;
}

/** Lista as ENTREGAS de um funcionário (arquivos que a IA produziu) com link de download (1 hora). */
export async function listDeliveries(memberId: string): Promise<Delivery[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("ock_files")
    .select("id, name, path, mime, size_bytes, created_at")
    .eq("member_id", memberId)
    .eq("kind", "delivery")
    .order("id", { ascending: false });
  if (error) throw error;
  type Row = { id: string; name: string; path: string; mime: string | null; size_bytes: number | null; created_at: string };
  const rows = (data as Row[] | null) ?? [];
  const out: Delivery[] = [];
  for (const r of rows) {
    const { data: signed } = await db.storage.from(BUCKET).createSignedUrl(r.path, 3600);
    out.push({
      id: r.id,
      name: r.name,
      mime: r.mime,
      sizeBytes: r.size_bytes,
      createdAt: r.created_at,
      url: signed?.signedUrl ?? null,
    });
  }
  return out;
}

/** Os arquivos de um funcionário (a "pasta" dele). */
export async function listMemberFiles(memberId: string): Promise<StoredFile[]> {
  const { data, error } = await supabaseAdmin()
    .from("ock_files")
    .select("id, name, mime, size_bytes, created_at")
    .eq("member_id", memberId)
    .order("id", { ascending: false });
  if (error) throw error;
  type Row = { id: string; name: string; mime: string | null; size_bytes: number | null; created_at: string };
  return ((data as Row[] | null) ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    mime: r.mime,
    sizeBytes: r.size_bytes,
    createdAt: r.created_at,
  }));
}

interface FileRow {
  name: string;
  path: string;
  mime: string | null;
  member_id: string;
}

async function loadFileRow(fileId: string): Promise<FileRow | null> {
  const { data, error } = await supabaseAdmin()
    .from("ock_files")
    .select("name, path, mime, member_id")
    .eq("id", fileId)
    .maybeSingle();
  if (error) throw error;
  return (data as FileRow | null) ?? null;
}

/** Baixa o arquivo do Storage como bytes. */
async function downloadBytes(path: string): Promise<Uint8Array> {
  const { data, error } = await supabaseAdmin().storage.from(BUCKET).download(path);
  if (error) throw error;
  return new Uint8Array(await data.arrayBuffer());
}

/**
 * Extrai o TEXTO de um arquivo para a IA ler. Lê .txt/.csv/.md/.json direto e PDF com o unpdf.
 * Tipos que não dão para ler como texto (imagem, docx...) voltam null — tratados fora.
 */
export async function readFileText(
  fileId: string,
  memberId: string,
): Promise<{ name: string; text: string } | null> {
  const row = await loadFileRow(fileId);
  if (!row || row.member_id !== memberId) return null; // só os próprios arquivos
  const bytes = await downloadBytes(row.path);
  const ext = row.name.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "pdf" || row.mime === "application/pdf") {
    try {
      const pdf = await getDocumentProxy(bytes);
      const result = await extractText(pdf, { mergePages: true });
      const text = Array.isArray(result.text) ? result.text.join("\n") : result.text;
      return { name: row.name, text };
    } catch {
      return { name: row.name, text: "[não consegui ler o conteúdo deste PDF]" };
    }
  }
  if (["txt", "csv", "md", "json", "tsv", "log"].includes(ext) || (row.mime ?? "").startsWith("text/")) {
    return { name: row.name, text: new TextDecoder().decode(bytes) };
  }
  return null;
}

const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/** Se o arquivo for imagem, devolve o tipo e o conteúdo em base64 para a IA "enxergar". Senão, null. */
export async function readFileImage(
  fileId: string,
  memberId: string,
): Promise<{ mime: string; base64: string } | null> {
  const row = await loadFileRow(fileId);
  if (!row || row.member_id !== memberId) return null;
  const ext = row.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = (row.mime ?? "").startsWith("image/") ? row.mime! : IMAGE_MIME[ext];
  if (!mime) return null;
  const bytes = await downloadBytes(row.path);
  return { mime, base64: Buffer.from(bytes).toString("base64") };
}

/** Link temporário para baixar o arquivo (10 minutos). */
export async function downloadUrl(fileId: string, memberId: string): Promise<string | null> {
  const row = await loadFileRow(fileId);
  if (!row || row.member_id !== memberId) return null;
  const { data, error } = await supabaseAdmin().storage.from(BUCKET).createSignedUrl(row.path, 600);
  if (error) throw error;
  return data?.signedUrl ?? null;
}

/** Limpa o nome do arquivo para usar no caminho do Storage. */
function safeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
}

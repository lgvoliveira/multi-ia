// Os arquivos de cada pessoa: os que ela anexa (upload) e os que as IAs fazem (delivery). O conteúdo fica na pasta
// fechada "files" do Storage, no caminho <empresa>/<pessoa>/..., e os dados na tabela files. SÓ do servidor.
// Ler a tabela é com a sessão de quem está logado: o banco só devolve o que a pessoa pode ver (os próprios arquivos e,
// para o dono, também as entregas da empresa). Gravar e mexer na pasta é com a chave-mestra. O arquivo só sai por um
// link de poucos minutos, que sempre baixa e nunca abre como página (AGENTS.md, seção 6).

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/runs/supabase-server";
import type { ChatDelivery, ChatFile } from "./chat";

const BUCKET = "files";
const FILES = "files";
/** Por quanto tempo vale o link de baixar. */
const DOWNLOAD_LINK_SECONDS = 300;
const COLUMNS = "id, member_id, kind, name, storage_path, mime_type, size_bytes, task_id, created_at";

export type FileKind = "upload" | "delivery";

export interface FileRow {
  id: string;
  member_id: string;
  kind: FileKind;
  name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  task_id: string | null;
  created_at: string;
}

export interface NewFile {
  companyId: string;
  memberId: string;
  kind: FileKind;
  name: string;
  /** O tipo do conteúdo, para o nosso uso (ex.: mostrar um gráfico). Na pasta, todo arquivo fica "só para baixar". */
  mime: string;
  bytes: Uint8Array;
  taskId?: string | null;
  /** A execução de receita que fez a entrega (o site da "Criar um site", F47). */
  runId?: string | null;
}

/** Guarda um arquivo na pasta da pessoa e registra na tabela. Devolve o id e o nome. */
export async function storeFile(file: NewFile): Promise<ChatFile> {
  const db = supabaseAdmin();
  const path = `${file.companyId}/${file.memberId}/${randomUUID()}-${storageName(file.name)}`;
  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(path, file.bytes, { contentType: "application/octet-stream", upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await db
    .from(FILES)
    .insert({
      company_id: file.companyId,
      member_id: file.memberId,
      kind: file.kind,
      name: displayName(file.name),
      storage_path: path,
      mime_type: file.mime.slice(0, 255),
      size_bytes: file.bytes.byteLength,
      task_id: file.taskId ?? null,
      run_id: file.runId ?? null,
    })
    .select("id, name")
    .single();
  if (error) {
    // Sem o registro, ninguém acharia o conteúdo: ele sai da pasta.
    await db.storage.from(BUCKET).remove([path]);
    throw error;
  }
  return data as ChatFile;
}

/** Os anexos da própria pessoa com estes ids (os que não forem dela, ou não existirem, não voltam). */
export async function loadOwnUploads(
  session: SupabaseClient,
  memberId: string,
  ids: readonly string[],
): Promise<FileRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await session
    .from(FILES)
    .select(COLUMNS)
    .in("id", ids)
    .eq("member_id", memberId)
    .eq("kind", "upload");
  if (error) throw error;
  return (data as FileRow[] | null) ?? [];
}

/** Liga os anexos à mensagem em que foram mandados, para a conversa mostrar quais eram. */
export async function linkUploadsToTask(ids: readonly string[], taskId: string): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabaseAdmin().from(FILES).update({ task_id: taskId }).in("id", ids).is("task_id", null);
  if (error) throw error;
}

/** Os arquivos (anexos e entregas) da própria pessoa ligados a estas mensagens, em ordem. */
export async function loadTaskFiles(
  session: SupabaseClient,
  memberId: string,
  taskIds: readonly string[],
): Promise<FileRow[]> {
  if (taskIds.length === 0) return [];
  const { data, error } = await session
    .from(FILES)
    .select(COLUMNS)
    .in("task_id", taskIds)
    .eq("member_id", memberId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as FileRow[] | null) ?? [];
}

/** As entregas da própria pessoa (o que as IAs fizeram para ela), das mais novas para as mais antigas. */
export function listOwnDeliveries(session: SupabaseClient, memberId: string, limit = 200): Promise<ChatDelivery[]> {
  return listMemberDeliveries(session, memberId, { limit });
}

/**
 * As entregas de uma pessoa, das mais novas para as mais antigas, desde `since` (sem ele, todas). Pela sessão: o dono
 * enxerga as entregas da equipe; o funcionário, só as dele (as de outra pessoa não voltam).
 */
export async function listMemberDeliveries(
  session: SupabaseClient,
  memberId: string,
  options: { since?: Date; limit?: number } = {},
): Promise<ChatDelivery[]> {
  let query = session.from(FILES).select("id, name, created_at").eq("member_id", memberId).eq("kind", "delivery");
  if (options.since) query = query.gte("created_at", options.since.toISOString());
  const { data, error } = await query.order("created_at", { ascending: false }).limit(options.limit ?? 200);
  if (error) throw error;
  return ((data as { id: string; name: string; created_at: string }[] | null) ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  }));
}

/** Se a execução de receita já guardou a entrega dela (para não guardar o mesmo site duas vezes). */
export async function hasRunDelivery(runId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from(FILES)
    .select("id")
    .eq("run_id", runId)
    .eq("kind", "delivery")
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

/** Um arquivo que a pessoa pode ver (os dela e, para o dono, as entregas da empresa), ou null. */
export async function loadVisibleFile(session: SupabaseClient, id: string): Promise<FileRow | null> {
  const { data, error } = await session.from(FILES).select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as FileRow | null) ?? null;
}

/** O conteúdo de um arquivo da pasta. Só depois de conferir, pela sessão, que a pessoa pode vê-lo. */
export async function readStoredFile(path: string): Promise<Uint8Array> {
  const { data, error } = await supabaseAdmin().storage.from(BUCKET).download(path);
  if (error) throw error;
  return new Uint8Array(await data.arrayBuffer());
}

/** Um link de poucos minutos que baixa o arquivo com o nome dele. Só depois de conferir, pela sessão, quem pede. */
export async function downloadLink(file: Pick<FileRow, "storage_path" | "name">): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .storage.from(BUCKET)
    .createSignedUrl(file.storage_path, DOWNLOAD_LINK_SECONDS, { download: file.name });
  if (error) throw error;
  return data.signedUrl;
}

/** O nome mostrado na tela e usado ao baixar: sem caminho de pasta, com até 255 caracteres. */
export function displayName(name: string): string {
  const base = name.split(/[\\/]/).pop()?.trim() ?? "";
  return (base || "arquivo").slice(0, 255);
}

/** O nome no caminho da pasta: só letras sem acento, números e . _ - */
function storageName(name: string): string {
  return (
    displayName(name)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 80) || "arquivo"
  );
}

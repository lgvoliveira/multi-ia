// O chat no navegador: mandar mensagens, anexar arquivos e ler as conversas, as entregas e os gastos, sempre pelas
// rotas /api/ock/*. Quem está pedindo vem do login; o id de quem abriu a página vai junto nos botões que mudam alguma
// coisa, para o servidor recusar se o login mudou em outra aba (F34).

import { PAGE_MEMBER_FIELD } from "@/lib/auth/page-member";
import {
  isReadableAttachment,
  MAX_ATTACHMENT_BYTES,
  UNREADABLE_ATTACHMENT,
  type ChatConversation,
  type ChatFile,
  type ChatFolder,
  type ChatTask,
  type DeliveriesData,
  type MonthSpending,
  type SendResult,
} from "./chat";
import type { MemberMonthDetails, StatementLine } from "./statement";

export const OFFLINE_PROBLEM = "Não conseguimos falar com o servidor. Confira sua internet e tente de novo.";
export const SERVER_PROBLEM = "Algo deu errado do nosso lado. Tente de novo daqui a pouco.";

export type Fetched<T> = { ok: true; data: T } | { ok: false; problem: string };

export interface SendBody {
  message: string;
  conversationId: string | null;
  fileIds: string[];
  pageMemberId: string;
}

/** Manda uma mensagem e espera a resposta (com as IAs de verdade, pode levar alguns minutos). */
export function sendMessage(body: SendBody, send: typeof fetch = fetch): Promise<Fetched<SendResult>> {
  const { pageMemberId, ...rest } = body;
  return request<SendResult>(
    "/api/ock",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rest, [PAGE_MEMBER_FIELD]: pageMemberId }),
    },
    send,
  );
}

/** Anexa um arquivo. Tipo que a IA não lê, ou grande demais, é recusado aqui mesmo, sem enviar. */
export async function uploadAttachment(
  file: File,
  pageMemberId: string,
  send: typeof fetch = fetch,
): Promise<Fetched<ChatFile>> {
  if (!isReadableAttachment(file.name)) return { ok: false, problem: UNREADABLE_ATTACHMENT };
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, problem: `O arquivo passou de ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB. Anexe um menor.` };
  }
  const form = new FormData();
  form.append(PAGE_MEMBER_FIELD, pageMemberId);
  form.append("file", file);
  const result = await request<{ file: ChatFile }>("/api/ock/files", { method: "POST", body: form }, send);
  return result.ok ? { ok: true, data: result.data.file } : result;
}

/** O que volta de um ditado: o texto, quanto custou e o gasto do mês atualizado. */
export interface Dictation {
  text: string;
  costCents: number;
  month: MonthSpending;
}

/** Manda o áudio ditado para transcrever (a voz do chat). */
export function transcribeAudio(audio: Blob, pageMemberId: string, send: typeof fetch = fetch): Promise<Fetched<Dictation>> {
  const form = new FormData();
  form.append(PAGE_MEMBER_FIELD, pageMemberId);
  form.append("audio", audio, "ditado");
  return request<Dictation>("/api/ock/transcribe", { method: "POST", body: form }, send);
}

export async function listConversations(send: typeof fetch = fetch): Promise<Fetched<ChatConversation[]>> {
  const result = await request<{ conversations: ChatConversation[] }>("/api/ock/conversations", {}, send);
  return result.ok ? { ok: true, data: result.data.conversations } : result;
}

export function loadConversation(
  id: string,
  send: typeof fetch = fetch,
): Promise<Fetched<{ conversation: ChatConversation; tasks: ChatTask[] }>> {
  return request(`/api/ock/conversations/${encodeURIComponent(id)}`, {}, send);
}

/** As entregas da pessoa e as pastas (tarefas) em que ela organiza. */
export function loadDeliveries(send: typeof fetch = fetch): Promise<Fetched<DeliveriesData>> {
  return request<DeliveriesData>("/api/ock/deliveries", {}, send);
}

/** Cria uma pasta (tarefa) para organizar as entregas. */
export function createFolder(
  name: string,
  pageMemberId: string,
  send: typeof fetch = fetch,
): Promise<Fetched<{ folder: ChatFolder }>> {
  return request(
    "/api/ock/folders",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, [PAGE_MEMBER_FIELD]: pageMemberId }),
    },
    send,
  );
}

/** Renomeia uma pasta. */
export function renameFolder(
  id: string,
  name: string,
  pageMemberId: string,
  send: typeof fetch = fetch,
): Promise<Fetched<{ ok: true }>> {
  return request(
    "/api/ock/folders",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, [PAGE_MEMBER_FIELD]: pageMemberId }),
    },
    send,
  );
}

/** Apaga uma pasta (as entregas dentro dela voltam para "sem pasta"). */
export function deleteFolder(
  id: string,
  pageMemberId: string,
  send: typeof fetch = fetch,
): Promise<Fetched<{ ok: true }>> {
  return request(
    "/api/ock/folders",
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, [PAGE_MEMBER_FIELD]: pageMemberId }),
    },
    send,
  );
}

/** Move uma entrega para uma pasta (folderId) ou para "sem pasta" (folderId null). */
export function moveDelivery(
  deliveryId: string,
  folderId: string | null,
  pageMemberId: string,
  send: typeof fetch = fetch,
): Promise<Fetched<{ ok: true }>> {
  return request(
    "/api/ock/deliveries",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryId, folderId, [PAGE_MEMBER_FIELD]: pageMemberId }),
    },
    send,
  );
}

export function loadSpending(
  send: typeof fetch = fetch,
): Promise<Fetched<{ month: MonthSpending; lines: StatementLine[]; more: boolean }>> {
  return request("/api/ock/spending", {}, send);
}

/** Para o painel do dono: o que uma pessoa da equipe fez no mês (as linhas do extrato e as entregas). */
export function loadMemberMonth(memberId: string, send: typeof fetch = fetch): Promise<Fetched<MemberMonthDetails>> {
  return request(`/api/ock/team/${encodeURIComponent(memberId)}`, {}, send);
}

/** O endereço para baixar um arquivo (o servidor confere quem pede e manda para um link que só baixa). */
export function fileUrl(id: string): string {
  return `/api/ock/files/${encodeURIComponent(id)}`;
}

async function request<T>(url: string, init: RequestInit, send: typeof fetch): Promise<Fetched<T>> {
  let response: Response;
  try {
    response = await send(url, { cache: "no-store", ...init });
  } catch {
    return { ok: false, problem: OFFLINE_PROBLEM };
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // A resposta não veio no formato combinado (ex.: o servidor caiu antes de responder).
  }
  if (response.ok && body !== null) return { ok: true, data: body as T };
  const problem = (body as { problem?: unknown } | null)?.problem;
  return { ok: false, problem: typeof problem === "string" && problem ? problem : SERVER_PROBLEM };
}

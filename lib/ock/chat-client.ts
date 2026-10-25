// O chat no navegador: mandar mensagens, anexar arquivos e ler as conversas, as entregas e os gastos, sempre pelas
// rotas /api/ock/*. Quem está pedindo vem do login; o id de quem abriu a página vai junto nos botões que mudam alguma
// coisa, para o servidor recusar se o login mudou em outra aba (F34).

import { PAGE_MEMBER_FIELD } from "@/lib/auth/page-member";
import {
  isReadableAttachment,
  MAX_ATTACHMENT_BYTES,
  UNREADABLE_ATTACHMENT,
  type ChatConversation,
  type ChatDelivery,
  type ChatFile,
  type ChatTask,
  type MonthSpending,
  type SendResult,
  type SpendingEntry,
} from "./chat";

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

export async function loadDeliveries(send: typeof fetch = fetch): Promise<Fetched<ChatDelivery[]>> {
  const result = await request<{ deliveries: ChatDelivery[] }>("/api/ock/deliveries", {}, send);
  return result.ok ? { ok: true, data: result.data.deliveries } : result;
}

export function loadSpending(
  send: typeof fetch = fetch,
): Promise<Fetched<{ month: MonthSpending; entries: SpendingEntry[] }>> {
  return request("/api/ock/spending", {}, send);
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

// O que as rotas do chat (/api/ock/*) conferem em todo pedido: quem está pedindo e, numa mensagem, o formato do que
// chegou pela internet. SÓ do servidor. Quem pede vem sempre do login, nunca do endereço nem do corpo do pedido (F13,
// F16); o id de quem abriu a página, que a tela manda, só serve para recusar quando o login mudou em outra aba (F34).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentMember } from "@/lib/auth/member";
import { checkPageMember } from "@/lib/auth/page-member";
import { signedInSession } from "@/lib/auth/session";
import { getViewer } from "@/lib/auth/viewer";
import { MAX_ATTACHMENTS, MAX_MESSAGE_CHARS } from "./chat";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Se o texto tem o formato de um id do banco. Outro formato nem chega ao banco. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** A recusa de uma rota do chat, no formato que a tela lê. */
export function chatProblem(status: number, problem: string): Response {
  return Response.json({ problem }, { status, headers: { "Cache-Control": "no-store" } });
}

export const SERVER_PROBLEM = "Algo deu errado do nosso lado. Tente de novo daqui a pouco.";

export type ChatCaller = { ok: true; me: CurrentMember; session: SupabaseClient } | { ok: false; response: Response };

/** Quem está pedindo, para ler: logado, da empresa e ativo. Devolve a pessoa e a sessão dela, ou a recusa pronta. */
export async function chatCaller(): Promise<ChatCaller> {
  const viewer = await getViewer();
  if (viewer.status === "signed-out") return refuse(401, "Entre de novo para continuar.");
  if (viewer.status !== "member") return refuse(403, "A sua conta não tem mais acesso a esta empresa.");
  return withSession(viewer.member);
}

/**
 * Quem está pedindo, para mudar alguma coisa (mandar mensagem, anexar): além de logado, da empresa e ativo, precisa ser
 * a pessoa que abriu a página (`pageMemberId`, que a tela manda). Sem ele, ou com outro, recusa (F34).
 */
export async function pageCaller(pageMemberId: unknown): Promise<ChatCaller> {
  const check = checkPageMember(await getViewer(), pageMemberId);
  if (!check.ok) return refuse(check.status, check.message);
  return withSession(check.me);
}

async function withSession(me: CurrentMember): Promise<ChatCaller> {
  const session = await signedInSession();
  if (!session) return refuse(401, "Entre de novo para continuar.");
  return { ok: true, me, session };
}

function refuse(status: number, problem: string): ChatCaller {
  return { ok: false, response: chatProblem(status, problem) };
}

/** Uma mensagem enviada, já conferida. */
export interface SendInput {
  message: string;
  conversationId: string | null;
  fileIds: string[];
  /** O agente pronto escolhido ao começar a conversa (só o id; o servidor confere no catálogo). */
  agentId: string | null;
}

/** O id de um agente tem o formato "area-nome" (letras, números e hífen), curto. Outro formato nem é considerado. */
const AGENT_ID_PATTERN = /^[a-z0-9-]{1,64}$/;

/** Confere o corpo de uma mensagem enviada. Devolve a mensagem ou o problema, em português. */
export function parseSendBody(body: unknown): { ok: true; input: SendInput } | { ok: false; problem: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, problem: "Não entendemos o pedido enviado." };
  }
  const data = body as Record<string, unknown>;

  const message = typeof data.message === "string" ? data.message.trim() : "";
  if (data.message !== undefined && typeof data.message !== "string") {
    return { ok: false, problem: "Não entendemos a mensagem enviada." };
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return {
      ok: false,
      problem: `A mensagem passou de ${MAX_MESSAGE_CHARS.toLocaleString("pt-BR")} caracteres. Encurte e mande de novo.`,
    };
  }

  const conversationId = data.conversationId ?? null;
  if (conversationId !== null && !isUuid(conversationId)) {
    return { ok: false, problem: "Esta conversa não foi encontrada. Abra outra ou comece um chat novo." };
  }

  const rawFiles = data.fileIds ?? [];
  if (!Array.isArray(rawFiles) || !rawFiles.every(isUuid)) {
    return { ok: false, problem: "Um dos arquivos anexados não foi encontrado. Anexe de novo." };
  }
  const fileIds = [...new Set(rawFiles)];
  if (fileIds.length > MAX_ATTACHMENTS) {
    return { ok: false, problem: `Dá para anexar até ${MAX_ATTACHMENTS} arquivos por mensagem.` };
  }
  if (!message && fileIds.length === 0) {
    return { ok: false, problem: "Escreva o que você precisa ou anexe um arquivo." };
  }

  // O agente só vale ao começar uma conversa; o servidor ainda confere se o id existe no catálogo.
  const agentId = typeof data.agentId === "string" && AGENT_ID_PATTERN.test(data.agentId) ? data.agentId : null;

  return { ok: true, input: { message, conversationId, fileIds, agentId } };
}

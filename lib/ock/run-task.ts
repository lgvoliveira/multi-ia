// Uma mensagem do chat (a tarefa rápida), do pedido à resposta. SÓ do servidor. O Chefe decide quem responde, a IA
// responde e a OCK cobra da carteira da empresa, com as regras das receitas (AGENTS.md, seção 5):
//  1. Antes de qualquer IA, reserva o máximo que o Chefe pode gastar: o banco confere saldo, teto do mês e se a pessoa
//     está ativa, numa operação só (F24). Recusou: nenhuma IA trabalha.
//  2. O Chefe decide, numa tentativa só (se falhar, vale a regra simples), e essa reserva fecha.
//  3. Reserva o que o Chefe gastou mais o máximo que a resposta pode custar. Recusou: nada é cobrado (o Chefe, frações
//     de centavo, fica por conta da plataforma, no registro interno).
//  4. A IA responde, com até 2 novas tentativas. Deu certo: a resposta é gravada e vira uma linha de gasto só, pelo
//     consumo real do Chefe e da resposta. Falhou: a mensagem fica com o aviso, e nada é cobrado.
// No fim, as reservas fecham (a sobra volta) e toda chamada às IAs vai para ai_calls, cobrada ou não (F26).
// No chat não há estimativa antes de cada mensagem (decisão do Luis de 25/10/2026, issue #39): a tela mostra o custo
// depois, em cada resposta.

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentMember } from "@/lib/auth/member";
import type { AiCallReport } from "@/lib/engine/types";
import { aiTools, type ToolSwitch } from "@/lib/providers/mode";
import type { ImageGenerator } from "@/lib/providers/images";
import { getImageGenerator, getProvider as platformProvider } from "@/lib/providers/registry";
import { ProviderError, type AiProvider, type GenerateRequest, type ProviderId } from "@/lib/providers/types";
import { recordAiCalls } from "@/lib/runs/store";
import {
  chargeTask,
  closeHold,
  reserveForTask,
  taskRefusalMessage,
  WalletRefusedError,
  type WalletRefusalReason,
} from "@/lib/runs/wallet";
import { agentPersona } from "./agent-persona";
import { findAgent } from "./agents";
import { callAi, callImage } from "./ai-call";
import { readAttachment } from "./attachments";
import { parseChartSpec, renderChart } from "./chart";
import { ATTACHMENTS_ONLY_PROMPT, type ChatConversation, type ChatFile, type ChatTask, type SendResult } from "./chat";
import { heuristicRoute, parseRoute, ROUTER, routerRequest, type Route } from "./chief";
import { CHART_MIME, previewDataUrl } from "./conversation-view";
import { generateDocument } from "./document";
import { linkUploadsToTask, loadOwnUploads, readStoredFile, storeFile, type FileRow } from "./files";
import { generateZip, parseProjectFiles } from "./project";
import {
  actionNotice,
  AI_FAILED,
  answerHoldCents,
  attachmentContext,
  buildWorkerInput,
  callUsd,
  CHART_FAILED,
  chargeDescription,
  chiefMaxCents,
  conversationTitle,
  documentTitle,
  historyText,
  IMAGE_FAILED,
  IMAGE_READY,
  IMAGE_UNAVAILABLE,
  planWork,
  PROJECT_FAILED,
  taskAiCallRows,
  taskChargeCents,
  toolNotes,
  workRequest,
  type AttachmentText,
  type WorkPlan,
} from "./quick-task";
import { loadMonth } from "./spending";
import {
  createOwnConversation,
  createTask,
  finishTask,
  loadOwnConversation,
  loadOwnTasks,
  touchConversation,
  type NewTask,
} from "./task-store";

/** Os nomes das chamadas no registro interno. */
const CHIEF_STEP = "chief";
const ANSWER_STEP = "answer";

/** Quantas mensagens anteriores são lidas para montar o contexto (só as respondidas entram). */
const HISTORY_ROWS = 20;

const FILE_FAILED = "Não consegui gerar o arquivo. Nada foi cobrado. Tente de novo.";

export interface QuickTaskRequest {
  /** A mensagem (pode vir vazia quando há anexos). */
  message: string;
  /** A conversa em que a mensagem entra; vazio começa uma conversa nova. */
  conversationId: string | null;
  /** Os anexos, já enviados para a pasta da pessoa (/api/ock/files). */
  fileIds: string[];
  /** Ao começar uma conversa nova, o agente pronto escolhido (lib/ock/agents.ts); null é um chat comum. */
  agentId?: string | null;
}

export type QuickTaskResult = { ok: true; result: SendResult } | { ok: false; status: 402 | 404; problem: string };

export interface QuickTaskOptions {
  /** Quem entrega as IAs. Sem valor, o mesmo das receitas: a simulada ou a de verdade, conforme OCK_AI_MODE. */
  getProvider?: (id: ProviderId) => AiProvider;
  /** As ferramentas ligadas (pesquisa, código, imagem). Sem valor, as do interruptor OCK_AI_TOOLS. */
  tools?: ReadonlySet<ToolSwitch>;
  /** Quem cria as imagens. Sem valor, o mesmo das IAs: o simulado ou o GPT Image de verdade, conforme OCK_AI_MODE. */
  getImageGenerator?: () => ImageGenerator;
  /** Os testes trocam a espera entre as tentativas. */
  wait?: (ms: number) => Promise<void>;
}

/** O que acontece durante a mensagem e precisa ser acertado no fim, dê certo ou não. */
interface Ledger {
  holds: string[];
  calls: AiCallReport[];
  charged: boolean;
}

/**
 * Responde uma mensagem de quem está logado (`me`, com a sessão dele). Erro inesperado (banco fora do ar, defeito no
 * nosso código) é repassado, mas antes as reservas fecham e as chamadas às IAs ficam registradas.
 */
export async function runQuickTask(
  me: CurrentMember,
  session: SupabaseClient,
  request: QuickTaskRequest,
  options: QuickTaskOptions = {},
): Promise<QuickTaskResult> {
  const taskId = randomUUID();
  const ledger: Ledger = { holds: [], calls: [], charged: false };
  try {
    return await answerMessage(me, session, request, options, taskId, ledger);
  } finally {
    await settle(ledger, { companyId: me.companyId, memberId: me.id, taskId });
  }
}

async function answerMessage(
  me: CurrentMember,
  session: SupabaseClient,
  request: QuickTaskRequest,
  options: QuickTaskOptions,
  taskId: string,
  ledger: Ledger,
): Promise<QuickTaskResult> {
  const getProvider = options.getProvider ?? platformProvider;
  const onCall = (report: AiCallReport) => ledger.calls.push(report);
  const isOwner = me.role === "owner";

  // A conversa e os anexos: só os da própria pessoa (a sessão não devolve os de outra).
  const existing = request.conversationId ? await loadOwnConversation(session, request.conversationId) : null;
  if (request.conversationId && !existing) {
    return refuse(404, "Esta conversa não foi encontrada. Abra outra ou comece um chat novo.");
  }
  // O agente da conversa: numa conversa que continua, o que ela já tem; numa nova, o escolhido (se existir no catálogo).
  // A persona (a instrução dele) só o servidor conhece; a tela manda só o id.
  const newAgentId = request.agentId && findAgent(request.agentId) ? request.agentId : null;
  const agentId = existing ? existing.agentId : newAgentId;
  const persona = agentId ? agentPersona(agentId) : undefined;

  const uploads = await loadAttachments(session, me.id, request.fileIds);
  if (!uploads) return refuse(404, "Um dos arquivos anexados não foi encontrado. Anexe de novo.");

  const message = request.message.trim();
  const prompt = message || ATTACHMENTS_ONLY_PROMPT;
  const attachments = await readAttachments(uploads);
  const history = existing ? await recentHistory(session, existing.id) : "";

  // 1 e 2. O Chefe decide, com o máximo que ele pode gastar já reservado.
  const chiefRequest = routerRequest(prompt, history);
  const chiefHold = await reserve(me.id, taskId, chiefMaxCents(chiefRequest));
  if (!chiefHold.ok) return refuse(402, taskRefusalMessage(chiefHold.reason, isOwner, null));
  ledger.holds.push(chiefHold.id);
  const route = await decide(getProvider, chiefRequest, prompt, onCall);
  await closeHold(chiefHold.id);

  const plan = planWork(route, prompt, options.tools ?? aiTools(), persona);
  const newTask = (conversation: ChatConversation): NewTask => ({
    id: taskId,
    company_id: me.companyId,
    member_id: me.id,
    conversation_id: conversation.id,
    prompt,
    action: plan.action,
    // Até a escolha livre (etapa 6, F03), a pessoa fica com o que o Chefe recomendou.
    recommended_provider: plan.provider,
    recommended_tier: plan.tier,
    recommended_effort: plan.effort,
    chosen_provider: plan.provider,
    chosen_tier: plan.tier,
    chosen_effort: plan.effort,
  });
  const view = (conversation: ChatConversation, outcome: Outcome, costCents: number): ChatTask => ({
    id: taskId,
    prompt,
    answer: outcome.answer,
    status: outcome.status,
    action: plan.action,
    provider: plan.provider,
    tier: plan.tier,
    effort: plan.effort,
    reason: plan.reason ?? (route.reason || null),
    notice: outcome.status === "finished" ? actionNotice(plan.action, outcome.answer) : null,
    costCents,
    attachmentsCut: attachments.cut,
    createdAt: new Date().toISOString(),
    attachments: uploads.map(toChatFile),
    deliveries: outcome.deliveries,
    chart: outcome.chart,
  });

  // Imagem ainda não existe aqui (decisão 2 da issue #39): responde sem chamar IA e sem cobrar.
  if (plan.kind === "unavailable") {
    const conversation =
      existing ?? (await createOwnConversation(session, conversationTitle(message, names(uploads)), newAgentId));
    await createTask({ ...newTask(conversation), status: "finished", answer: IMAGE_UNAVAILABLE, finished_at: now() });
    await linkUploadsToTask(request.fileIds, taskId);
    const outcome: Outcome = { status: "finished", answer: IMAGE_UNAVAILABLE, deliveries: [], chart: null };
    return done(session, me, conversation, view(conversation, outcome, 0));
  }

  // 3. A reserva da resposta: o que o Chefe gastou e o máximo da IA que vai responder.
  // A imagem é criada só a partir do pedido; as outras respostas leem a conversa e os anexos.
  const work =
    plan.kind === "image"
      ? workRequest(plan, prompt)
      : workRequest(plan, buildWorkerInput(history, attachments.text, prompt), attachments.images);
  const chiefUsd = ledger.calls.filter((call) => call.ok).reduce((total, call) => total + callUsd(call), 0);
  const holdCents = answerHoldCents(chiefUsd, plan, work);
  const answerHold = await reserve(me.id, taskId, holdCents);
  if (!answerHold.ok) return refuse(402, taskRefusalMessage(answerHold.reason, isOwner, holdCents));
  ledger.holds.push(answerHold.id);

  const conversation =
    existing ?? (await createOwnConversation(session, conversationTitle(message, names(uploads)), newAgentId));
  await createTask(newTask(conversation));
  await linkUploadsToTask(request.fileIds, taskId);

  // 4. A IA responde. A resposta é gravada antes da cobrança: se o servidor cair entre as duas, ninguém paga por uma
  // resposta perdida.
  const outcome = await produce(plan, work, prompt, {
    me,
    taskId,
    getProvider,
    getImageGenerator: options.getImageGenerator ?? getImageGenerator,
    onCall,
    wait: options.wait,
  });
  await finishTask(taskId, outcome.status, outcome.answer);

  let costCents = 0;
  if (outcome.status === "finished") {
    const amountCents = taskChargeCents(ledger.calls);
    const remaining = await chargeTask(answerHold.id, taskId, {
      amountCents,
      description: chargeDescription(plan.action),
      provider: plan.provider,
    });
    ledger.charged = remaining !== null;
    if (ledger.charged) costCents = amountCents;
  }
  return done(session, me, conversation, view(conversation, outcome, costCents));
}

/** A resposta pronta (ou o aviso de que não deu), com os arquivos que a IA fez. */
interface Outcome {
  status: "finished" | "failed";
  answer: string;
  deliveries: ChatFile[];
  chart: string | null;
}

interface ProduceContext {
  me: CurrentMember;
  taskId: string;
  getProvider: (id: ProviderId) => AiProvider;
  getImageGenerator: () => ImageGenerator;
  onCall: (report: AiCallReport) => void;
  wait?: (ms: number) => Promise<void>;
}

/** A IA responde e, quando foi pedido um arquivo, a OCK o monta e guarda na pasta da pessoa. */
async function produce(plan: WorkPlan, work: GenerateRequest, prompt: string, context: ProduceContext): Promise<Outcome> {
  if (plan.kind === "image") return makeImage(work.input, context);
  let text: string;
  let notes: string;
  try {
    const answer = await callAi(context.getProvider(plan.provider), work, {
      stepId: ANSWER_STEP,
      onCall: context.onCall,
      wait: context.wait,
    });
    text = answer.text;
    notes = toolNotes(answer);
  } catch (error) {
    if (!(error instanceof ProviderError)) throw error;
    console.error(`[chat] A IA (${plan.provider}) não conseguiu responder a mensagem ${context.taskId}:`, error.message);
    return failed(AI_FAILED);
  }

  // As fontes da pesquisa e o aviso do programa rodado vão escritos no fim da resposta (e ficam no histórico).
  if (plan.kind === "answer") return finished(text.trimEnd() + notes);
  try {
    return await makeDelivery(plan, text, context);
  } catch (error) {
    console.error(`[chat] Não consegui montar o arquivo da mensagem ${context.taskId}:`, error);
    return failed(FILE_FAILED);
  }
}

/** A IA cria a imagem, e a OCK a guarda como entrega da pessoa e a mostra na conversa. */
async function makeImage(prompt: string, context: ProduceContext): Promise<Outcome> {
  let image;
  try {
    image = await callImage(context.getImageGenerator(), prompt, {
      stepId: ANSWER_STEP,
      onCall: context.onCall,
      wait: context.wait,
    });
  } catch (error) {
    if (!(error instanceof ProviderError)) throw error;
    console.error(`[chat] Não consegui criar a imagem da mensagem ${context.taskId}:`, error.message);
    return failed(IMAGE_FAILED);
  }
  try {
    const name = image.mime === "image/png" ? "imagem.png" : "imagem.jpg";
    const file = await storeFile({
      companyId: context.me.companyId,
      memberId: context.me.id,
      kind: "delivery",
      name,
      mime: image.mime,
      bytes: image.bytes,
      taskId: context.taskId,
    });
    return finished(IMAGE_READY, [file], previewDataUrl(image.bytes, image.mime));
  } catch (error) {
    console.error(`[chat] Não consegui guardar a imagem da mensagem ${context.taskId}:`, error);
    return failed(FILE_FAILED);
  }
}

async function makeDelivery(plan: WorkPlan, text: string, context: ProduceContext): Promise<Outcome> {
  const deliver = (name: string, mime: string, bytes: Uint8Array) =>
    storeFile({
      companyId: context.me.companyId,
      memberId: context.me.id,
      kind: "delivery",
      name,
      mime,
      bytes,
      taskId: context.taskId,
    });

  if (plan.kind === "document") {
    const format = plan.format ?? "pdf";
    const doc = await generateDocument(documentTitle(text, format), text, format);
    const file = await deliver(doc.name, doc.mime, doc.bytes);
    return finished(`Pronto! Gerei o arquivo ${doc.name}. É só baixar aqui embaixo.`, [file]);
  }
  if (plan.kind === "chart") {
    // A IA manda só os dados; quem desenha é a OCK, sem rodar nada do que a IA escreveu.
    const spec = parseChartSpec(text);
    if (!spec) return failed(CHART_FAILED);
    const svg = new TextEncoder().encode(renderChart(spec));
    const file = await deliver("grafico.svg", CHART_MIME, svg);
    return finished(`Gráfico pronto: ${spec.title}`, [file], previewDataUrl(svg, CHART_MIME));
  }
  const files = parseProjectFiles(text);
  if (files.length === 0) return failed(PROJECT_FAILED);
  const file = await deliver("projeto.zip", "application/zip", await generateZip(files));
  const list = files
    .map((projectFile) => projectFile.path)
    .slice(0, 8)
    .join(", ");
  return finished(`Projeto pronto com ${files.length} arquivo(s): ${list}. Baixe o .zip aqui embaixo.`, [file]);
}

function finished(answer: string, deliveries: ChatFile[] = [], chart: string | null = null): Outcome {
  return { status: "finished", answer, deliveries, chart };
}

function failed(answer: string): Outcome {
  return { status: "failed", answer, deliveries: [], chart: null };
}

/** O Chefe decide numa tentativa só: se a IA falhar ou responder fora do formato, vale a regra simples. */
async function decide(
  getProvider: (id: ProviderId) => AiProvider,
  request: GenerateRequest,
  prompt: string,
  onCall: (report: AiCallReport) => void,
): Promise<Route> {
  try {
    const answer = await callAi(getProvider(ROUTER.provider), request, { stepId: CHIEF_STEP, onCall, retryDelaysMs: [] });
    const route = parseRoute(answer.text);
    if (route) return route;
  } catch (error) {
    // Não adianta esperar: a regra simples resolve. Defeito no nosso código fica registrado.
    if (!(error instanceof ProviderError)) console.error("[chat] Falha inesperada no Chefe:", error);
  }
  return heuristicRoute(prompt);
}

/** Os anexos, na ordem em que a pessoa os mandou, ou null se algum não é dela (ou não existe). */
async function loadAttachments(
  session: SupabaseClient,
  memberId: string,
  fileIds: readonly string[],
): Promise<FileRow[] | null> {
  const rows = await loadOwnUploads(session, memberId, fileIds);
  const ordered = fileIds.map((id) => rows.find((row) => row.id === id));
  return ordered.every((row) => row !== undefined) ? (ordered as FileRow[]) : null;
}

/** O que a IA recebe dos anexos: o texto (até o limite, F44) e as imagens. */
async function readAttachments(uploads: readonly FileRow[]) {
  const texts: AttachmentText[] = [];
  const images: { mime: string; base64: string }[] = [];
  for (const file of uploads) {
    const content = await readAttachment(file.name, await readStoredFile(file.storage_path));
    if (content?.kind === "text") texts.push({ name: file.name, text: content.text });
    if (content?.kind === "image") images.push({ mime: content.mime, base64: content.base64 });
  }
  const context = attachmentContext(texts);
  return { text: context.text, cut: context.cut, images };
}

/** As últimas trocas respondidas da conversa, para a IA "lembrar" (as que falharam ficam de fora). */
async function recentHistory(session: SupabaseClient, conversationId: string): Promise<string> {
  const rows = await loadOwnTasks(session, conversationId, HISTORY_ROWS);
  return historyText(rows.filter((row) => row.status === "finished"));
}

type Reservation = { ok: true; id: string } | { ok: false; reason: WalletRefusalReason };

async function reserve(memberId: string, taskId: string, amountCents: number): Promise<Reservation> {
  try {
    return { ok: true, id: await reserveForTask(memberId, taskId, amountCents) };
  } catch (error) {
    if (error instanceof WalletRefusedError) return { ok: false, reason: error.reason };
    throw error;
  }
}

/** Fim de uma mensagem que deu certo (ou que falhou com aviso): sobe a conversa na lista e lê o gasto do mês. */
async function done(
  session: SupabaseClient,
  me: CurrentMember,
  conversation: ChatConversation,
  task: ChatTask,
): Promise<QuickTaskResult> {
  await touchConversation(conversation.id);
  const month = await loadMonth(session, me.id);
  return { ok: true, result: { conversation: { ...conversation, updatedAt: now() }, task, month } };
}

/** Fecha as reservas (a sobra volta ao saldo) e registra as chamadas às IAs. Nunca derruba a resposta. */
async function settle(ledger: Ledger, ids: { companyId: string; memberId: string; taskId: string }): Promise<void> {
  for (const holdId of ledger.holds) {
    try {
      await closeHold(holdId);
    } catch (error) {
      // A reserva para de segurar o saldo sozinha quando vence (15 minutos).
      console.error(`[chat] Não consegui fechar a reserva ${holdId}:`, error);
    }
  }
  try {
    await recordAiCalls(taskAiCallRows(ids, ledger.calls, ledger.charged));
  } catch (error) {
    console.error(`[chat] Não consegui registrar as chamadas às IAs da mensagem ${ids.taskId}:`, error);
  }
}

function refuse(status: 402 | 404, problem: string): QuickTaskResult {
  return { ok: false, status, problem };
}

function names(files: readonly FileRow[]): string[] {
  return files.map((file) => file.name);
}

function toChatFile(file: FileRow): ChatFile {
  return { id: file.id, name: file.name };
}

function now(): string {
  return new Date().toISOString();
}

// Uma conversa do chat do jeito que a tela mostra: as mensagens, quanto cada uma custou, os anexos, as entregas e os
// gráficos desenhados. SÓ do servidor. Tudo é lido com a sessão de quem está logado, então só a própria pessoa vê.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatConversation, ChatFile, ChatTask } from "./chat";
import { readStoredFile, loadTaskFiles, type FileRow } from "./files";
import { actionNotice } from "./quick-task";
import { loadOwnConversation, loadOwnTasks, sumOwnTaskCharges, type TaskRow } from "./task-store";

/** O tipo dos gráficos que a OCK desenha. */
export const CHART_MIME = "image/svg+xml";

/** Gráfico maior que isto não é mostrado na conversa (só fica para baixar). Os nossos têm poucos KB. */
const MAX_CHART_BYTES = 200_000;

/**
 * Uma mensagem que ficou "respondendo" por mais tempo que isto parou no meio (o servidor caiu): a tela avisa. Nada foi
 * cobrado, porque a resposta é gravada antes da cobrança.
 */
const STALE_TASK_MS = 6 * 60 * 1000;

export const STALE_TASK_ANSWER = "Esta resposta não chegou: o servidor parou no meio. Nada foi cobrado. Tente de novo.";

/** O gráfico desenhado, para mostrar dentro de uma imagem (assim, nada dele roda na nossa página). */
export function chartDataUrl(svg: Uint8Array): string {
  return `data:${CHART_MIME};base64,${Buffer.from(svg).toString("base64")}`;
}

export interface ConversationView {
  conversation: ChatConversation;
  tasks: ChatTask[];
}

/** A conversa da própria pessoa, com as mensagens mais recentes, ou null se ela não existe ou é de outra pessoa. */
export async function loadConversationView(
  session: SupabaseClient,
  memberId: string,
  conversationId: string,
  now = Date.now(),
): Promise<ConversationView | null> {
  const conversation = await loadOwnConversation(session, conversationId);
  if (!conversation) return null;

  const rows = await loadOwnTasks(session, conversationId);
  const taskIds = rows.map((row) => row.id);
  const [costs, files] = await Promise.all([
    sumOwnTaskCharges(session, taskIds),
    loadTaskFiles(session, memberId, taskIds),
  ]);
  const charts = await chartPreviews(files);

  const tasks = rows.map((row) => {
    const own = files.filter((file) => file.task_id === row.id);
    const chartFile = own.find((file) => charts.has(file.id));
    return taskView(row, {
      costCents: costs.get(row.id) ?? 0,
      attachments: own.filter((file) => file.kind === "upload").map(toChatFile),
      deliveries: own.filter((file) => file.kind === "delivery").map(toChatFile),
      chart: chartFile ? (charts.get(chartFile.id) ?? null) : null,
      now,
    });
  });
  return { conversation, tasks };
}

/** Uma mensagem guardada, do jeito que a tela mostra. */
export function taskView(
  row: TaskRow,
  extras: { costCents: number; attachments: ChatFile[]; deliveries: ChatFile[]; chart: string | null; now: number },
): ChatTask {
  const stale = row.status === "running" && extras.now - Date.parse(row.created_at) > STALE_TASK_MS;
  const status = stale ? "failed" : row.status;
  return {
    id: row.id,
    prompt: row.prompt,
    answer: stale ? STALE_TASK_ANSWER : row.answer,
    status,
    action: row.action,
    provider: row.chosen_provider,
    tier: row.chosen_tier,
    effort: row.chosen_effort,
    reason: null,
    notice: status === "finished" ? actionNotice(row.action, row.answer) : null,
    costCents: extras.costCents,
    attachmentsCut: false,
    createdAt: row.created_at,
    attachments: extras.attachments,
    deliveries: extras.deliveries,
    chart: extras.chart,
  };
}

function toChatFile(file: FileRow): ChatFile {
  return { id: file.id, name: file.name };
}

/** Os gráficos das mensagens, já prontos para mostrar, por id do arquivo. */
async function chartPreviews(files: readonly FileRow[]): Promise<Map<string, string>> {
  const charts = files.filter(
    (file) => file.kind === "delivery" && file.mime_type === CHART_MIME && (file.size_bytes ?? 0) <= MAX_CHART_BYTES,
  );
  const previews = new Map<string, string>();
  for (const file of charts) {
    try {
      previews.set(file.id, chartDataUrl(await readStoredFile(file.storage_path)));
    } catch (error) {
      // Sem a prévia, o gráfico continua para baixar.
      console.error(`[chat] Não consegui ler o gráfico ${file.id}:`, error);
    }
  }
  return previews;
}

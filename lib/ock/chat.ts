// O chat da tarefa rápida visto pela tela: os limites e o formato do que o servidor manda. Só dados, sem instruções
// das IAs: este arquivo vai também para o navegador. O resto do chat fica em lib/ock/quick-task.ts (o que cada tipo
// de resposta pede à IA) e lib/ock/run-task.ts (quem executa).

import { MAX_REQUEST_CHARS } from "@/lib/engine/validate";
import type { Effort, ModelTier, ProviderId } from "@/lib/providers/types";

/** Tamanho máximo da mensagem, o mesmo do pedido das receitas (regra do AGENTS.md). A tela mostra um contador. */
export const MAX_MESSAGE_CHARS = MAX_REQUEST_CHARS;

/** Quantos arquivos dá para anexar numa mensagem, e o tamanho de cada um. */
export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Quanto do texto dos anexos vai para a IA numa mensagem (umas 15 páginas). O que passar disso é cortado (F44). */
export const MAX_ATTACHMENT_TEXT_CHARS = 30_000;

/** Os tipos de arquivo que a IA lê, pela extensão do nome. Outro tipo é recusado na hora (F44). */
export const TEXT_EXTENSIONS = ["txt", "csv", "md", "json", "tsv"] as const;
export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"] as const;
export const READABLE_EXTENSIONS: readonly string[] = ["pdf", ...TEXT_EXTENSIONS, ...IMAGE_EXTENSIONS];

/** Para o campo de escolher arquivo do navegador: só mostra os tipos que a IA lê. */
export const ATTACHMENT_ACCEPT = READABLE_EXTENSIONS.map((extension) => `.${extension}`).join(",");

/** A extensão do nome do arquivo, em minúsculas ("Relatório.PDF" → "pdf"). Sem ponto, vazio. */
export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

export function isReadableAttachment(name: string): boolean {
  return READABLE_EXTENSIONS.includes(fileExtension(name));
}

/** O pedido guardado quando a pessoa manda só os anexos, sem escrever nada. */
export const ATTACHMENTS_ONLY_PROMPT = "(ver arquivo anexado)";

/** O aviso quando o texto dos anexos passou do limite e só o começo foi para a IA. */
export const ATTACHMENTS_CUT_NOTICE =
  "Os anexos passavam de 30.000 caracteres (umas 15 páginas): a IA leu só o começo de cada um.";

/** Como a tela chama o nível do modelo e o esforço. */
export const TIER_LABEL: Record<ModelTier, string> = { economico: "econômico", padrao: "padrão", potente: "potente" };
export const EFFORT_LABEL: Record<Effort, string> = { low: "baixo", medium: "médio", high: "alto" };

/** O aviso quando o tipo do arquivo não dá para ler. */
export const UNREADABLE_ATTACHMENT =
  "A IA ainda não lê este tipo de arquivo. Anexe um PDF, um texto (.txt, .csv, .md, .json) ou uma imagem.";

/** Um arquivo, do jeito que a tela mostra: o nome e o id para baixar (/api/ock/files/<id>). */
export interface ChatFile {
  id: string;
  name: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  updatedAt: string;
}

/** O que a plataforma fez com o pedido. Imagem, por enquanto, só responde que chega em breve (decisão 2, issue #39). */
export type ChatAction = "responder" | "imagem" | "codigo" | "pesquisa" | "documento" | "grafico" | "projeto";

/** Uma mensagem da pessoa e a resposta, do jeito que a tela mostra. Nunca leva modelo, tokens nem custo em dólar. */
export interface ChatTask {
  id: string;
  prompt: string;
  /** A resposta; numa falha, o aviso do que houve. */
  answer: string | null;
  status: "running" | "finished" | "failed";
  action: ChatAction;
  provider: ProviderId;
  tier: ModelTier;
  effort: Effort;
  /** Por que o Chefe escolheu essa IA. Só na resposta que acabou de chegar (não fica guardado). */
  reason: string | null;
  /** Aviso fixo do tipo de resposta (ex.: a resposta não veio de uma pesquisa na internet). */
  notice: string | null;
  /** Quanto a resposta custou, em centavos (0 quando nada foi cobrado). */
  costCents: number;
  /** Se o texto dos anexos passou do limite e foi cortado. Só na resposta que acabou de chegar. */
  attachmentsCut: boolean;
  createdAt: string;
  /** Arquivos que a pessoa anexou a esta mensagem. */
  attachments: ChatFile[];
  /** Arquivos que a IA fez (PDF, planilha, gráfico, projeto...). */
  deliveries: ChatFile[];
  /** O que mostrar na conversa: o gráfico desenhado (data:image/svg+xml) ou a imagem criada pela IA. */
  chart: string | null;
}

/** O gasto do mês da pessoa e o teto que o dono definiu (vazio = sem teto). */
export interface MonthSpending {
  spentCents: number;
  budgetCents: number | null;
}

export interface ChatDelivery extends ChatFile {
  createdAt: string;
}

/** A resposta do servidor a uma mensagem enviada. */
export interface SendResult {
  conversation: ChatConversation;
  task: ChatTask;
  month: MonthSpending;
}

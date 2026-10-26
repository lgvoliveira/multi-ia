// A tarefa rápida (o chat do workspace), na parte que não depende do banco nem da rede: o que cada tipo de resposta
// pede à IA, o máximo que ela pode custar, o que cobrar e como montar o texto que vai para a IA. SÓ do servidor, porque
// leva as instruções das IAs (o que a tela usa fica em chat.ts). Quem executa é lib/ock/run-task.ts.
//
// O dinheiro segue as regras das receitas (AGENTS.md, seção 5), com uma diferença decidida pelo Luis em 25/10/2026
// (issue #39): no chat não há estimativa antes de cada mensagem. Depois que o Chefe decide, o servidor reserva o máximo
// que a resposta pode custar, cobra o consumo real numa linha só e a tela mostra "Custou R$ X".

import type { AiCallReport } from "@/lib/engine/types";
import { costInUsd, usdToCents, USD_TO_BRL } from "@/lib/ock/pricing";
import { maxInputTokens, outputTokenCap } from "@/lib/providers/limits";
import type { Effort, GenerateRequest, ModelTier, ProviderId } from "@/lib/providers/types";
import { UNKNOWN_MODEL } from "@/lib/runs/billing";
import type { AiCallRow } from "@/lib/runs/store";
import { MAX_ATTACHMENT_TEXT_CHARS, type ChatAction } from "./chat";
import { ROUTER, type Route } from "./chief";
import { pickFormat, type DocFormat } from "./document";
import { CHART_SAMPLE, DOCUMENT_SAMPLE, PROJECT_SAMPLE, SHEET_SAMPLE } from "./quick-task.samples";

/** Quantas trocas recentes da conversa entram como contexto, e o teto de tamanho (para não encarecer a chamada). */
export const HISTORY_TURNS = 6;
export const HISTORY_MAX_CHARS = 4000;

/**
 * O máximo que uma imagem anexada pesa na entrada da IA, em tokens. As IAs reduzem as imagens grandes, mas os modelos
 * novos do Claude aceitam imagens maiores (uns 4.800 tokens numa imagem grande), então a conta usa 5.000.
 */
export const IMAGE_INPUT_TOKENS = 5000;

/** As respostas que não vêm de uma IA. Toda falha diz que nada foi cobrado. */
export const IMAGE_UNAVAILABLE = "Ainda não consigo criar imagens aqui. Isso chega em breve. Nada foi cobrado.";
export const AI_FAILED = "A IA não conseguiu responder agora. Nada foi cobrado. Tente de novo daqui a pouco.";
export const CHART_FAILED =
  "Não consegui montar o gráfico. Diga quais são os rótulos e os valores que você quer ver. Nada foi cobrado.";
export const PROJECT_FAILED =
  "Não consegui montar o projeto em arquivos. Descreva o que ele deve fazer e tente de novo. Nada foi cobrado.";

/** Instrução do trabalhador: um assistente de trabalho geral, em português. */
const WORKER_SYSTEM = `Você é um assistente de trabalho de uma empresa brasileira. Responda em português do Brasil, de forma clara, direta e útil, fazendo exatamente o que o usuário pediu. Não invente dados; quando faltar informação, diga o que falta.`;

// Pesquisa na internet e rodar código chegam com as IAs de verdade (decisão 2 da issue #39). Até lá, a IA responde com
// o que sabe e diz isso: nunca esconde que não pesquisou nem rodou o código (F45).
const SEARCH_OFFLINE_SYSTEM = `${WORKER_SYSTEM} Você não tem acesso à internet nesta conversa: responda com o que já sabe e, se a informação puder ter mudado, diga isso em uma frase.`;
const CODE_OFFLINE_SYSTEM = `${WORKER_SYSTEM} Você não pode rodar código nesta conversa. Resolva a conta ou a lógica passo a passo, mostre o resultado e diga que ele não foi conferido por um programa.`;

/** Instrução para quando a tarefa é montar um GRÁFICO: a IA devolve só o JSON dos dados. */
const CHART_SYSTEM = `Você projeta um gráfico a partir do pedido e dos dados. Responda APENAS com um JSON, sem explicação, nesta forma:
{"tipo":"barra|linha|pizza","titulo":"...","rotulos":["..."],"series":[{"nome":"...","valores":[1,2,3]}]}
Regras: "rotulos" são as categorias do eixo X (ou as fatias da pizza). Cada "serie" tem "nome" e "valores" na MESMA ordem dos rótulos. Para pizza, use UMA única série. Use números puros (sem R$, sem %, sem texto).`;

/** Instrução para montar um PROJETO de código em arquivos (vira .zip). */
const PROJECT_SYSTEM = `Você monta um PROJETO de código em arquivos. Responda APENAS com um JSON válido e COMPLETO, sem nenhum texto fora dele, nesta forma:
{"arquivos":[{"caminho":"index.html","conteudo":"<o arquivo inteiro>"}]}
Cada item tem "caminho" (relativo, ex.: src/app.js) e "conteudo" (o conteúdo completo do arquivo). Entregue um projeto funcional, porém ENXUTO: poucos arquivos, para o JSON caber inteiro na resposta sem cortar. Feche sempre o JSON.`;

/** Instrução para a IA quando a tarefa é GERAR UM ARQUIVO: ela devolve só o conteúdo, a OCK faz o arquivo. */
function documentSystem(format: DocFormat): string {
  if (format === "csv" || format === "xlsx") {
    return `Você produz o CONTEÚDO de uma planilha em CSV. Responda APENAS com o CSV: uma linha de cabeçalho e as linhas de dados, colunas separadas por vírgula. Sem explicações, sem crases, sem markdown.`;
  }
  return `Você produz o CONTEÚDO de um documento que será salvo em arquivo. Responda APENAS com o texto final do documento, bem organizado (título, seções, listas em texto simples, uma informação por linha). Nada de crases, blocos de código ou comentários seus — só o conteúdo pronto do documento.`;
}

/** Como a IA trabalha em cada tipo de resposta. */
export interface WorkPlan {
  /**
   * answer: a resposta é o texto; document, chart e project: a OCK transforma o texto num arquivo;
   * unavailable: nenhuma IA trabalha (por enquanto, só a imagem).
   */
  kind: "answer" | "document" | "chart" | "project" | "unavailable";
  action: ChatAction;
  provider: ProviderId;
  tier: ModelTier;
  effort: Effort;
  /** Limite da resposta, em tokens. Controla o custo. */
  maxOutputTokens: number;
  systemPrompt: string;
  /** Só no documento: o formato do arquivo. */
  format?: DocFormat;
  /** Resposta de exemplo, que só a IA simulada usa. */
  sampleResponse?: string;
}

/** O que a IA escolhida pelo Chefe faz em cada ação. */
export function planWork(route: Route, message: string): WorkPlan {
  const base = { action: route.action, provider: route.provider, tier: route.tier, effort: route.effort };
  switch (route.action) {
    case "imagem":
      return { ...base, kind: "unavailable", maxOutputTokens: 0, systemPrompt: "" };
    case "pesquisa":
      return { ...base, kind: "answer", maxOutputTokens: 1500, systemPrompt: SEARCH_OFFLINE_SYSTEM };
    case "codigo":
      return { ...base, kind: "answer", maxOutputTokens: 3000, systemPrompt: CODE_OFFLINE_SYSTEM };
    case "documento": {
      const format = pickFormat(message);
      const sheet = format === "csv" || format === "xlsx";
      return {
        ...base,
        kind: "document",
        maxOutputTokens: 6000,
        systemPrompt: documentSystem(format),
        format,
        sampleResponse: sheet ? SHEET_SAMPLE : DOCUMENT_SAMPLE,
      };
    }
    case "grafico":
      return { ...base, kind: "chart", maxOutputTokens: 2000, systemPrompt: CHART_SYSTEM, sampleResponse: CHART_SAMPLE };
    case "projeto":
      // Esforço médio e teto alto, para o JSON do projeto caber inteiro (não cortar no meio).
      return {
        ...base,
        effort: "medium",
        kind: "project",
        maxOutputTokens: 12000,
        systemPrompt: PROJECT_SYSTEM,
        sampleResponse: PROJECT_SAMPLE,
      };
    case "responder":
      return {
        ...base,
        kind: "answer",
        maxOutputTokens: route.mode === "projeto" ? 6000 : 1500,
        systemPrompt: WORKER_SYSTEM,
      };
  }
}

/** O pedido para a IA que vai responder. */
export function workRequest(
  plan: WorkPlan,
  input: string,
  images: readonly { mime: string; base64: string }[] = [],
): GenerateRequest {
  return {
    systemPrompt: plan.systemPrompt,
    input,
    maxOutputTokens: plan.maxOutputTokens,
    effort: plan.effort,
    tier: plan.tier,
    images: [...images],
    sampleResponse: plan.sampleResponse,
  };
}

const ACTION_LABEL: Record<ChatAction, string> = {
  responder: "Resposta",
  imagem: "Imagem",
  codigo: "Código",
  pesquisa: "Pesquisa",
  documento: "Documento",
  grafico: "Gráfico",
  projeto: "Projeto",
};

/** A descrição da linha de gasto no extrato: o tipo de resposta, nunca o pedido ("Tarefa rápida · Documento"). */
export function chargeDescription(action: ChatAction): string {
  return `Tarefa rápida · ${ACTION_LABEL[action]}`;
}

/** O aviso fixo de cada tipo de resposta, mostrado junto dela (F45). */
export function actionNotice(action: ChatAction): string | null {
  if (action === "pesquisa") {
    return "A pesquisa na internet ainda não está ligada: esta resposta vem do que a IA já sabe e pode estar desatualizada.";
  }
  if (action === "codigo") {
    return "Ainda não dá para rodar código aqui: a IA fez a conta sem executar um programa. Confira os números antes de usar.";
  }
  return null;
}

/** O máximo que a entrada de um pedido pode pesar, em tokens: o texto (com a folga do português) e as imagens. */
export function requestInputTokens(request: GenerateRequest): number {
  return maxInputTokens(request.systemPrompt + request.input) + (request.images?.length ?? 0) * IMAGE_INPUT_TOKENS;
}

/**
 * O máximo, em dólar, que um pedido a uma IA pode custar: a entrada, que já se conhece, e o maior texto que ela pode
 * escrever, contando o "pensamento" (o mesmo teto que os conectores reais mandam, lib/providers/limits.ts).
 */
function maxRequestUsd(provider: ProviderId, request: GenerateRequest): number {
  const outputTokens = outputTokenCap(provider, request.maxOutputTokens, request.effort ?? "medium");
  return costInUsd(provider, request.tier ?? "padrao", { inputTokens: requestInputTokens(request), outputTokens });
}

/** O máximo que o Chefe pode gastar para decidir, em centavos: a primeira reserva, antes de qualquer IA. */
export function chiefMaxCents(request: GenerateRequest): number {
  return usdToCents(maxRequestUsd(ROUTER.provider, request));
}

/**
 * A reserva para a resposta, em centavos: o que o Chefe já gastou (`chiefUsd`) e o máximo da IA que vai responder.
 * Como o consumo real nunca passa do máximo, a cobrança (taskChargeCents) nunca passa desta reserva.
 */
export function answerHoldCents(chiefUsd: number, plan: WorkPlan, request: GenerateRequest): number {
  return usdToCents(chiefUsd + maxRequestUsd(plan.provider, request));
}

/** O custo real de uma chamada, em dólar. */
export function callUsd(call: Pick<AiCallReport, "provider" | "tier" | "usage">): number {
  return costInUsd(call.provider, call.tier, call.usage);
}

/**
 * Quanto cobrar por uma resposta pronta, em centavos: o consumo real das chamadas que deram certo (o Chefe e a IA que
 * respondeu), somado em dólar e convertido uma vez só, com no mínimo 1 centavo.
 */
export function taskChargeCents(calls: readonly AiCallReport[]): number {
  const usd = calls.filter((call) => call.ok).reduce((total, call) => total + callUsd(call), 0);
  return Math.max(1, usdToCents(usd));
}

/** As linhas da tabela interna ai_calls de uma tarefa. `charged`: a resposta foi cobrada (só as chamadas que deram certo). */
export function taskAiCallRows(
  ids: { companyId: string; memberId: string; taskId: string },
  calls: readonly AiCallReport[],
  charged: boolean,
): AiCallRow[] {
  return calls.map((call) => ({
    company_id: ids.companyId,
    member_id: ids.memberId,
    run_id: null,
    task_id: ids.taskId,
    step_id: call.stepId,
    attempt: call.attempt,
    provider: call.provider,
    model: call.model ?? UNKNOWN_MODEL,
    tier: call.tier,
    input_tokens: call.usage.inputTokens,
    output_tokens: call.usage.outputTokens,
    // A coluna guarda 6 casas depois da vírgula.
    cost_usd: Number(callUsd(call).toFixed(6)),
    usd_brl: USD_TO_BRL,
    charged: charged && call.ok,
    status: call.ok ? "ok" : "error",
    error_message: call.errorMessage?.slice(0, 2000) ?? null,
    duration_ms: Math.max(0, Math.round(call.durationMs)),
  }));
}

/** Uma troca anterior da conversa. */
export interface PastTurn {
  prompt: string;
  answer: string | null;
}

/** As últimas trocas da conversa, em ordem, para a IA "lembrar" do que já foi dito nela. */
export function historyText(turns: readonly PastTurn[]): string {
  const lines: string[] = [];
  for (const turn of turns.slice(-HISTORY_TURNS)) {
    lines.push(`Funcionário: ${turn.prompt}`);
    if (turn.answer) lines.push(`Você: ${turn.answer}`);
  }
  const text = lines.join("\n");
  return text.length > HISTORY_MAX_CHARS ? text.slice(text.length - HISTORY_MAX_CHARS) : text;
}

/** O texto de um anexo, já lido. */
export interface AttachmentText {
  name: string;
  text: string;
}

/**
 * O texto dos anexos que vai para a IA, até MAX_ATTACHMENT_TEXT_CHARS no total (F44). `cut` diz se algo ficou de fora,
 * para a tela avisar.
 */
export function attachmentContext(files: readonly AttachmentText[]): { text: string; cut: boolean } {
  let remaining = MAX_ATTACHMENT_TEXT_CHARS;
  let cut = false;
  const parts: string[] = [];
  for (const file of files) {
    const piece = file.text.slice(0, Math.max(0, remaining));
    remaining -= piece.length;
    let part = `--- Arquivo anexado: ${file.name} ---\n${piece}`;
    if (piece.length < file.text.length) {
      cut = true;
      part += "\n[O resto deste arquivo ficou de fora: passou do limite de texto dos anexos.]";
    }
    parts.push(part);
  }
  return { text: parts.join("\n\n"), cut };
}

/** Junta a conversa, os anexos e a nova mensagem no texto que vai para a IA que responde. */
export function buildWorkerInput(history: string, attachments: string, message: string): string {
  const parts: string[] = [];
  if (history) parts.push(`Conversa até agora (contexto; continue de onde parou):\n${history}`);
  if (attachments) parts.push(attachments);
  parts.push(`Nova mensagem do funcionário: ${message}`);
  return parts.join("\n\n");
}

const TITLE_MAX_CHARS = 80;

/** O título de uma conversa nova: o começo da primeira mensagem ou, sem texto, o nome do anexo. */
export function conversationTitle(message: string, attachmentNames: readonly string[]): string {
  const text = message.replace(/\s+/g, " ").trim();
  const title = text || (attachmentNames.length > 0 ? `Arquivo: ${attachmentNames.join(", ")}` : "Nova conversa");
  return title.length > TITLE_MAX_CHARS ? `${title.slice(0, TITLE_MAX_CHARS - 1).trimEnd()}…` : title;
}

const DOCUMENT_TITLE_MAX_CHARS = 60;

/**
 * O título (e o nome do arquivo) de um documento gerado: a primeira linha do que a IA escreveu, sem marcas como "#".
 * Nunca o pedido: o dono vê as entregas, mas não lê os pedidos (F05, F49). A planilha começa pelos nomes das colunas,
 * então ela se chama só "Planilha".
 */
export function documentTitle(content: string, format: DocFormat): string {
  if (format === "csv" || format === "xlsx") return "Planilha";
  const firstLine = content.split("\n").find((line) => line.trim() !== "") ?? "";
  const title = firstLine
    .replace(/^[\s#*_>-]+/, "")
    .replace(/[\s*_:]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return title.slice(0, DOCUMENT_TITLE_MAX_CHARS).trimEnd() || "Documento";
}

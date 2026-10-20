// POST /api/ock: o funcionário manda uma tarefa; o Chefe DECIDE a melhor IA e o esforço, a IA faz,
// e a OCK MEDE o custo e soma ao gasto do funcionário. Sem pagamento por enquanto: não bloqueia, só mede.
// Sem chave conectada, roda na IA simulada (dá para experimentar o fluxo sem gastar).

import { serverKeys } from "@/lib/keys/server-keys";
import { createGetProvider } from "@/lib/providers/registry";
import { ProviderError, type ProviderId } from "@/lib/providers/types";
import { decideRoute, runProvider } from "@/lib/ock/chief";
import { parseChartSpec, renderChart } from "@/lib/ock/chart";
import { runCodeWithGemini } from "@/lib/ock/code";
import { budgetBlock, conversationTasks, createConversation, getMember, loadCompany, recordTask } from "@/lib/ock/company";
import { generateDocument, pickFormat, type DocFormat } from "@/lib/ock/document";
import { downloadUrl, readFileImage, readFileText, uploadFile } from "@/lib/ock/files";
import { generateImage } from "@/lib/ock/image";
import { costInCents, tokensForCents } from "@/lib/ock/pricing";
import { generateZip, parseProjectFiles } from "@/lib/ock/project";
import { searchWithGemini } from "@/lib/ock/search";

/** Custo fixo estimado de gerar uma imagem (em centavos de R$). */
const IMAGE_COST_CENTS = 25;

// Uma tarefa de "projeto" pode levar minutos: pede o teto de tempo de função.
export const maxDuration = 300;

const MAX_MESSAGE = 8000;

/** Instrução do trabalhador: um assistente de trabalho geral, em português. */
const WORKER_SYSTEM = `Você é um assistente de trabalho de uma empresa brasileira. Responda em português do Brasil, de forma clara, direta e útil, fazendo exatamente o que o usuário pediu. Não invente dados; quando faltar informação, diga o que falta.`;

/** Fallback de código: a IA faz a conta/lógica ela mesma e entrega o resultado, sem reclamar de execução. */
const CODE_FALLBACK_SYSTEM = `Você resolve tarefas de cálculo e lógica. Faça a conta VOCÊ MESMO e entregue o RESULTADO final direto, com um passo a passo curto. NUNCA diga que não tem ambiente de execução — apenas dê o resultado.`;

/** Fallback de busca: responde com o conhecimento próprio, sem dizer que não tem internet. */
const SEARCH_FALLBACK_SYSTEM = `Responda da melhor forma com o seu conhecimento. NUNCA diga que não tem acesso à internet nem que não pode pesquisar — apenas responda. Se os dados podem estar desatualizados, avise em uma frase curta no fim.`;

/** IA barata e rápida que o Chefe usa só para DECIDIR a rota (não para fazer a tarefa). */
const ROUTER: ProviderId = "gpt";

/** Instrução para quando a tarefa é montar um GRÁFICO: a IA devolve só o JSON dos dados. */
const CHART_SYSTEM = `Você projeta um gráfico a partir do pedido e dos dados. Responda APENAS com um JSON, sem explicação, nesta forma:
{"tipo":"barra|linha|pizza","titulo":"...","rotulos":["..."],"series":[{"nome":"...","valores":[1,2,3]}]}
Regras: "rotulos" são as categorias do eixo X (ou as fatias da pizza). Cada "serie" tem "nome" e "valores" na MESMA ordem dos rótulos. Para pizza, use UMA única série. Use números puros (sem R$, sem %, sem texto).`;

/** Instrução para montar um PROJETO de código em arquivos (vira .zip). */
const PROJECT_SYSTEM = `Você monta um PROJETO de código em arquivos. Responda APENAS com um JSON válido e COMPLETO, sem nenhum texto fora dele, nesta forma:
{"arquivos":[{"caminho":"index.html","conteudo":"<o arquivo inteiro>"}]}
Cada item tem "caminho" (relativo, ex.: src/app.js) e "conteudo" (o conteúdo completo do arquivo). Entregue um projeto funcional, porém ENXUTO: poucos arquivos, para o JSON caber inteiro na resposta sem cortar. Feche sempre o JSON.`;

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problem("Não entendemos o pedido.", 400);
  }
  const data = (body ?? {}) as Record<string, unknown>;
  const message = typeof data.message === "string" ? data.message.trim() : "";
  if (!message) return problem("Escreva o que você quer que o time faça.", 400);
  if (message.length > MAX_MESSAGE) return problem("O pedido é grande demais.", 413);

  const memberId = typeof data.memberId === "string" ? data.memberId : "";
  if (!memberId) return problem("Não sabemos qual funcionário está pedindo.", 400);
  const fileIds = Array.isArray(data.fileIds)
    ? data.fileIds.filter((id): id is string => typeof id === "string").slice(0, 5)
    : [];
  // Chaves-mãe da plataforma (servidor). A empresa não conecta nada; a OCK mede e trava por empresa.
  const keys = serverKeys();

  let member;
  let company;
  try {
    member = await getMember(memberId);
    if (!member) return problem("Funcionário não encontrado.", 404);
    company = await loadCompany("demo");
    if (!company) return problem("Empresa não encontrada.", 404);
  } catch (error) {
    console.error("[api/ock] Falha ao ler a empresa:", error);
    return problem("Algo deu errado do nosso lado.", 500);
  }

  // Trava de orçamento: se o funcionário estourou o teto dele, ou se o crédito da empresa acabou,
  // não aciona nenhuma IA (custo zero). É só comparar números já em memória + uma soma leve.
  try {
    const blocked = await budgetBlock(company, member);
    if (blocked) return problem(blocked, 402);
  } catch (error) {
    console.error("[api/ock] Falha ao conferir o limite:", error);
    return problem("Algo deu errado do nosso lado.", 500);
  }

  const getProvider = createGetProvider(keys);

  // Qual chat: usa o informado ou cria um novo (titulado pela 1ª mensagem). Nunca apaga mensagens.
  let conversationId = typeof data.conversationId === "string" && data.conversationId ? data.conversationId : "";
  try {
    if (!conversationId) conversationId = await createConversation(company.id, memberId, message);
  } catch (error) {
    console.error("[api/ock] Falha ao abrir o chat:", error);
    return problem("Não deu para abrir o chat agora.", 500);
  }

  try {
    // 0. Lê os arquivos anexados: texto/PDF vira contexto; imagem vai para a IA "enxergar" (visão).
    let fileContext = "";
    const images: { mime: string; base64: string }[] = [];
    for (const fileId of fileIds) {
      const file = await readFileText(fileId, memberId);
      if (file) {
        fileContext += `--- Arquivo anexado: ${file.name} ---\n${file.text}\n\n`;
        continue;
      }
      const image = await readFileImage(fileId, memberId);
      if (image) images.push(image);
    }

    // 1. Memória: as últimas trocas DESTE chat viram contexto (cada chat tem a sua memória).
    const history = await recentConversation(conversationId);

    // 2. O Chefe decide a AÇÃO e a rota com uma IA barata, já ciente do contexto da conversa.
    const decision = await decideRoute(message, getProvider(ROUTER), history);
    const routingCents = costInCents(ROUTER, "economico", decision.inputTokens, decision.outputTokens);
    const route = decision.route;
    const workerInput = buildWorkerInput(history, fileContext, message);

    let answer = "";
    let imageDataUrl: string | undefined;
    let fileDownload: { name: string; url: string } | undefined;
    let inputTokens = 0;
    let outputTokens = 0;
    let workCents = 0;

    if (route.action === "imagem" && keys.gpt) {
      // Gera a imagem com o GPT e guarda na pasta do funcionário.
      const img = await generateImage(keys.gpt, message);
      imageDataUrl = `data:${img.mime};base64,${img.base64}`;
      answer = `Imagem gerada para: ${message}`;
      outputTokens = tokensForCents(IMAGE_COST_CENTS);
      workCents = IMAGE_COST_CENTS;
      try {
        await uploadFile(
          company,
          member,
          { name: `imagem-${Date.now()}.png`, mime: img.mime, bytes: new Uint8Array(Buffer.from(img.base64, "base64")) },
          "delivery",
        );
      } catch {
        // Se não salvar na pasta, tudo bem: a imagem já volta no chat.
      }
    } else if (route.action === "codigo") {
      // Roda no sandbox SEGURO do Gemini. Se indisponível (sem chave/cota), a IA forte resolve em texto.
      try {
        if (!keys.gemini) throw new Error("gemini indisponível");
        const res = await runCodeWithGemini(keys.gemini, workerInput);
        answer = res.text;
        inputTokens = res.inputTokens;
        outputTokens = res.outputTokens;
        workCents = costInCents("gemini", route.tier, inputTokens, outputTokens);
      } catch {
        const work = await runProvider(getProvider("claude"), CODE_FALLBACK_SYSTEM, workerInput, 3000, "high", "padrao", images);
        answer = work.text;
        inputTokens = work.inputTokens;
        outputTokens = work.outputTokens;
        workCents = costInCents("claude", "padrao", inputTokens, outputTokens);
      }
    } else if (route.action === "pesquisa") {
      // Gemini pesquisa na web (Google) com fontes. Se indisponível, responde com o que a IA forte já sabe.
      try {
        if (!keys.gemini) throw new Error("gemini indisponível");
        const res = await searchWithGemini(keys.gemini, workerInput);
        answer = res.text;
        inputTokens = res.inputTokens;
        outputTokens = res.outputTokens;
        workCents = costInCents("gemini", route.tier, inputTokens, outputTokens);
      } catch {
        const work = await runProvider(getProvider("claude"), SEARCH_FALLBACK_SYSTEM, workerInput, 1500, "medium", "padrao", images);
        answer = work.text;
        inputTokens = work.inputTokens;
        outputTokens = work.outputTokens;
        workCents = costInCents("claude", "padrao", inputTokens, outputTokens);
      }
    } else if (route.action === "documento") {
      // A IA forte monta o CONTEÚDO; a OCK renderiza o ARQUIVO (PDF/CSV/TXT) e devolve para baixar.
      const format = pickFormat(message);
      const work = await runProvider(
        getProvider(route.provider),
        docSystem(format),
        workerInput,
        6000,
        route.effort,
        route.tier,
        images,
      );
      inputTokens = work.inputTokens;
      outputTokens = work.outputTokens;
      workCents = costInCents(route.provider, route.tier, inputTokens, outputTokens);
      const doc = await generateDocument(docTitle(message), work.text, format);
      const stored = await uploadFile(company, member, { name: doc.name, mime: doc.mime, bytes: doc.bytes }, "delivery");
      const url = await downloadUrl(stored.id, member.id);
      fileDownload = url ? { name: doc.name, url } : undefined;
      answer = url
        ? `Pronto! Gerei o arquivo **${doc.name}**. É só baixar aqui embaixo.`
        : "Gerei o arquivo, mas não consegui criar o link de download. Tente de novo.";
    } else if (route.action === "grafico") {
      // A IA modela os dados (JSON); a OCK desenha o gráfico em SVG (seguro, sem rodar código).
      const work = await runProvider(getProvider(route.provider), CHART_SYSTEM, workerInput, 2000, route.effort, route.tier, images);
      inputTokens = work.inputTokens;
      outputTokens = work.outputTokens;
      workCents = costInCents(route.provider, route.tier, inputTokens, outputTokens);
      const spec = parseChartSpec(work.text);
      if (spec) {
        const svg = renderChart(spec);
        imageDataUrl = `data:image/svg+xml;base64,${Buffer.from(svg, "utf-8").toString("base64")}`;
        answer = `Gráfico pronto: ${spec.title}`;
        try {
          const stored = await uploadFile(
            company,
            member,
            { name: "grafico.svg", mime: "image/svg+xml", bytes: new TextEncoder().encode(svg) },
            "delivery",
          );
          const url = await downloadUrl(stored.id, member.id);
          fileDownload = url ? { name: "grafico.svg", url } : undefined;
        } catch {
          // Se não salvar para baixar, tudo bem: o gráfico já aparece no chat.
        }
      } else {
        answer = "Não consegui montar o gráfico. Me diga os rótulos e os valores que você quer ver.";
      }
    } else if (route.action === "projeto") {
      // A IA escreve os arquivos de código (JSON); a OCK compacta num .zip para baixar.
      // Esforço "medium" e teto alto para o JSON do projeto caber inteiro (não truncar).
      const work = await runProvider(getProvider(route.provider), PROJECT_SYSTEM, workerInput, 12000, "medium", route.tier, images);
      inputTokens = work.inputTokens;
      outputTokens = work.outputTokens;
      workCents = costInCents(route.provider, route.tier, inputTokens, outputTokens);
      const files = parseProjectFiles(work.text);
      if (files.length > 0) {
        const zip = await generateZip(files);
        const stored = await uploadFile(company, member, { name: "projeto.zip", mime: "application/zip", bytes: zip }, "delivery");
        const url = await downloadUrl(stored.id, member.id);
        fileDownload = url ? { name: "projeto.zip", url } : undefined;
        answer = url
          ? `Projeto pronto com ${files.length} arquivo(s): ${files.map((f) => f.path).slice(0, 8).join(", ")}. Baixe o .zip aqui embaixo.`
          : "Gerei os arquivos, mas não consegui criar o link de download.";
      } else {
        answer = work.text || "Não consegui montar o projeto. Descreva o que ele deve fazer.";
      }
    } else {
      // Texto. (Se foi pedido imagem/código mas falta a chave daquela IA, responde em texto.)
      const maxOut = route.mode === "projeto" ? 6000 : 1500;
      const work = await runProvider(
        getProvider(route.provider),
        WORKER_SYSTEM,
        workerInput,
        maxOut,
        route.effort,
        route.tier,
        images,
      );
      answer = work.text;
      inputTokens = work.inputTokens;
      outputTokens = work.outputTokens;
      workCents = costInCents(route.provider, route.tier, inputTokens, outputTokens);
    }

    // 3. Mede o custo total e soma ao gasto do funcionário.
    const costCents = routingCents + workCents;
    const spentCents = await recordTask(company, member, {
      prompt: message,
      answer,
      provider: route.provider,
      effort: route.effort,
      mode: route.mode,
      inputTokens,
      outputTokens,
      costCents,
      conversationId,
    });
    void spentCents;

    return Response.json({
      route,
      answer,
      image: imageDataUrl,
      file: fileDownload,
      conversationId,
      tokens: inputTokens + outputTokens,
      budgetCents: member.budgetCents,
    });
  } catch (error) {
    console.error("[api/ock] Falha ao rodar a tarefa:", error);
    // Mostra o motivo real (ex.: "A busca respondeu com erro (400).") para o funcionário saber o que houve.
    const detail = error instanceof ProviderError ? error.message : "Uma IA não conseguiu responder agora. Tente de novo.";
    return problem(detail, 502);
  }
}

/** Quantas trocas recentes entram na memória, e o teto de tamanho (para não encarecer a chamada). */
const CONV_TURNS = 6;
const CONV_MAX_CHARS = 4000;

/** Monta o histórico DESTE chat, em ordem, para a IA "lembrar" do que já foi dito nele. */
async function recentConversation(conversationId: string): Promise<string> {
  if (!conversationId) return "";
  const all = await conversationTasks(conversationId, 300); // antigas → novas
  const recent = all.slice(-CONV_TURNS);
  if (recent.length === 0) return "";
  const lines: string[] = [];
  for (const t of recent) {
    lines.push(`Funcionário: ${t.prompt}`);
    if (t.answer) lines.push(`Você: ${t.answer}`);
  }
  const text = lines.join("\n");
  return text.length > CONV_MAX_CHARS ? text.slice(text.length - CONV_MAX_CHARS) : text;
}

/** Junta memória + arquivos + a nova mensagem no texto que vai para a IA que faz a tarefa. */
function buildWorkerInput(history: string, fileContext: string, message: string): string {
  const parts: string[] = [];
  if (history) parts.push(`Conversa até agora (contexto; continue de onde parou):\n${history}`);
  if (fileContext) parts.push(fileContext.trim());
  parts.push(`Nova mensagem do funcionário: ${message}`);
  return parts.join("\n\n");
}

/** Instrução para a IA quando a tarefa é GERAR UM ARQUIVO: ela devolve só o conteúdo, a OCK vira o arquivo. */
function docSystem(format: DocFormat): string {
  if (format === "csv" || format === "xlsx") {
    return `Você produz o CONTEÚDO de uma planilha em CSV. Responda APENAS com o CSV: uma linha de cabeçalho e as linhas de dados, colunas separadas por vírgula. Sem explicações, sem crases, sem markdown.`;
  }
  return `Você produz o CONTEÚDO de um documento que será salvo em PDF. Responda APENAS com o texto final do documento, bem organizado (título, seções, listas em texto simples, uma informação por linha). Nada de crases, blocos de código ou comentários seus — só o conteúdo pronto do documento.`;
}

/** Um título curto para o arquivo, a partir do pedido. */
function docTitle(message: string): string {
  const t = message.replace(/\s+/g, " ").trim();
  return t.length > 60 ? t.slice(0, 60) : t || "Documento";
}

function problem(message: string, status: number): Response {
  return Response.json({ problem: message }, { status });
}

import { describe, expect, it } from "vitest";
import type { AiCallReport } from "@/lib/engine/types";
import { costInUsd, usdToCents } from "@/lib/ock/pricing";
import { outputTokenCap } from "@/lib/providers/limits";
import type { ProviderId } from "@/lib/providers/types";
import { MAX_ATTACHMENT_TEXT_CHARS } from "./chat";
import { heuristicRoute, routerRequest, type Route, type RouteAction } from "./chief";
import {
  actionNotice,
  answerHoldCents,
  attachmentContext,
  buildWorkerInput,
  callUsd,
  chargeDescription,
  chiefMaxCents,
  CODE_RAN_NOTE,
  conversationTitle,
  documentTitle,
  HISTORY_MAX_CHARS,
  historyText,
  IMAGE_INPUT_TOKENS,
  planWork,
  requestInputTokens,
  SOURCES_HEADING,
  taskAiCallRows,
  taskChargeCents,
  toolNotes,
  workRequest,
} from "./quick-task";

function route(action: RouteAction, overrides: Partial<Route> = {}): Route {
  return { provider: "claude", tier: "padrao", effort: "high", mode: "rapido", action, reason: "", ...overrides };
}

function call(overrides: Partial<AiCallReport> = {}): AiCallReport {
  return {
    stepId: "answer",
    provider: "claude",
    model: "mock-claude",
    tier: "padrao",
    usage: { inputTokens: 1000, outputTokens: 500 },
    ok: true,
    attempt: 1,
    durationMs: 10,
    ...overrides,
  };
}

describe("o que cada tipo de resposta pede à IA", () => {
  it("respeita a IA, o nível e o esforço escolhidos pelo Chefe", () => {
    const plan = planWork(route("responder", { provider: "gpt", tier: "economico", effort: "low" }), "Oi");
    expect(plan).toMatchObject({ kind: "answer", provider: "gpt", tier: "economico", effort: "low", maxOutputTokens: 1500 });
    // Pedido grande ("modo projeto") ganha uma resposta maior.
    expect(planWork(route("responder", { mode: "projeto" }), "Oi").maxOutputTokens).toBe(6000);
  });

  it("documento: o formato vem do pedido, e a IA simulada devolve um exemplo do mesmo tipo", () => {
    const pdf = planWork(route("documento"), "Gere um PDF com o resumo");
    expect(pdf).toMatchObject({ kind: "document", format: "pdf" });
    const sheet = planWork(route("documento"), "Monte uma planilha Excel das vendas");
    expect(sheet).toMatchObject({ kind: "document", format: "xlsx" });
    expect(sheet.sampleResponse?.split("\n")[0]).toContain(",");
  });

  it("gráfico e projeto trazem a resposta de exemplo no formato combinado (JSON)", () => {
    expect(() => JSON.parse(planWork(route("grafico"), "x").sampleResponse ?? "")).not.toThrow();
    const project = planWork(route("projeto", { effort: "high" }), "x");
    expect(project).toMatchObject({ kind: "project", effort: "medium", maxOutputTokens: 12000 });
    expect(JSON.parse(project.sampleResponse ?? "").arquivos.length).toBeGreaterThan(0);
  });

  it("imagem com a ferramenta desligada: nenhuma IA trabalha", () => {
    expect(planWork(route("imagem"), "Crie um logo").kind).toBe("unavailable");
  });

  it("imagem com a ferramenta ligada: o GPT cria, e a reserva é o máximo de uma imagem (uns R$ 0,40)", () => {
    const plan = planWork(route("imagem", { provider: "claude" }), "Crie um logo", new Set(["imagem"] as const));
    expect(plan).toMatchObject({ kind: "image", provider: "gpt", tier: "padrao" });
    expect(plan.reason).toContain("GPT cria a imagem");
    const hold = answerHoldCents(0, plan, workRequest(plan, "Crie um logo"));
    expect(hold).toBeGreaterThanOrEqual(30);
    expect(hold).toBeLessThanOrEqual(45);
  });

  it("o custo de uma chamada que já vem calculado (a imagem) não é refeito pelo preço por token", () => {
    expect(callUsd(call({ provider: "gpt", tier: "padrao", usage: { inputTokens: 30, outputTokens: 1770 }, costUsd: 0.053 }))).toBe(0.053);
  });

  it("pesquisa e código respondem em texto e não escondem que não pesquisaram nem rodaram o código (F45)", () => {
    const search = planWork(route("pesquisa"), "Qual a cotação do dólar hoje?");
    expect(search.kind).toBe("answer");
    expect(search.systemPrompt).toContain("não tem acesso à internet");
    expect(search.systemPrompt).not.toMatch(/NUNCA diga/i);
    expect(actionNotice("pesquisa", "O dólar está em alta.")).toContain("não veio de uma pesquisa na internet");

    const code = planWork(route("codigo"), "Rode este cálculo");
    expect(code.systemPrompt).toContain("não pode rodar código");
    expect(actionNotice("codigo", "Dá 1.268,25.")).toContain("sem rodar um programa");
    expect(actionNotice("responder", "Oi")).toBeNull();
    // Com as ferramentas desligadas, nenhuma vai para a IA.
    expect(search.tools).toBeUndefined();
    expect(workRequest(search, "x").tools).toBeUndefined();
  });

  it("com a pesquisa ligada, quem pesquisa é o Claude padrão, e o motivo explica a troca", () => {
    const search = planWork(route("pesquisa", { provider: "gemini", tier: "economico" }), "Cotação do dólar hoje", new Set(["pesquisa"] as const));
    expect(search).toMatchObject({ provider: "claude", tier: "padrao", effort: "low", tools: ["web_search"], kind: "answer" });
    expect(search.systemPrompt).toContain("Pesquise na internet");
    expect(search.reason).toContain("Claude pesquisa");
    expect(workRequest(search, "x").tools).toEqual(["web_search"]);
    // Ligar só a pesquisa não muda o código.
    expect(planWork(route("codigo"), "Calcule", new Set(["pesquisa"] as const)).tools).toBeUndefined();
  });

  it("com o código ligado, quem roda o programa é o Gemini padrão", () => {
    const code = planWork(route("codigo", { provider: "claude" }), "Calcule os juros", new Set(["codigo"] as const));
    expect(code).toMatchObject({ provider: "gemini", tier: "padrao", tools: ["code_execution"] });
    expect(code.systemPrompt).toContain("rode um programa");
  });

  it("as fontes e o programa rodado vão escritos no fim da resposta, e aí não há aviso", () => {
    const notes = toolNotes({
      sources: [
        { title: "Banco Central", url: "https://www.bcb.gov.br/a" },
        { title: "Jornal", url: "https://example.com/b" },
      ],
      codeRuns: 0,
    });
    expect(notes).toBe(`\n\n${SOURCES_HEADING}\n- Banco Central: https://www.bcb.gov.br/a\n- Jornal: https://example.com/b`);
    expect(actionNotice("pesquisa", "O dólar subiu." + notes)).toBeNull();

    const ran = toolNotes({ sources: [], codeRuns: 2 });
    expect(ran).toBe(`\n\n${CODE_RAN_NOTE}`);
    expect(actionNotice("codigo", "Dá 1.268,25." + ran)).toBeNull();
    expect(toolNotes({ sources: [], codeRuns: 0 })).toBe("");
  });

  it("no máximo 8 fontes aparecem no fim", () => {
    const sources = Array.from({ length: 12 }, (_, index) => ({ title: `Página ${index}`, url: `https://example.com/${index}` }));
    expect(toolNotes({ sources, codeRuns: 0 }).match(/^- /gm)).toHaveLength(8);
  });

  it("a reserva da pesquisa cobre as 3 pesquisas e o que elas trazem para a entrada", () => {
    const offline = planWork(route("pesquisa", { provider: "claude", tier: "padrao" }), "Notícias de hoje");
    const online = planWork(route("pesquisa"), "Notícias de hoje", new Set(["pesquisa"] as const));
    const input = buildWorkerInput("", "", "Notícias de hoje");
    const maxCall = call({
      provider: "claude",
      tier: "padrao",
      usage: {
        inputTokens: requestInputTokens(workRequest(online, input)) + 3 * 40_000,
        outputTokens: outputTokenCap("claude", online.maxOutputTokens, online.effort),
        webSearchRequests: 3,
      },
    });
    const hold = answerHoldCents(0, online, workRequest(online, input));
    expect(hold).toBeGreaterThan(answerHoldCents(0, offline, workRequest(offline, input)));
    expect(taskChargeCents([maxCall])).toBeLessThanOrEqual(hold);
    // Uns R$ 1,80 no máximo (o consumo comum fica bem abaixo).
    expect(hold).toBeLessThanOrEqual(200);
  });

  it("a linha do extrato diz o tipo de resposta, nunca o pedido", () => {
    expect(chargeDescription("documento")).toBe("Tarefa rápida · Documento");
    expect(chargeDescription("responder")).toBe("Tarefa rápida · Resposta");
  });
});

describe("o dinheiro de uma mensagem", () => {
  it("a primeira reserva é o máximo que o Chefe (GPT econômico) pode gastar para decidir", () => {
    const request = routerRequest("Escreva um e-mail para um cliente");
    const output = outputTokenCap("gpt", 300, "low");
    expect(chiefMaxCents(request)).toBe(usdToCents(costInUsd("gpt", "economico", { inputTokens: requestInputTokens(request), outputTokens: output })));
    // Uns 2 centavos, mesmo com a mensagem e o contexto mais longos.
    expect(chiefMaxCents(routerRequest("a".repeat(4000), "b".repeat(4000)))).toBeLessThanOrEqual(3);
  });

  it("as imagens anexadas contam na entrada", () => {
    const plan = planWork(route("responder"), "Descreva a foto");
    const withoutImage = workRequest(plan, "Descreva a foto");
    const withImage = workRequest(plan, "Descreva a foto", [{ mime: "image/png", base64: "AAAA" }]);
    expect(requestInputTokens(withImage) - requestInputTokens(withoutImage)).toBe(IMAGE_INPUT_TOKENS);
  });

  it("a reserva da resposta cobre o Chefe e o maior texto que a IA pode escrever, contando o pensamento", () => {
    for (const provider of ["claude", "gpt", "gemini"] as ProviderId[]) {
      for (const action of ["responder", "documento", "grafico", "projeto", "pesquisa", "codigo"] as RouteAction[]) {
        const plan = planWork(route(action, { provider, tier: "potente" }), "pedido");
        const request = workRequest(plan, buildWorkerInput("", "", "pedido"));
        const chief = call({ stepId: "chief", provider: "gpt", tier: "economico", usage: { inputTokens: 900, outputTokens: 60 } });
        // O maior consumo possível: toda a entrada e todo o teto de saída.
        const answer = call({
          provider,
          tier: plan.tier,
          usage: {
            inputTokens: requestInputTokens(request),
            outputTokens: outputTokenCap(provider, plan.maxOutputTokens, plan.effort),
          },
        });
        const hold = answerHoldCents(costInUsd("gpt", "economico", { inputTokens: 900, outputTokens: 60 }), plan, request);
        expect(taskChargeCents([chief, answer])).toBeLessThanOrEqual(hold);
      }
    }
  });

  it("exemplos de reserva com os preços oficiais conferidos em 25/10/2026 (F17)", () => {
    const simple = planWork(heuristicRoute("O que é CNPJ?"), "O que é CNPJ?");
    const simpleHold = answerHoldCents(0, simple, workRequest(simple, buildWorkerInput("", "", "O que é CNPJ?")));
    expect(simpleHold).toBeLessThanOrEqual(5);

    const doc = planWork(route("documento"), "Gere um PDF");
    // Claude Sonnet com esforço alto: até 22 mil tokens de saída (6 mil de documento e 16 mil de pensamento), uns R$ 1,22.
    expect(answerHoldCents(0, doc, workRequest(doc, "Gere um PDF"))).toBeLessThanOrEqual(130);

    const project = planWork(route("projeto", { tier: "potente" }), "Monte um app");
    const projectHold = answerHoldCents(0, project, workRequest(project, buildWorkerInput("x".repeat(4000), "", "Monte um app")));
    // Claude Opus: uns R$ 2,24 (com o preço antigo do Opus, passava de R$ 8).
    expect(projectHold).toBeGreaterThan(200);
    expect(projectHold).toBeLessThanOrEqual(260);
  });

  it("cobra o consumo real das chamadas que deram certo, somado em dólar e com no mínimo 1 centavo", () => {
    const chief = call({ stepId: "chief", provider: "gpt", tier: "economico", usage: { inputTokens: 900, outputTokens: 60 } });
    const failed = call({ ok: false, attempt: 1, usage: { inputTokens: 100_000, outputTokens: 0 } });
    const answer = call({ attempt: 2 });
    const usd =
      costInUsd("gpt", "economico", { inputTokens: 900, outputTokens: 60 }) +
      costInUsd("claude", "padrao", { inputTokens: 1000, outputTokens: 500 });
    // A tentativa que falhou não é cobrada.
    expect(taskChargeCents([chief, failed, answer])).toBe(usdToCents(usd));
    expect(taskChargeCents([call({ usage: { inputTokens: 1, outputTokens: 0 } })])).toBe(1);
  });

  it("no registro interno, toda chamada aparece; só as que deram certo de uma resposta cobrada ficam como cobradas", () => {
    const ids = { companyId: "empresa", memberId: "pessoa", taskId: "tarefa" };
    const calls = [call({ stepId: "chief" }), call({ ok: false, errorMessage: "caiu" }), call({ attempt: 2 })];
    const rows = taskAiCallRows(ids, calls, true);
    expect(rows.map((row) => [row.step_id, row.status, row.charged])).toEqual([
      ["chief", "ok", true],
      ["answer", "error", false],
      ["answer", "ok", true],
    ]);
    expect(rows[0]).toMatchObject({ run_id: null, task_id: "tarefa", company_id: "empresa", member_id: "pessoa" });
    expect(rows[1].error_message).toBe("caiu");
    expect(taskAiCallRows(ids, calls, false).every((row) => !row.charged)).toBe(true);
  });
});

describe("o texto que vai para a IA", () => {
  it("a conversa entra com as últimas trocas, até o teto de tamanho", () => {
    const turns = Array.from({ length: 10 }, (_, index) => ({ prompt: `pergunta ${index}`, answer: `resposta ${index}` }));
    const text = historyText(turns);
    expect(text).not.toContain("pergunta 3");
    expect(text).toContain("Funcionário: pergunta 4\nVocê: resposta 4");
    expect(text.endsWith("Você: resposta 9")).toBe(true);
    expect(historyText([{ prompt: "x".repeat(10_000), answer: null }]).length).toBe(HISTORY_MAX_CHARS);
  });

  it("os anexos entram até 30.000 caracteres no total, e o corte é avisado (F44)", () => {
    const small = attachmentContext([{ name: "nota.txt", text: "Olá" }]);
    expect(small).toEqual({ text: "--- Arquivo anexado: nota.txt ---\nOlá", cut: false });

    const big = attachmentContext([
      { name: "a.pdf", text: "a".repeat(MAX_ATTACHMENT_TEXT_CHARS - 10) },
      { name: "b.txt", text: "b".repeat(100) },
    ]);
    expect(big.cut).toBe(true);
    expect(big.text.match(/a{100,}/)?.[0].length).toBe(MAX_ATTACHMENT_TEXT_CHARS - 10);
    expect(big.text).toContain(`--- Arquivo anexado: b.txt ---\n${"b".repeat(10)}\n[O resto deste arquivo ficou de fora`);
  });

  it("junta a conversa, os anexos e a mensagem, nessa ordem", () => {
    const input = buildWorkerInput("Funcionário: oi", "--- Arquivo anexado: a.txt ---\nx", "e agora?");
    expect(input.indexOf("Conversa até agora")).toBeLessThan(input.indexOf("Arquivo anexado"));
    expect(input.endsWith("Nova mensagem do funcionário: e agora?")).toBe(true);
    expect(buildWorkerInput("", "", "oi")).toBe("Nova mensagem do funcionário: oi");
  });

  it("o título da conversa nova é o começo da mensagem ou o nome do anexo", () => {
    expect(conversationTitle("  Escreva   um e-mail  ", [])).toBe("Escreva um e-mail");
    expect(conversationTitle("", ["contrato.pdf"])).toBe("Arquivo: contrato.pdf");
    const long = conversationTitle("palavra ".repeat(30), []);
    expect(long.length).toBeLessThanOrEqual(80);
    expect(long.endsWith("…")).toBe(true);
  });

  it("o título do documento vem da primeira linha do que a IA escreveu, nunca do pedido (F49)", () => {
    expect(documentTitle("\n## Resumo da semana:\nTexto", "pdf")).toBe("Resumo da semana");
    expect(documentTitle("**Proposta comercial**\n...", "docx")).toBe("Proposta comercial");
    expect(documentTitle("Mês,Vendas\nJaneiro,10", "xlsx")).toBe("Planilha");
    expect(documentTitle("Mês,Vendas\nJaneiro,10", "csv")).toBe("Planilha");
    expect(documentTitle("   \n  ", "pdf")).toBe("Documento");
    expect(documentTitle("x".repeat(100), "txt")).toHaveLength(60);
  });
});

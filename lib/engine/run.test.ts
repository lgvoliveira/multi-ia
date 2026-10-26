import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockProvider } from "@/lib/providers/mock";
import { createGetProvider } from "@/lib/providers/registry";
import { ProviderError, type AiProvider, type GenerateRequest, type ProviderId } from "@/lib/providers/types";
import { createSiteRecipe } from "@/lib/recipes/create-site";
import {
  SAMPLE_BACK,
  SAMPLE_BRIEF,
  SAMPLE_FINAL_SITE,
  SAMPLE_FRONT,
  SAMPLE_RESEARCH,
  SAMPLE_REVIEW_APPROVED,
} from "@/lib/recipes/create-site.samples";
import { stageSteps } from "@/lib/recipes/types";
import { mergeStepStreams, parseVerdict, resolveTeam, runRecipe } from "./run";
import type { AiCallReport, RunEvent } from "./types";

const recipe = createSiteRecipe;
const REQUEST = "Quero um site para minha confeitaria, com cardápio e botão de WhatsApp.";
const MOCK_FAILURE = (id: ProviderId) => `A IA simulada (${id}) falhou de propósito, para teste.`;

/**
 * IAs simuladas que respondem na hora e anotam cada chamada, para o teste conferir o que cada uma recebeu.
 * `replacements` troca a IA de um identificador por outra (ex.: uma que falha).
 * `wait` é uma espera de mentira: anota quanto o motor mandou esperar entre as tentativas e segue na hora.
 */
function createTestProviders(replacements: Partial<Record<ProviderId, AiProvider>> = {}) {
  const calls: { provider: ProviderId; request: GenerateRequest }[] = [];
  const waits: number[] = [];
  const getProvider = (id: ProviderId): AiProvider => {
    const provider = replacements[id] ?? createMockProvider({ id, chunkDelayMs: 0 });
    return {
      id,
      generate(request) {
        calls.push({ provider: id, request });
        return provider.generate(request);
      },
    };
  };
  const wait = async (ms: number, signal?: AbortSignal) => {
    waits.push(ms);
    signal?.throwIfAborted();
  };
  return { calls, waits, getProvider, wait };
}

/** IA simulada que falha nas primeiras chamadas (Infinity = sempre). */
function failing(id: ProviderId, failFirstCalls = Infinity, failAfterChunks = 0): AiProvider {
  return createMockProvider({ id, chunkDelayMs: 0, failFirstCalls, failAfterChunks });
}

async function collect(events: AsyncIterable<RunEvent>): Promise<RunEvent[]> {
  const result: RunEvent[] = [];
  for await (const event of events) result.push(event);
  return result;
}

function ofType<T extends RunEvent["type"]>(events: RunEvent[], type: T) {
  return events.filter((event): event is Extract<RunEvent, { type: T }> => event.type === type);
}

/** A IA de uma chamada de generate, encontrada pela resposta de exemplo da etapa. */
function callFor(calls: { provider: ProviderId; request: GenerateRequest }[], sampleOutput: string) {
  return calls.find((call) => call.request.sampleResponse === sampleOutput);
}

describe("motor de orquestração", () => {
  it("roda as fases na ordem, cada etapa com a IA sugerida para o seu papel", async () => {
    const { calls, getProvider } = createTestProviders();

    const events = await collect(runRecipe({ recipe, request: REQUEST }, { getProvider }));

    expect(events[0]).toEqual({
      type: "run-started",
      recipeId: "create-site",
      stages: [
        { stageId: "brief", kind: "sequential", steps: [{ stepId: "brief", provider: "claude" }] },
        {
          stageId: "build",
          kind: "parallel",
          steps: [
            { stepId: "front", provider: "gpt" },
            { stepId: "back", provider: "claude" },
            { stepId: "research", provider: "gemini" },
          ],
        },
        { stageId: "review", kind: "review", steps: [{ stepId: "review", provider: "claude" }] },
        // A montagem final fica com o Front-end (gpt): ele parte do HTML pronto e só aplica a revisão.
        { stageId: "final", kind: "sequential", steps: [{ stepId: "consolidate", provider: "gpt" }] },
      ],
    });

    // As etapas começam e terminam numa ordem previsível (as em paralelo, na ordem da fase).
    const order = ["brief", "front", "back", "research", "review", "consolidate"];
    expect(ofType(events, "step-started").map((event) => event.stepId)).toEqual(order);
    expect(ofType(events, "step-finished").map((event) => event.stepId)).toEqual(order);

    // A fase em paralelo chama as três IAs (a ordem exata da corrida não importa).
    expect(calls[0].provider).toBe("claude"); // brief
    expect(new Set(calls.slice(1, 4).map((call) => call.provider))).toEqual(new Set(["gpt", "claude", "gemini"]));
    expect(calls.slice(4).map((call) => call.provider)).toEqual(["claude", "gpt"]); // review (chefe), montagem final (front-end)
  });

  it("narra as fases e, numa fase em paralelo, os pedaços das IAs se intercalam", async () => {
    const { getProvider } = createTestProviders();

    const events = await collect(runRecipe({ recipe, request: REQUEST }, { getProvider }));

    expect(ofType(events, "stage-started").map((event) => [event.stageId, event.round])).toEqual([
      ["brief", 1],
      ["build", 1],
      ["review", 1],
      ["final", 1],
    ]);
    expect(events[0].type).toBe("run-started");
    expect(events.at(-1)?.type).toBe("run-finished");

    // Os primeiros pedaços da fase em paralelo vêm das três etapas, intercalados (não um bloco de cada vez).
    const buildStart = events.findIndex((event) => event.type === "stage-started" && event.stageId === "build");
    const firstTexts = ofType(events.slice(buildStart), "step-text").slice(0, 3).map((event) => event.stepId);
    expect(new Set(firstTexts)).toEqual(new Set(["front", "back", "research"]));
  });

  it("o Front-end recebe o pedido do cliente e o plano do chefe", async () => {
    const { calls, getProvider } = createTestProviders();

    await collect(runRecipe({ recipe, request: REQUEST }, { getProvider }));

    const front = callFor(calls, SAMPLE_FRONT);
    expect(front?.provider).toBe("gpt");
    expect(front?.request.input).toContain(REQUEST);
    expect(front?.request.input).toContain(SAMPLE_BRIEF);
  });

  it("a montagem final recebe o visual, a estrutura, a pesquisa e a revisão", async () => {
    const { calls, getProvider } = createTestProviders();

    await collect(runRecipe({ recipe, request: REQUEST }, { getProvider }));

    const consolidation = callFor(calls, SAMPLE_FINAL_SITE);
    expect(consolidation?.request.input).toContain(SAMPLE_FRONT);
    expect(consolidation?.request.input).toContain(SAMPLE_BACK);
    expect(consolidation?.request.input).toContain(SAMPLE_RESEARCH);
    expect(consolidation?.request.input).toContain(SAMPLE_REVIEW_APPROVED);
  });

  it("cada IA recebe a tarefa da sua etapa, o limite de resposta e a resposta de exemplo", async () => {
    const { calls, getProvider } = createTestProviders();

    await collect(runRecipe({ recipe, request: REQUEST }, { getProvider }));

    for (const step of recipe.stages.flatMap(stageSteps)) {
      const call = callFor(calls, step.sampleOutput);
      expect(call?.request.systemPrompt.endsWith(step.instruction), step.id).toBe(true);
      expect(call?.request.maxOutputTokens, step.id).toBe(step.maxOutputTokens);
    }
  });

  it("o resultado final é a resposta da consolidação", async () => {
    const { getProvider } = createTestProviders();

    const events = await collect(runRecipe({ recipe, request: REQUEST }, { getProvider }));

    const [finished] = ofType(events, "run-finished");
    expect(finished.result).toBe(SAMPLE_FINAL_SITE);
    expect(ofType(events, "step-finished").at(-1)?.output).toBe(SAMPLE_FINAL_SITE);
  });

  it("o site que a IA cerca com marcas de código (```html) sai limpo no resultado e para a etapa seguinte", async () => {
    // Todas as IAs respondem como as de verdade às vezes fazem: uma frase e o site dentro da cerca.
    const fence = "```";
    const fenced = (id: ProviderId): AiProvider => {
      const mock = createMockProvider({ id, chunkDelayMs: 0 });
      return {
        id,
        generate: (request) =>
          mock.generate(
            request.sampleResponse?.includes("<!DOCTYPE")
              ? { ...request, sampleResponse: `Aqui está:\n\n${fence}html\n${request.sampleResponse}\n${fence}\n` }
              : request,
          ),
      };
    };
    const { getProvider } = createTestProviders({ claude: fenced("claude"), gpt: fenced("gpt"), gemini: fenced("gemini") });

    const events = await collect(runRecipe({ recipe, request: REQUEST }, { getProvider }));

    const [finished] = ofType(events, "run-finished");
    expect(finished.result).toBe(SAMPLE_FINAL_SITE.trim());
    expect(finished.result).not.toContain(fence);
    // O Front-end (html) também sai limpo; o texto narrado ao vivo continua com o que a IA escreveu.
    const front = ofType(events, "step-finished").find((step) => step.stepId === "front");
    expect(front?.output.startsWith("<!DOCTYPE")).toBe(true);
    const narrated = ofType(events, "step-text")
      .filter((event) => event.stepId === "front")
      .map((event) => event.text)
      .join("");
    expect(narrated).toContain(`${fence}html`);
  });

  it("os pedaços narrados de cada etapa, juntos, formam a resposta completa da etapa", async () => {
    const { getProvider } = createTestProviders();

    const events = await collect(runRecipe({ recipe, request: REQUEST }, { getProvider }));

    for (const step of ofType(events, "step-finished")) {
      const pieces = ofType(events, "step-text").filter((event) => event.stepId === step.stepId);
      expect(pieces.map((piece) => piece.text).join(""), step.stepId).toBe(step.output);
    }
  });

  it("soma o consumo de cada etapa nos totais da execução", async () => {
    const { getProvider } = createTestProviders();

    const events = await collect(runRecipe({ recipe, request: REQUEST }, { getProvider }));

    const steps = ofType(events, "step-finished");
    for (const step of steps) {
      expect(step.model).toBe(`mock-${step.provider}`);
      expect(step.truncated).toBe(false);
      expect(typeof step.durationMs).toBe("number");
    }
    const [finished] = ofType(events, "run-finished");
    expect(finished.usage).toEqual({
      inputTokens: steps.reduce((sum, step) => sum + step.usage.inputTokens, 0),
      outputTokens: steps.reduce((sum, step) => sum + step.usage.outputTokens, 0),
    });
    expect(finished.steps.map((step) => ({ type: "step-finished", ...step }))).toEqual(steps);
  });

  it("usa a IA escolhida pelo usuário no lugar da sugerida", async () => {
    const { calls, getProvider } = createTestProviders();

    const events = await collect(
      runRecipe({ recipe, request: REQUEST, team: { frontend: "claude" } }, { getProvider }),
    );

    expect(callFor(calls, SAMPLE_FRONT)?.provider).toBe("claude");
    const front = ofType(events, "step-finished").find((step) => step.stepId === "front");
    expect(front?.provider).toBe("claude");
  });

  it("quando o usuário cancela no meio de uma etapa, para e avisa qual etapa estava rodando", async () => {
    const { calls, getProvider } = createTestProviders();
    const controller = new AbortController();
    const events: RunEvent[] = [];

    for await (const event of runRecipe(
      { recipe, request: REQUEST },
      { getProvider, signal: controller.signal },
    )) {
      events.push(event);
      if (event.type === "step-text" && event.stepId === "brief") controller.abort();
    }

    expect(events.at(-1)).toEqual({ type: "run-cancelled", stepId: "brief" });
    expect(ofType(events, "run-failed")).toEqual([]);
    // Só o plano chegou a rodar.
    expect(calls).toHaveLength(1);
  });

  it("quando o usuário cancela entre uma fase e outra, não chama a próxima IA", async () => {
    const { calls, getProvider } = createTestProviders();
    const controller = new AbortController();
    const events: RunEvent[] = [];

    for await (const event of runRecipe(
      { recipe, request: REQUEST },
      { getProvider, signal: controller.signal },
    )) {
      events.push(event);
      if (event.type === "step-finished" && event.stepId === "brief") controller.abort();
    }

    // Depois do plano vem a fase em paralelo: a primeira etapa dela fica como cancelada.
    expect(events.at(-1)).toEqual({ type: "run-cancelled", stepId: "front" });
    expect(calls).toHaveLength(1);
  });

  it("recusa pedido inválido na hora, sem chamar nenhuma IA", () => {
    const { calls, getProvider } = createTestProviders();

    expect(() => runRecipe({ recipe, request: "   " }, { getProvider })).toThrow(
      "Escreva o que você quer que o time faça.",
    );
    expect(calls).toEqual([]);
  });

  it("tira os espaços do começo e do fim do pedido antes de mandar para as IAs", async () => {
    const { calls, getProvider } = createTestProviders();

    await collect(runRecipe({ recipe, request: `\n  ${REQUEST}  \n` }, { getProvider }));

    expect(calls[0].request.input).toBe(`<parte nome="Pedido do cliente">\n${REQUEST}\n</parte>`);
  });
});

describe("revisão com rodadas", () => {
  /** IA do chefe que reprova a 1ª revisão e aprova a 2ª; nas outras etapas, responde o exemplo de sempre. */
  function reviewingChief() {
    let reviewCalls = 0;
    const mock = createMockProvider({ id: "claude", chunkDelayMs: 0 });
    const provider: AiProvider = {
      id: "claude",
      async *generate(request) {
        if (request.sampleResponse === SAMPLE_REVIEW_APPROVED) {
          reviewCalls += 1;
          const verdict = reviewCalls === 1 ? "REVISAR:\n- Aumente o contraste do rodapé." : SAMPLE_REVIEW_APPROVED;
          yield { type: "text", text: verdict };
          yield { type: "done", usage: { inputTokens: 1, outputTokens: 1 }, model: "mock-claude", truncated: false };
          return;
        }
        yield* mock.generate(request);
      },
    };
    return provider;
  }

  it("quando a revisão reprova, refaz a fase em paralelo e revisa de novo, até no máximo 2 rodadas", async () => {
    const { calls, getProvider } = createTestProviders({ claude: reviewingChief() });

    // A receita real usa 1 rodada (por velocidade); aqui forçamos 2 para testar o loop do motor.
    const twoRounds = {
      ...recipe,
      stages: recipe.stages.map((stage) =>
        stage.kind === "review" ? { ...stage, maxRounds: 2 } : stage,
      ),
    };
    const events = await collect(runRecipe({ recipe: twoRounds, request: REQUEST }, { getProvider }));

    // Dois vereditos: reprovou na 1ª rodada, aprovou na 2ª.
    expect(ofType(events, "review-result").map((event) => [event.round, event.approved])).toEqual([
      [1, false],
      [2, true],
    ]);
    // A fase em paralelo rodou duas vezes: na 2ª, as etapas voltam com a rodada 2.
    const frontStarts = ofType(events, "step-started").filter((event) => event.stepId === "front");
    expect(frontStarts).toHaveLength(2);
    expect(frontStarts.some((event) => event.round === 2)).toBe(true);
    // Cada trabalhador da fase foi chamado duas vezes.
    expect(calls.filter((call) => call.request.sampleResponse === SAMPLE_FRONT)).toHaveLength(2);
    expect(calls.filter((call) => call.request.sampleResponse === SAMPLE_RESEARCH)).toHaveLength(2);
    expect(events.at(-1)).toMatchObject({ type: "run-finished", result: SAMPLE_FINAL_SITE });
  });

  it("lê o veredito pela primeira linha; o que não dá para entender conta como aprovado", () => {
    expect(parseVerdict("APROVADO\nTudo certo.")).toBe(true);
    expect(parseVerdict("REVISAR:\n- Corrija isto.")).toBe(false);
    expect(parseVerdict("Hmm, não sei dizer.")).toBe(true);
  });
});

describe("quando uma IA falha", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Quem trocou de IA em cada etapa: [etapa, IA que falhou, IA que assumiu]. */
  function switches(events: RunEvent[]) {
    return ofType(events, "step-switched").map(({ stepId, from, to }) => [stepId, from, to]);
  }

  function finishedStep(events: RunEvent[], stepId: string) {
    return ofType(events, "step-finished").find((step) => step.stepId === stepId);
  }

  function startedProvider(events: RunEvent[], stepId: string) {
    return ofType(events, "step-started").find((step) => step.stepId === stepId)?.provider;
  }

  it("tenta de novo com a mesma IA depois de 1 s e, se ela acerta na 2ª tentativa, o time segue", async () => {
    // O Front-end (GPT) falha uma vez na fase em paralelo.
    const { waits, getProvider, wait } = createTestProviders({ gpt: failing("gpt", 1) });

    const events = await collect(runRecipe({ recipe, request: REQUEST }, { getProvider, wait }));

    expect(ofType(events, "step-retrying")).toEqual([
      {
        type: "step-retrying",
        stepId: "front",
        provider: "gpt",
        attempt: 2,
        delayMs: 1000,
        errorMessage: MOCK_FAILURE("gpt"),
      },
    ]);
    expect(waits).toEqual([1000]);
    expect(switches(events)).toEqual([]);
    expect(finishedStep(events, "front")?.provider).toBe("gpt");
    expect(events.at(-1)?.type).toBe("run-finished");
  });

  it("depois de 3 falhas, a IA reserva assume o papel do trabalhador, avisa e faz a etapa do zero", async () => {
    const { waits, getProvider, wait } = createTestProviders({ gpt: failing("gpt") });

    const events = await collect(runRecipe({ recipe, request: REQUEST }, { getProvider, wait }));

    expect(ofType(events, "step-switched")).toEqual([
      {
        type: "step-switched",
        stepId: "front",
        roleId: "frontend",
        from: "gpt",
        to: "claude",
        errorMessage: MOCK_FAILURE("gpt"),
      },
    ]);
    expect(waits).toEqual([1000, 2000]);
    expect(finishedStep(events, "front")).toMatchObject({ provider: "claude", output: SAMPLE_FRONT });
    expect(events.at(-1)).toMatchObject({ type: "run-finished", result: SAMPLE_FINAL_SITE });
  });

  it("a IA que assumiu segue no papel nas próximas etapas dele", async () => {
    // O Chefe (Claude) falha no plano e o GPT assume; a revisão e a consolidação, também do chefe, já usam o GPT.
    const { getProvider, wait } = createTestProviders({ claude: failing("claude") });

    const events = await collect(runRecipe({ recipe, request: REQUEST }, { getProvider, wait }));

    expect(switches(events)).toContainEqual(["brief", "claude", "gpt"]);
    expect(startedProvider(events, "review")).toBe("gpt");
    expect(startedProvider(events, "consolidate")).toBe("gpt");
    expect(events.at(-1)?.type).toBe("run-finished");
  });

  it("se a IA que falhou foi escolhida pelo usuário, quem assume é a recomendada pela receita", async () => {
    const { getProvider, wait } = createTestProviders({ gemini: failing("gemini") });

    const events = await collect(
      runRecipe({ recipe, request: REQUEST, team: { frontend: "gemini" } }, { getProvider, wait }),
    );

    // Pesquisador: o Gemini é o recomendado. Ele falha, e entra a reserva da receita, o Claude.
    // Front-end: o usuário trocou o GPT (recomendado) pelo Gemini. O Gemini falha, e volta o GPT.
    expect(switches(events)).toContainEqual(["research", "gemini", "claude"]);
    expect(switches(events)).toContainEqual(["front", "gemini", "gpt"]);
    expect(events.at(-1)?.type).toBe("run-finished");
  });

  it("se uma etapa em paralelo não se recupera, a fase inteira para, sem chegar à revisão", async () => {
    // O Pesquisador (Gemini) e a reserva dele (Claude) falham sempre: a fase em paralelo falha na pesquisa.
    const { getProvider, wait } = createTestProviders({
      gemini: failing("gemini"),
      claude: failing("claude"),
    });

    const events = await collect(runRecipe({ recipe, request: REQUEST }, { getProvider, wait }));

    expect(events.at(-1)).toEqual({
      type: "run-failed",
      stepId: "research",
      provider: "claude",
      retryable: true,
      errorMessage: MOCK_FAILURE("claude"),
    });
    // Não chegou à revisão nem à consolidação.
    expect(ofType(events, "stage-started").map((event) => event.stageId)).not.toContain("review");
  });

  it("erro que não adianta repetir (ex.: a IA recusou o pedido) troca de IA na hora, sem novas tentativas", async () => {
    const refuses: AiProvider = {
      id: "gpt",
      generate() {
        throw new ProviderError("400: pedido recusado", { retryable: false });
      },
    };
    const { waits, getProvider, wait } = createTestProviders({ gpt: refuses });

    const events = await collect(runRecipe({ recipe, request: REQUEST }, { getProvider, wait }));

    expect(ofType(events, "step-retrying")).toEqual([]);
    expect(waits).toEqual([]);
    expect(switches(events)).toEqual([["front", "gpt", "claude"]]);
    expect(events.at(-1)?.type).toBe("run-finished");
  });

  it("o texto da tentativa que falhou não entra na resposta da etapa", async () => {
    // O GPT (Front-end) escreve 3 pedaços e cai. Na 2ª tentativa, escreve o site inteiro.
    const { calls, getProvider, wait } = createTestProviders({ gpt: failing("gpt", 1, 3) });

    const events = await collect(runRecipe({ recipe, request: REQUEST }, { getProvider, wait }));

    expect(finishedStep(events, "front")?.output).toBe(SAMPLE_FRONT);
    // A consolidação recebe o visual já pronto (a tentativa que falhou não entra).
    const consolidation = callFor(calls, SAMPLE_FINAL_SITE);
    expect(consolidation?.request.input).toContain(`<parte nome="Visual do front-end">\n${SAMPLE_FRONT}\n</parte>`);
  });

  it("IA que para de responder sem avisar que terminou conta como falha passageira", async () => {
    const stopsHalfway: AiProvider = {
      id: "gpt",
      async *generate() {
        yield { type: "text", text: "<!DOCTYPE html>" };
      },
    };
    const { getProvider, wait } = createTestProviders({ gpt: stopsHalfway });

    const events = await collect(runRecipe({ recipe, request: REQUEST }, { getProvider, wait }));

    expect(ofType(events, "step-retrying")[0]).toEqual({
      type: "step-retrying",
      stepId: "front",
      provider: "gpt",
      attempt: 2,
      delayMs: 1000,
      errorMessage: "A IA parou de responder antes de terminar.",
    });
    expect(switches(events)).toEqual([["front", "gpt", "claude"]]);
  });

  it("defeito no nosso código não é falha da IA: para na hora, sem tentar de novo nem trocar de IA", async () => {
    const { waits, getProvider, wait } = createTestProviders();
    const brokenGetProvider = (id: ProviderId) => {
      if (id === "gemini") throw new Error("Configuração do Gemini com defeito.");
      return getProvider(id);
    };

    const events = await collect(
      runRecipe({ recipe, request: REQUEST }, { getProvider: brokenGetProvider, wait }),
    );

    // O Gemini é o Pesquisador, na fase em paralelo: é aí que o defeito aparece e a execução para.
    expect(events.at(-1)).toEqual({
      type: "run-failed",
      stepId: "research",
      provider: "gemini",
      retryable: false,
      errorMessage: "Configuração do Gemini com defeito.",
    });
    expect(waits).toEqual([]);
  });

  it("o tempo da etapa conta as tentativas que falharam e as esperas", async () => {
    let clock = 0;
    const failsOnce = failing("claude", 1);
    const slowClaude: AiProvider = {
      id: "claude",
      async *generate(request) {
        clock += 5000; // cada tentativa leva 5 s
        yield* failsOnce.generate(request);
      },
    };
    const { getProvider } = createTestProviders({ claude: slowClaude });
    const wait = async (ms: number) => {
      clock += ms;
    };

    const events = await collect(
      runRecipe({ recipe, request: REQUEST }, { getProvider, wait, now: () => clock }),
    );

    // O plano (Chefe/Claude) falha uma vez: 5 s + 1 s de espera + 5 s.
    expect(finishedStep(events, "brief")?.durationMs).toBe(5000 + 1000 + 5000);
  });

  it("espera de verdade antes de tentar de novo", async () => {
    vi.useFakeTimers();
    // Falha o Gemini, que aparece em uma única etapa (o Pesquisador): a contagem reflete só o retry dele.
    const { calls, getProvider } = createTestProviders({ gemini: failing("gemini", 1) });
    const geminiCalls = () => calls.filter((call) => call.provider === "gemini").length;

    const done = collect(runRecipe({ recipe, request: REQUEST }, { getProvider }));

    await vi.advanceTimersByTimeAsync(999);
    expect(geminiCalls()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(geminiCalls()).toBe(2);
    expect((await done).at(-1)?.type).toBe("run-finished");
  });

  it("se o usuário cancela durante a espera, para na hora, sem tentar de novo", async () => {
    // Usa o plano (fase sequencial) para que nada mais esteja rodando ao mesmo tempo durante a espera.
    vi.useFakeTimers();
    const { calls, getProvider } = createTestProviders({ claude: failing("claude") });
    const controller = new AbortController();
    const run = runRecipe({ recipe, request: REQUEST }, { getProvider, signal: controller.signal });
    while ((await run.next()).value?.type !== "step-retrying");

    const next = run.next(); // o motor começa a esperar 1 s
    await vi.advanceTimersByTimeAsync(500);
    controller.abort();

    expect((await next).value).toEqual({ type: "run-cancelled", stepId: "brief" });
    expect(calls.filter((call) => call.provider === "claude")).toHaveLength(1);
  });
});

describe("mesclar as etapas em paralelo", () => {
  async function drain(gen: AsyncGenerator<RunEvent, unknown>): Promise<RunEvent[]> {
    const events: RunEvent[] = [];
    for await (const event of gen) events.push(event);
    return events;
  }

  it("repassa os pedaços das etapas e junta o resultado de cada uma", async () => {
    async function* worker(stepId: string, result: string): AsyncGenerator<RunEvent, string> {
      yield { type: "step-text", stepId, text: `${stepId}-a` };
      await Promise.resolve();
      yield { type: "step-text", stepId, text: `${stepId}-b` };
      return result;
    }

    const merge = mergeStepStreams<string>([
      { stepId: "front", gen: worker("front", "FRONT") },
      { stepId: "back", gen: worker("back", "BACK") },
    ]);

    const events: RunEvent[] = [];
    let next = await merge.next();
    while (!next.done) {
      events.push(next.value);
      next = await merge.next();
    }

    expect(next.value).toEqual(new Map([["front", "FRONT"], ["back", "BACK"]]));
    expect(ofType(events, "step-text").map((event) => event.text).sort()).toEqual([
      "back-a",
      "back-b",
      "front-a",
      "front-b",
    ]);
  });

  it("se uma etapa falha, as irmãs são mandadas parar e o erro sobe", async () => {
    let siblingCancelled = false;
    async function* failingWorker(): AsyncGenerator<RunEvent, string> {
      yield { type: "step-text", stepId: "front", text: "front-a" };
      throw new Error("boom");
    }
    async function* sibling(): AsyncGenerator<RunEvent, string> {
      try {
        for (;;) {
          await Promise.resolve();
          yield { type: "step-text", stepId: "back", text: "back" };
        }
      } finally {
        siblingCancelled = true;
      }
    }

    const merge = mergeStepStreams<string>([
      { stepId: "front", gen: failingWorker() },
      { stepId: "back", gen: sibling() },
    ]);

    await expect(drain(merge)).rejects.toThrow("boom");
    expect(siblingCancelled).toBe(true);
  });
});

describe("IAs de verdade ligadas sem as chaves (F42)", () => {
  it("o Chefe sem chave passa para a IA reserva, que também está sem chave, e o time para sem nenhuma etapa concluída", async () => {
    const reports: AiCallReport[] = [];
    const events = await collect(
      runRecipe({ recipe, request: REQUEST }, { getProvider: createGetProvider({}), onAiCall: (call) => reports.push(call) }),
    );

    expect(ofType(events, "step-switched")).toEqual([expect.objectContaining({ stepId: "brief", from: "claude", to: "gpt" })]);
    expect(ofType(events, "step-finished")).toEqual([]);
    expect(ofType(events, "run-failed")).toEqual([expect.objectContaining({ stepId: "brief", provider: "gpt", retryable: false })]);
    // Uma tentativa com cada IA (não adianta repetir), e o motivo no registro interno.
    expect(reports.map((call) => [call.provider, call.ok])).toEqual([
      ["claude", false],
      ["gpt", false],
    ]);
    expect(reports[0].errorMessage).toContain("OCK_CLAUDE_KEY");
  });
});

describe("registro de cada chamada às IAs (onAiCall, base do custo real)", () => {
  it("avisa cada chamada que deu certo, com o modelo, o nível e o mesmo consumo da etapa", async () => {
    const { getProvider } = createTestProviders();
    const reports: AiCallReport[] = [];

    const events = await collect(
      runRecipe({ recipe, request: REQUEST }, { getProvider, onAiCall: (call) => reports.push(call) }),
    );

    const finished = ofType(events, "step-finished");
    expect(reports).toHaveLength(finished.length);
    for (const step of finished) {
      const report = reports.find((call) => call.stepId === step.stepId);
      expect(report).toMatchObject({
        provider: step.provider,
        model: step.model,
        tier: "padrao",
        usage: step.usage,
        ok: true,
        attempt: 1,
      });
      expect(report?.errorMessage).toBeUndefined();
    }
  });

  it("avisa também as tentativas que falharam, com o que a IA chegou a escrever", async () => {
    // O GPT (Front-end) cai depois de escrever 2 pedaços na 1ª tentativa e acerta na 2ª.
    const { getProvider, wait } = createTestProviders({ gpt: failing("gpt", 1, 2) });
    const reports: AiCallReport[] = [];

    await collect(runRecipe({ recipe, request: REQUEST }, { getProvider, wait, onAiCall: (call) => reports.push(call) }));

    const front = reports.filter((call) => call.stepId === "front");
    expect(front.map((call) => [call.attempt, call.ok])).toEqual([
      [1, false],
      [2, true],
    ]);
    expect(front[0]).toMatchObject({ model: "mock-gpt", errorMessage: MOCK_FAILURE("gpt") });
    expect(front[0].usage.inputTokens).toBeGreaterThan(0);
    expect(front[0].usage.outputTokens).toBeGreaterThan(0);
  });

  it("a tentativa que falhou leva o consumo que a IA informou, quando ela informou (F26)", async () => {
    const usage = { inputTokens: 4321, outputTokens: 987 };
    // O Chefe (Claude) recusa: erro que não adianta repetir, com o consumo da empresa da IA.
    const refusing: AiProvider = {
      id: "claude",
      async *generate() {
        yield { type: "text", text: "Não posso" };
        throw new ProviderError("A IA recusou o pedido.", { retryable: false, model: "claude-sonnet-5-5", usage });
      },
    };
    const { getProvider, wait } = createTestProviders({ claude: refusing });
    const reports: AiCallReport[] = [];

    await collect(runRecipe({ recipe, request: REQUEST }, { getProvider, wait, onAiCall: (call) => reports.push(call) }));

    expect(reports.find((call) => call.stepId === "brief" && call.provider === "claude")).toMatchObject({
      ok: false,
      model: "claude-sonnet-5-5",
      usage,
    });
  });

  it("avisa a chamada interrompida pelo cancelamento", async () => {
    const { getProvider } = createTestProviders();
    const controller = new AbortController();
    const reports: AiCallReport[] = [];

    for await (const event of runRecipe(
      { recipe, request: REQUEST },
      { getProvider, signal: controller.signal, onAiCall: (call) => reports.push(call) },
    )) {
      if (event.type === "step-text" && event.stepId === "brief") controller.abort();
    }

    expect(reports).toEqual([
      expect.objectContaining({ stepId: "brief", ok: false, errorMessage: "Cancelada no meio.", attempt: 1 }),
    ]);
    expect(reports[0].usage.outputTokens).toBeGreaterThan(0);
  });

  it("numa fase em paralelo, avisa a etapa irmã que parou no meio porque outra falhou", async () => {
    // O Pesquisador quebra na hora (defeito, sem novas tentativas); o Front-end ainda está escrevendo, devagar.
    const broken: AiProvider = {
      id: "gemini",
      async *generate() {
        throw new Error("defeito no conector");
      },
    };
    const { calls, getProvider } = createTestProviders({
      gemini: broken,
      gpt: createMockProvider({ id: "gpt", chunkDelayMs: 5 }),
    });
    const reports: AiCallReport[] = [];

    await collect(runRecipe({ recipe, request: REQUEST }, { getProvider, onAiCall: (call) => reports.push(call) }));

    // Cada chamada às IAs foi avisada uma vez, terminasse como terminasse.
    expect(reports).toHaveLength(calls.length);
    expect(reports.find((call) => call.stepId === "research")).toMatchObject({
      ok: false,
      errorMessage: "defeito no conector",
    });
    expect(reports.find((call) => call.stepId === "front")).toMatchObject({
      ok: false,
      errorMessage: "Parou no meio: outra etapa da fase falhou.",
    });
  });
});

describe("time da execução", () => {
  it("usa a IA sugerida pela receita em cada papel que o usuário não trocou", () => {
    expect(resolveTeam(recipe)).toEqual({
      chief: "claude",
      researcher: "gemini",
      frontend: "gpt",
      backend: "claude",
    });
    expect(resolveTeam(recipe, { frontend: "claude" })).toEqual({
      chief: "claude",
      researcher: "gemini",
      frontend: "claude",
      backend: "claude",
    });
  });
});

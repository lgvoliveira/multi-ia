import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockProvider, estimateTokens } from "@/lib/providers/mock";
import { ProviderError, type AiProvider, type GenerateRequest, type ProviderId } from "@/lib/providers/types";
import { createSiteRecipe } from "@/lib/recipes/create-site";
import {
  SAMPLE_FINAL_SITE,
  SAMPLE_FIRST_SITE,
  SAMPLE_PLAN,
  SAMPLE_REVIEW,
} from "@/lib/recipes/create-site.samples";
import { resolveTeam, runRecipe } from "./run";
import type { RunEvent } from "./types";

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

/** O roteiro da narração: cada evento com a sua etapa, contando só uma vez os pedaços de texto seguidos. */
function outline(events: RunEvent[]): string[] {
  return events
    .filter((event, i) => !(event.type === "step-text" && events[i - 1]?.type === "step-text"))
    .map((event) => ("stepId" in event ? `${event.type} ${event.stepId}` : event.type));
}

describe("motor de orquestração", () => {
  it("roda as 4 etapas na ordem, cada uma com a IA sugerida para o seu papel", async () => {
    const { calls, getProvider } = createTestProviders();

    const events = await collect(runRecipe({ recipe, request: REQUEST }, { getProvider }));

    const expectedSteps = [
      { stepId: "plan", provider: "claude" },
      { stepId: "code", provider: "gpt" },
      { stepId: "review", provider: "gemini" },
      { stepId: "consolidate", provider: "claude" },
    ];
    expect(events[0]).toEqual({ type: "run-started", recipeId: "create-site", steps: expectedSteps });
    expect(ofType(events, "step-started")).toEqual(
      expectedSteps.map((step) => ({ type: "step-started", ...step })),
    );
    expect(calls.map((call) => call.provider)).toEqual(["claude", "gpt", "gemini", "claude"]);
  });

  it("narra o começo, os pedaços e o fim de cada etapa e, por último, o fim da execução", async () => {
    const { getProvider } = createTestProviders();

    const events = await collect(runRecipe({ recipe, request: REQUEST }, { getProvider }));

    expect(outline(events)).toEqual([
      "run-started",
      ...["plan", "code", "review", "consolidate"].flatMap((stepId) => [
        `step-started ${stepId}`,
        `step-text ${stepId}`,
        `step-finished ${stepId}`,
      ]),
      "run-finished",
    ]);
  });

  it("o programador recebe o pedido do cliente e o plano do chefe", async () => {
    const { calls, getProvider } = createTestProviders();

    await collect(runRecipe({ recipe, request: REQUEST }, { getProvider }));

    const programmer = calls[1];
    expect(programmer.provider).toBe("gpt");
    expect(programmer.request.input).toContain(REQUEST);
    expect(programmer.request.input).toContain(SAMPLE_PLAN);
    expect(programmer.request.systemPrompt).toContain(recipe.roles[1].systemPrompt);
  });

  it("o revisor recebe o site do programador, e a consolidação recebe também a revisão", async () => {
    const { calls, getProvider } = createTestProviders();

    await collect(runRecipe({ recipe, request: REQUEST }, { getProvider }));

    const [, , reviewer, consolidation] = calls;
    expect(reviewer.request.input).toContain(SAMPLE_FIRST_SITE);
    expect(reviewer.request.input).not.toContain(SAMPLE_REVIEW);
    expect(consolidation.request.input).toContain(SAMPLE_FIRST_SITE);
    expect(consolidation.request.input).toContain(SAMPLE_REVIEW);
  });

  it("cada IA recebe a tarefa da sua etapa, o limite de resposta e a resposta de exemplo", async () => {
    const { calls, getProvider } = createTestProviders();

    await collect(runRecipe({ recipe, request: REQUEST }, { getProvider }));

    recipe.steps.forEach((step, i) => {
      expect(calls[i].request.systemPrompt.endsWith(step.instruction), step.id).toBe(true);
      expect(calls[i].request.maxOutputTokens, step.id).toBe(step.maxOutputTokens);
      expect(calls[i].request.sampleResponse, step.id).toBe(step.sampleOutput);
    });
  });

  it("o resultado final é a resposta da consolidação", async () => {
    const { getProvider } = createTestProviders();

    const events = await collect(runRecipe({ recipe, request: REQUEST }, { getProvider }));

    const [finished] = ofType(events, "run-finished");
    expect(finished.result).toBe(SAMPLE_FINAL_SITE);
    expect(ofType(events, "step-finished").at(-1)?.output).toBe(SAMPLE_FINAL_SITE);
  });

  it("os pedaços narrados de cada etapa, juntos, formam a resposta completa da etapa", async () => {
    const { getProvider } = createTestProviders();

    const events = await collect(runRecipe({ recipe, request: REQUEST }, { getProvider }));

    for (const step of ofType(events, "step-finished")) {
      const pieces = ofType(events, "step-text").filter((event) => event.stepId === step.stepId);
      expect(pieces.map((piece) => piece.text).join(""), step.stepId).toBe(step.output);
    }
  });

  it("registra o tempo e o consumo de cada etapa, e os totais da execução", async () => {
    // Relógio falso: cada IA "leva" um tempo fixo para responder.
    let clock = 0;
    const secondsToAnswer: Record<ProviderId, number> = { claude: 2, gpt: 5, gemini: 3 };
    const slowProvider = (id: ProviderId): AiProvider => {
      const mock = createMockProvider({ id, chunkDelayMs: 0 });
      return {
        id,
        async *generate(request) {
          clock += secondsToAnswer[id] * 1000;
          yield* mock.generate(request);
        },
      };
    };
    const { calls, getProvider } = createTestProviders({
      claude: slowProvider("claude"),
      gpt: slowProvider("gpt"),
      gemini: slowProvider("gemini"),
    });

    const events = await collect(
      runRecipe({ recipe, request: REQUEST }, { getProvider, now: () => clock }),
    );

    const steps = ofType(events, "step-finished");
    expect(steps.map((step) => [step.stepId, step.durationMs])).toEqual([
      ["plan", 2000],
      ["code", 5000],
      ["review", 3000],
      ["consolidate", 2000],
    ]);
    steps.forEach((step, i) => {
      const { systemPrompt, input } = calls[i].request;
      expect(step.usage, step.stepId).toEqual({
        inputTokens: estimateTokens(systemPrompt + input),
        outputTokens: estimateTokens(recipe.steps[i].sampleOutput),
      });
      expect(step.model).toBe(`mock-${step.provider}`);
      expect(step.truncated).toBe(false);
    });

    const [finished] = ofType(events, "run-finished");
    expect(finished.durationMs).toBe(12_000);
    expect(finished.usage).toEqual({
      inputTokens: steps.reduce((sum, step) => sum + step.usage.inputTokens, 0),
      outputTokens: steps.reduce((sum, step) => sum + step.usage.outputTokens, 0),
    });
    expect(finished.steps.map((step) => ({ type: "step-finished", ...step }))).toEqual(steps);
  });

  it("usa a IA escolhida pelo usuário no lugar da sugerida", async () => {
    const { calls, getProvider } = createTestProviders();

    const events = await collect(
      runRecipe(
        { recipe, request: REQUEST, team: { programmer: "claude", reviewer: "gpt" } },
        { getProvider },
      ),
    );

    expect(calls.map((call) => call.provider)).toEqual(["claude", "claude", "gpt", "claude"]);
    expect(ofType(events, "step-finished").map((step) => step.provider)).toEqual([
      "claude",
      "claude",
      "gpt",
      "claude",
    ]);
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
      if (event.type === "step-text" && event.stepId === "code") controller.abort();
    }

    expect(events.at(-1)).toEqual({ type: "run-cancelled", stepId: "code" });
    expect(ofType(events, "run-failed")).toEqual([]);
    expect(calls).toHaveLength(2);
  });

  it("quando o usuário cancela entre uma etapa e outra, não chama a próxima IA", async () => {
    const { calls, getProvider } = createTestProviders();
    const controller = new AbortController();
    const events: RunEvent[] = [];

    for await (const event of runRecipe(
      { recipe, request: REQUEST },
      { getProvider, signal: controller.signal },
    )) {
      events.push(event);
      if (event.type === "step-finished" && event.stepId === "plan") controller.abort();
    }

    expect(events.at(-1)).toEqual({ type: "run-cancelled", stepId: "code" });
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

  it("tenta de novo com a mesma IA depois de 1 s e, se ela acerta na 2ª tentativa, o time segue", async () => {
    const { calls, waits, getProvider, wait } = createTestProviders({ gpt: failing("gpt", 1) });

    const events = await collect(runRecipe({ recipe, request: REQUEST }, { getProvider, wait }));

    expect(ofType(events, "step-retrying")).toEqual([
      {
        type: "step-retrying",
        stepId: "code",
        provider: "gpt",
        attempt: 2,
        delayMs: 1000,
        errorMessage: MOCK_FAILURE("gpt"),
      },
    ]);
    expect(waits).toEqual([1000]);
    expect(calls.map((call) => call.provider)).toEqual(["claude", "gpt", "gpt", "gemini", "claude"]);
    expect(switches(events)).toEqual([]);
    expect(finishedStep(events, "code")?.provider).toBe("gpt");
    expect(events.at(-1)?.type).toBe("run-finished");
  });

  it("tenta de novo até 2 vezes, esperando 1 s e depois 2 s", async () => {
    const { waits, getProvider, wait } = createTestProviders({ gpt: failing("gpt", 2) });

    const events = await collect(runRecipe({ recipe, request: REQUEST }, { getProvider, wait }));

    expect(ofType(events, "step-retrying").map((event) => event.attempt)).toEqual([2, 3]);
    expect(waits).toEqual([1000, 2000]);
    expect(finishedStep(events, "code")?.provider).toBe("gpt");
    expect(events.at(-1)?.type).toBe("run-finished");
  });

  it("depois de 3 falhas, a IA reserva assume o papel, avisa e faz a etapa do zero", async () => {
    const { calls, waits, getProvider, wait } = createTestProviders({ gpt: failing("gpt") });

    const events = await collect(runRecipe({ recipe, request: REQUEST }, { getProvider, wait }));

    expect(outline(events).filter((line) => line.endsWith(" code"))).toEqual([
      "step-started code",
      "step-retrying code",
      "step-retrying code",
      "step-switched code",
      "step-text code",
      "step-finished code",
    ]);
    expect(ofType(events, "step-switched")).toEqual([
      {
        type: "step-switched",
        stepId: "code",
        roleId: "programmer",
        from: "gpt",
        to: "claude",
        errorMessage: MOCK_FAILURE("gpt"),
      },
    ]);
    // Troca na hora, sem esperar: a outra IA não estava com problema.
    expect(waits).toEqual([1000, 2000]);
    expect(calls.map((call) => call.provider)).toEqual([
      "claude",
      ...["gpt", "gpt", "gpt"],
      "claude",
      "gemini",
      "claude",
    ]);
    expect(finishedStep(events, "code")).toMatchObject({ provider: "claude", output: SAMPLE_FIRST_SITE });
    expect(events.at(-1)).toMatchObject({ type: "run-finished", result: SAMPLE_FINAL_SITE });
  });

  it("a IA que assumiu segue no papel nas próximas etapas dele", async () => {
    const { calls, getProvider, wait } = createTestProviders({ claude: failing("claude") });

    const events = await collect(runRecipe({ recipe, request: REQUEST }, { getProvider, wait }));

    // O Chefe (Claude) falha no plano e o GPT assume. A consolidação, também do Chefe, já começa com o GPT.
    expect(switches(events)).toEqual([["plan", "claude", "gpt"]]);
    expect(ofType(events, "step-started").at(-1)).toEqual({
      type: "step-started",
      stepId: "consolidate",
      provider: "gpt",
    });
    expect(calls.map((call) => call.provider)).toEqual([
      ...["claude", "claude", "claude"],
      "gpt",
      "gpt",
      "gemini",
      "gpt",
    ]);
    expect(events.at(-1)?.type).toBe("run-finished");
  });

  it("se a IA que falhou foi escolhida pelo usuário, quem assume é a recomendada pela receita", async () => {
    const { getProvider, wait } = createTestProviders({ gemini: failing("gemini") });

    const events = await collect(
      runRecipe({ recipe, request: REQUEST, team: { programmer: "gemini" } }, { getProvider, wait }),
    );

    // Programador: o usuário trocou o GPT (recomendado) pelo Gemini. O Gemini falha, e volta o GPT.
    // Revisor: o Gemini é o recomendado. Ele falha, e entra a reserva da receita, o Claude.
    expect(switches(events)).toEqual([
      ["code", "gemini", "gpt"],
      ["review", "gemini", "claude"],
    ]);
    expect(events.at(-1)?.type).toBe("run-finished");
  });

  it("para quando a IA reserva também falha, sem chamar as próximas etapas", async () => {
    const { calls, waits, getProvider, wait } = createTestProviders({
      gemini: failing("gemini"),
      claude: failing("claude"),
    });

    const events = await collect(runRecipe({ recipe, request: REQUEST }, { getProvider, wait }));

    // O GPT assume o Chefe e faz o plano; o Revisor (Gemini) e a reserva dele (Claude) falham.
    expect(outline(events)).toEqual([
      "run-started",
      ...["step-started plan", "step-retrying plan", "step-retrying plan", "step-switched plan"],
      ...["step-text plan", "step-finished plan"],
      ...["step-started code", "step-text code", "step-finished code"],
      ...["step-started review", "step-retrying review", "step-retrying review", "step-switched review"],
      ...["step-retrying review", "step-retrying review", "run-failed review"],
    ]);
    expect(events.at(-1)).toEqual({
      type: "run-failed",
      stepId: "review",
      provider: "claude",
      retryable: true,
      errorMessage: MOCK_FAILURE("claude"),
    });
    expect(calls).toHaveLength(3 + 1 + 1 + 3 + 3);
    expect(waits).toEqual([1000, 2000, 1000, 2000, 1000, 2000]);
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
    expect(switches(events)).toEqual([["code", "gpt", "claude"]]);
    expect(events.at(-1)?.type).toBe("run-finished");
  });

  it("o texto da tentativa que falhou não entra na resposta da etapa", async () => {
    // O GPT escreve 3 pedaços e cai. Na 2ª tentativa, escreve o site inteiro.
    const { calls, getProvider, wait } = createTestProviders({ gpt: failing("gpt", 1, 3) });

    const events = await collect(runRecipe({ recipe, request: REQUEST }, { getProvider, wait }));

    const retry = events.findIndex((event) => event.type === "step-retrying");
    const codeText = (part: RunEvent[]) =>
      ofType(part, "step-text").filter((event) => event.stepId === "code");
    expect(codeText(events.slice(0, retry))).toHaveLength(3);
    expect(codeText(events.slice(retry)).map((event) => event.text).join("")).toBe(SAMPLE_FIRST_SITE);
    expect(finishedStep(events, "code")?.output).toBe(SAMPLE_FIRST_SITE);
    const reviewer = calls.find((call) => call.provider === "gemini");
    expect(reviewer?.request.input).toContain(
      `<parte nome="Site do programador">\n${SAMPLE_FIRST_SITE}\n</parte>`,
    );
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
      stepId: "code",
      provider: "gpt",
      attempt: 2,
      delayMs: 1000,
      errorMessage: "A IA parou de responder antes de terminar.",
    });
    expect(switches(events)).toEqual([["code", "gpt", "claude"]]);
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

    expect(outline(events).slice(-2)).toEqual(["step-started review", "run-failed review"]);
    expect(events.at(-1)).toEqual({
      type: "run-failed",
      stepId: "review",
      provider: "gemini",
      retryable: false,
      errorMessage: "Configuração do Gemini com defeito.",
    });
    expect(waits).toEqual([]);
  });

  it("o tempo da etapa conta as tentativas que falharam e as esperas", async () => {
    let clock = 0;
    const failsOnce = failing("gpt", 1);
    const slowGpt: AiProvider = {
      id: "gpt",
      async *generate(request) {
        clock += 5000; // cada tentativa leva 5 s
        yield* failsOnce.generate(request);
      },
    };
    const { getProvider } = createTestProviders({ gpt: slowGpt });
    const wait = async (ms: number) => {
      clock += ms;
    };

    const events = await collect(
      runRecipe({ recipe, request: REQUEST }, { getProvider, wait, now: () => clock }),
    );

    expect(finishedStep(events, "code")?.durationMs).toBe(5000 + 1000 + 5000);
  });

  it("espera de verdade antes de tentar de novo", async () => {
    vi.useFakeTimers();
    const { calls, getProvider } = createTestProviders({ gpt: failing("gpt", 1) });
    const gptCalls = () => calls.filter((call) => call.provider === "gpt").length;

    const done = collect(runRecipe({ recipe, request: REQUEST }, { getProvider }));

    await vi.advanceTimersByTimeAsync(999);
    expect(gptCalls()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(gptCalls()).toBe(2);
    expect((await done).at(-1)?.type).toBe("run-finished");
  });

  it("se o usuário cancela durante a espera, para na hora, sem tentar de novo", async () => {
    // Relógio parado: se a espera não parasse com o cancelamento, este teste nunca terminaria.
    vi.useFakeTimers();
    const { calls, getProvider } = createTestProviders({ gpt: failing("gpt") });
    const controller = new AbortController();
    const run = runRecipe({ recipe, request: REQUEST }, { getProvider, signal: controller.signal });
    while ((await run.next()).value?.type !== "step-retrying");

    const next = run.next(); // o motor começa a esperar 1 s
    await vi.advanceTimersByTimeAsync(500);
    controller.abort();

    expect((await next).value).toEqual({ type: "run-cancelled", stepId: "code" });
    expect(calls.filter((call) => call.provider === "gpt")).toHaveLength(1);
  });
});

describe("time da execução", () => {
  it("usa a IA sugerida pela receita em cada papel que o usuário não trocou", () => {
    expect(resolveTeam(recipe)).toEqual({ chief: "claude", programmer: "gpt", reviewer: "gemini" });
    expect(resolveTeam(recipe, { reviewer: "claude" })).toEqual({
      chief: "claude",
      programmer: "gpt",
      reviewer: "claude",
    });
  });
});

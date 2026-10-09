import { describe, expect, it } from "vitest";
import { createMockProvider, estimateTokens } from "@/lib/providers/mock";
import type { AiProvider, GenerateRequest, ProviderId } from "@/lib/providers/types";
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

/**
 * IAs simuladas que respondem na hora e anotam cada chamada, para o teste conferir o que cada uma recebeu.
 * `replacements` troca a IA de um identificador por outra (ex.: uma que falha).
 */
function createTestProviders(replacements: Partial<Record<ProviderId, AiProvider>> = {}) {
  const calls: { provider: ProviderId; request: GenerateRequest }[] = [];
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
  return { calls, getProvider };
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

  it("quando uma IA falha, avisa em qual etapa e para sem chamar as próximas", async () => {
    const { calls, getProvider } = createTestProviders({
      gpt: createMockProvider({ id: "gpt", chunkDelayMs: 0, failFirstCalls: Infinity }),
    });

    const events = await collect(runRecipe({ recipe, request: REQUEST }, { getProvider }));

    expect(events.at(-1)).toEqual({
      type: "run-failed",
      stepId: "code",
      provider: "gpt",
      retryable: true,
      errorMessage: "A IA simulada (gpt) falhou de propósito, para teste.",
    });
    expect(calls).toHaveLength(2);
    expect(ofType(events, "run-finished")).toEqual([]);
  });

  it("IA que para de responder sem avisar que terminou conta como falha", async () => {
    const stopsHalfway: AiProvider = {
      id: "gpt",
      async *generate() {
        yield { type: "text", text: "<!DOCTYPE html>" };
      },
    };
    const { getProvider } = createTestProviders({ gpt: stopsHalfway });

    const events = await collect(runRecipe({ recipe, request: REQUEST }, { getProvider }));

    expect(events.at(-1)).toEqual({
      type: "run-failed",
      stepId: "code",
      provider: "gpt",
      retryable: true,
      errorMessage: "A IA parou de responder antes de terminar.",
    });
  });

  it("erro ao preparar a IA (ex.: falta a chave) também vira falha da etapa", async () => {
    const { getProvider } = createTestProviders();
    const getProviderWithoutGemini = (id: ProviderId) => {
      if (id === "gemini") throw new Error("Falta a chave do Gemini.");
      return getProvider(id);
    };

    const events = await collect(
      runRecipe({ recipe, request: REQUEST }, { getProvider: getProviderWithoutGemini }),
    );

    expect(events.at(-1)).toEqual({
      type: "run-failed",
      stepId: "review",
      provider: "gemini",
      retryable: false,
      errorMessage: "Falta a chave do Gemini.",
    });
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

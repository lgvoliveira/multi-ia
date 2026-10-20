import { describe, expect, it } from "vitest";
import { createMockProvider } from "@/lib/providers/mock";
import type { AiProvider, GenerateRequest, ProviderId } from "@/lib/providers/types";
import { createSiteRecipe } from "@/lib/recipes/create-site";
import { SAMPLE_BRIEF, SAMPLE_FRONT, SAMPLE_REVIEW_APPROVED } from "@/lib/recipes/create-site.samples";
import type { Recipe } from "@/lib/recipes/types";
import { type RunOptions, runRecipe } from "./run";
import { initialSnapshot, runSegment } from "./segment";
import type { RunEvent, RunInput, RunSnapshot } from "./types";

const recipe = createSiteRecipe;
const REQUEST = "Quero um site para minha confeitaria, com cardápio e botão de WhatsApp.";

/**
 * Relógio fixo: o tempo de cada etapa e da execução vira 0 em qualquer modo, então o `durationMs` não
 * atrapalha a comparação evento por evento entre rodar tudo de uma vez e rodar segmento por segmento.
 */
const FIXED_NOW = () => 1000;

/**
 * IAs simuladas que respondem na hora e anotam cada chamada. `buildReplacements` monta as IAs trocadas
 * NA HORA (instâncias novas), para que dois modos de execução nunca compartilhem o contador de falhas.
 */
function makeProviders(buildReplacements: () => Partial<Record<ProviderId, AiProvider>> = () => ({})) {
  const replacements = buildReplacements();
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

/** IA simulada que falha sempre (para forçar a troca de IA no papel). */
function failing(id: ProviderId): AiProvider {
  return createMockProvider({ id, chunkDelayMs: 0, failFirstCalls: Infinity });
}

/** IA do chefe que reprova a 1ª revisão e aprova a 2ª; nas outras etapas, responde o exemplo de sempre. */
function reviewingChief(): AiProvider {
  let reviewCalls = 0;
  const mock = createMockProvider({ id: "claude", chunkDelayMs: 0 });
  return {
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
}

async function collect(events: AsyncIterable<RunEvent>): Promise<RunEvent[]> {
  const result: RunEvent[] = [];
  for await (const event of events) result.push(event);
  return result;
}

/** Roda um segmento até o fim, guardando os eventos e o snapshot que ele devolve. */
async function collectSegment(gen: AsyncGenerator<RunEvent, RunSnapshot>) {
  const events: RunEvent[] = [];
  let next = await gen.next();
  while (!next.done) {
    events.push(next.value);
    next = await gen.next();
  }
  return { events, snapshot: next.value };
}

/** Roda a execução inteira segmento por segmento, alimentando cada snapshot no próximo. */
async function runBySegments(input: RunInput, options: RunOptions) {
  const events: RunEvent[] = [];
  let snapshot = initialSnapshot(input);
  while (!snapshot.done) {
    const segment = await collectSegment(runSegment(snapshot, input.recipe, options));
    events.push(...segment.events);
    snapshot = segment.snapshot;
  }
  return { events, snapshot };
}

describe("executor por segmento", () => {
  it("rodar segmento por segmento dá a mesma narração que rodar tudo de uma vez (time padrão)", async () => {
    const whole = makeProviders();
    const wholeEvents = await collect(
      runRecipe({ recipe, request: REQUEST }, { getProvider: whole.getProvider, wait: whole.wait, now: FIXED_NOW }),
    );

    const bySeg = makeProviders();
    const { events: segEvents, snapshot } = await runBySegments(
      { recipe, request: REQUEST },
      { getProvider: bySeg.getProvider, wait: bySeg.wait, now: FIXED_NOW },
    );

    expect(segEvents).toEqual(wholeEvents);
    expect(snapshot.done).toBe(true);
    expect(snapshot.status).toBe("finished");
  });

  it("mesma narração quando uma IA falha e outra assume — provando que o time trocado persiste entre segmentos", async () => {
    // O Claude é o Chefe (brief → revisão → consolidação) e o Back-end. Falhando sempre, o GPT assume os dois papéis.
    const buildFail = () => ({ claude: failing("claude") });

    const whole = makeProviders(buildFail);
    const wholeEvents = await collect(
      runRecipe({ recipe, request: REQUEST }, { getProvider: whole.getProvider, wait: whole.wait, now: FIXED_NOW }),
    );

    const bySeg = makeProviders(buildFail);
    const { events: segEvents, snapshot } = await runBySegments(
      { recipe, request: REQUEST },
      { getProvider: bySeg.getProvider, wait: bySeg.wait, now: FIXED_NOW },
    );

    expect(segEvents).toEqual(wholeEvents);
    expect(snapshot.status).toBe("finished");

    // Houve troca de IA no plano do chefe (1º segmento).
    const switches = segEvents.filter((e) => e.type === "step-switched");
    expect(switches).toContainEqual(
      expect.objectContaining({ type: "step-switched", stepId: "brief", from: "claude", to: "gpt" }),
    );
    // A troca sobreviveu aos segmentos seguintes: a revisão e a consolidação (do chefe) já começam com o GPT.
    const startedWith = (stepId: string) =>
      segEvents.find((e) => e.type === "step-started" && e.stepId === stepId) as
        | Extract<RunEvent, { type: "step-started" }>
        | undefined;
    expect(startedWith("review")?.provider).toBe("gpt");
    expect(startedWith("consolidate")?.provider).toBe("gpt");
    // E o time guardado no snapshot final reflete a troca nos dois papéis que o Claude ocupava.
    expect(snapshot.team.chief).toBe("gpt");
    expect(snapshot.team.backend).toBe("gpt");
  });

  it("uma etapa de um segmento posterior enxerga a saída de um segmento anterior", async () => {
    const { calls, getProvider, wait } = makeProviders();
    const options: RunOptions = { getProvider, wait, now: FIXED_NOW };

    // 1º segmento: só o plano do chefe. A saída dele fica guardada no snapshot.
    let snapshot = (await collectSegment(runSegment(initialSnapshot({ recipe, request: REQUEST }), recipe, options)))
      .snapshot;
    expect(snapshot.cursor).toEqual({ stageIndex: 1, round: 1 });
    expect(snapshot.outputs.brief).toBeDefined();

    // Os demais segmentos rodam a partir do snapshot re-hidratado.
    while (!snapshot.done) {
      snapshot = (await collectSegment(runSegment(snapshot, recipe, options))).snapshot;
    }

    // O Front-end, que roda num segmento posterior, recebeu o plano do chefe do 1º segmento.
    const front = calls.find((call) => call.request.sampleResponse === SAMPLE_FRONT);
    expect(front?.request.input).toContain(SAMPLE_BRIEF);
  });

  it("uma revisão que reprova na 1ª rodada retoma o retrabalho no segmento seguinte", async () => {
    // A receita real usa 1 rodada; aqui forçamos 2 para o motor poder refazer a fase.
    const twoRounds: Recipe = {
      ...recipe,
      stages: recipe.stages.map((stage) => (stage.kind === "review" ? { ...stage, maxRounds: 2 } : stage)),
    };
    const reviewIndex = twoRounds.stages.findIndex((stage) => stage.kind === "review");
    const { getProvider, wait } = makeProviders(() => ({ claude: reviewingChief() }));
    const options: RunOptions = { getProvider, wait, now: FIXED_NOW };

    // Avança até o segmento da revisão: brief (0) e build (1) rodam inteiros.
    let snapshot = initialSnapshot({ recipe: twoRounds, request: REQUEST });
    snapshot = (await collectSegment(runSegment(snapshot, twoRounds, options))).snapshot; // brief
    snapshot = (await collectSegment(runSegment(snapshot, twoRounds, options))).snapshot; // build
    expect(snapshot.cursor).toEqual({ stageIndex: reviewIndex, round: 1 });

    // Segmento da revisão, rodada 1: o chefe reprova. O cursor fica na revisão, agora na rodada 2.
    const reviewRound1 = await collectSegment(runSegment(snapshot, twoRounds, options));
    snapshot = reviewRound1.snapshot;
    expect(reviewRound1.events).toContainEqual({ type: "review-result", stageId: "review", round: 1, approved: false });
    expect(snapshot.done).toBe(false);
    expect(snapshot.cursor).toEqual({ stageIndex: reviewIndex, round: 2 });

    // Próximo segmento: retoma o retrabalho — refaz a fase em paralelo na rodada 2 e revisa de novo (aprovado).
    const reviewRound2 = await collectSegment(runSegment(snapshot, twoRounds, options));
    const reworkStart = reviewRound2.events.filter(
      (e) => e.type === "stage-started" && e.stageId === "build" && e.round === 2,
    );
    expect(reworkStart).toHaveLength(1);
    expect(reviewRound2.events).toContainEqual({ type: "review-result", stageId: "review", round: 2, approved: true });
    // Aprovou na 2ª rodada: o cursor avança para a fase final.
    expect(reviewRound2.snapshot.cursor.stageIndex).toBe(reviewIndex + 1);
  });
});

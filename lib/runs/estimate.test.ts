import { describe, expect, it } from "vitest";
import { resolveTeam, runRecipe } from "@/lib/engine/run";
import type { AiCallReport } from "@/lib/engine/types";
import { MAX_REQUEST_CHARS } from "@/lib/engine/validate";
import { costInCents } from "@/lib/ock/pricing";
import { createMockProvider } from "@/lib/providers/mock";
import { getRecipe, RECIPES } from "@/lib/recipes/catalog";
import type { Recipe } from "@/lib/recipes/types";
import { estimateCents, stepCosts } from "./estimate";

const recipe = getRecipe("create-site")!;
const recommended = resolveTeam(recipe);

/** A receita com a revisão podendo mandar refazer até `maxRounds` vezes. */
function withRounds(maxRounds: number): Recipe {
  return {
    ...recipe,
    stages: recipe.stages.map((stage) => (stage.kind === "review" ? { ...stage, maxRounds } : stage)),
  };
}

const runsOf = (costs: ReturnType<typeof stepCosts>) =>
  Object.fromEntries(costs.map((cost) => [cost.stepId, cost.runs]));

describe("estimativa de custo (o máximo que o time pode gastar)", () => {
  it("conta cada etapa do Criar um site uma vez, com o máximo de cada IA", () => {
    const costs = stepCosts(recipe);
    expect(runsOf(costs)).toEqual({ brief: 1, front: 1, back: 1, research: 1, review: 1, consolidate: 1 });
    for (const cost of costs) {
      for (const cents of Object.values(cost.cents)) expect(cents).toBeGreaterThan(0);
    }
  });

  it("soma o máximo de cada etapa com a IA do time; trocar uma IA muda a estimativa", () => {
    const costs = stepCosts(recipe);
    const total = estimateCents(costs, recommended);
    const byHand = costs.reduce(
      (sum, cost) => sum + cost.runs * cost.cents[cost.provider ?? recommended[cost.roleId]],
      0,
    );
    expect(total).toBe(byHand);

    // O Gemini é a IA mais barata: no lugar do GPT no front-end, a estimativa cai.
    expect(estimateCents(costs, { ...recommended, frontend: "gemini" })).toBeLessThan(total);
  });

  it("a etapa com IA fixa (a revisão) conta com a IA dela, seja qual for a IA do papel", () => {
    const costs = stepCosts(recipe);
    const review = costs.find((cost) => cost.stepId === "review")!;
    expect(review.provider).toBe("claude");
    const withGptChief = estimateCents([review], { chief: "gpt" });
    expect(withGptChief).toBe(review.cents.claude);
  });

  it("papel sem IA no time conta com a IA mais cara, para nunca estimar a menos", () => {
    const [brief] = stepCosts(recipe);
    expect(estimateCents([brief], {})).toBe(Math.max(...Object.values(brief.cents)));
  });

  it("a partir do meio, conta só o que falta", () => {
    // Cursor na revisão (3ª fase): faltam a revisão e a montagem final.
    expect(runsOf(stepCosts(recipe, { stageIndex: 2, round: 1 }))).toEqual({ review: 1, consolidate: 1 });
    // Acabou: nada falta.
    expect(stepCosts(recipe, { stageIndex: recipe.stages.length, round: 1 })).toEqual([]);
  });

  it("com rodadas de revisão, conta a revisão em cada rodada e a fase refeita da 2ª em diante", () => {
    const threeRounds = withRounds(3);
    expect(runsOf(stepCosts(threeRounds))).toEqual({
      brief: 1,
      front: 3,
      back: 3,
      research: 3,
      review: 3,
      consolidate: 1,
    });
    // Na 2ª rodada da revisão: faltam as rodadas 2 e 3, cada uma com a fase refeita antes.
    expect(runsOf(stepCosts(threeRounds, { stageIndex: 2, round: 2 }))).toMatchObject({ front: 2, review: 2 });
    // Na última rodada: uma vez cada.
    expect(runsOf(stepCosts(threeRounds, { stageIndex: 2, round: 3 }))).toMatchObject({ front: 1, review: 1 });
  });

  it("com a IA simulada e o pedido mais longo possível, o gasto real fica abaixo da estimativa", async () => {
    for (const team of [recommended, { ...recommended, frontend: "gemini" as const, chief: "gpt" as const }]) {
      const calls: AiCallReport[] = [];
      const events = runRecipe(
        { recipe, request: "a".repeat(MAX_REQUEST_CHARS), team },
        {
          getProvider: (id) => createMockProvider({ id, chunkDelayMs: 0 }),
          onAiCall: (call) => calls.push(call),
        },
      );
      for await (const event of events) void event;

      const spent = calls.reduce(
        (sum, call) => sum + costInCents(call.provider, call.tier, call.usage),
        0,
      );
      expect(calls).toHaveLength(6);
      expect(spent).toBeLessThanOrEqual(estimateCents(stepCosts(recipe), team));
    }
  });

  it("em toda receita pronta, com a IA simulada e o pedido mais longo possível, o gasto fica abaixo da estimativa", async () => {
    for (const each of RECIPES) {
      const team = resolveTeam(each);
      const calls: AiCallReport[] = [];
      const events = runRecipe(
        { recipe: each, request: "a".repeat(MAX_REQUEST_CHARS), team },
        {
          getProvider: (id) => createMockProvider({ id, chunkDelayMs: 0 }),
          onAiCall: (call) => calls.push(call),
        },
      );
      for await (const event of events) void event;

      const spent = calls.reduce((sum, call) => sum + costInCents(call.provider, call.tier, call.usage), 0);
      expect(calls.length, each.id).toBeGreaterThan(0);
      expect(spent, each.id).toBeLessThanOrEqual(estimateCents(stepCosts(each), team));
    }
  });
});

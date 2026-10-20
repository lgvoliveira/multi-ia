import { describe, expect, it } from "vitest";
import { runRecipe } from "@/lib/engine/run";
import type { RunEvent } from "@/lib/engine/types";
import { createMockProvider } from "@/lib/providers/mock";
import type { ProviderId } from "@/lib/providers/types";
import { createSiteRecipe } from "@/lib/recipes/create-site";
import { SAMPLE_FINAL_SITE } from "@/lib/recipes/create-site.samples";
import { toPublicEvent, type PublicRunEvent } from "./public-events";

/** Campos que só existem para uso interno (histórico interno, custo, depuração). */
const INTERNAL_FIELDS = [
  "model",
  "usage",
  "inputTokens",
  "outputTokens",
  "truncated",
  "retryable",
  "errorMessage",
  "delayMs",
];

/** Narração de uma execução inteira, na versão do usuário. `failing` = IAs que falham sempre. */
async function publicNarration(failing: ProviderId[] = []): Promise<PublicRunEvent[]> {
  const events: PublicRunEvent[] = [];
  const run = runRecipe(
    { recipe: createSiteRecipe, request: "Quero um site para minha confeitaria." },
    {
      getProvider: (id) =>
        createMockProvider({ id, chunkDelayMs: 0, failFirstCalls: failing.includes(id) ? Infinity : 0 }),
      wait: async () => {},
    },
  );
  for await (const event of run) events.push(toPublicEvent(event));
  return events;
}

describe("narração para o usuário", () => {
  it("tira o modelo, os tokens e os detalhes técnicos de uma execução inteira", async () => {
    const json = JSON.stringify(await publicNarration());

    for (const field of INTERNAL_FIELDS) expect(json, field).not.toContain(`"${field}"`);
    expect(json).not.toContain("mock-"); // nome do modelo da IA simulada
  });

  it("das novas tentativas e da troca de IA, conta só o que a tela mostra, sem a mensagem técnica", async () => {
    const events = await publicNarration(["gpt"]);
    const json = JSON.stringify(events);

    // O Front-end (GPT) falha; o Claude (reserva do papel) assume.
    expect(events).toContainEqual({ type: "step-retrying", stepId: "front", attempt: 2 });
    expect(events).toContainEqual({
      type: "step-switched",
      stepId: "front",
      roleId: "frontend",
      from: "gpt",
      to: "claude",
    });
    for (const field of INTERNAL_FIELDS) expect(json, field).not.toContain(`"${field}"`);
    expect(json).not.toContain("falhou de propósito");
  });

  it("mantém o que a tela precisa: fases, IAs, texto, revisão e o resultado final", async () => {
    const events = await publicNarration();

    expect(events[0]).toEqual({
      type: "run-started",
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
        { stageId: "final", kind: "sequential", steps: [{ stepId: "consolidate", provider: "gpt" }] },
      ],
    });
    expect(events).toContainEqual({ type: "stage-started", stageId: "build", round: 1 });
    expect(events).toContainEqual({ type: "step-started", stepId: "front", provider: "gpt" });
    expect(events).toContainEqual({ type: "step-finished", stepId: "front", durationMs: expect.any(Number) });
    expect(events).toContainEqual({ type: "review-result", stageId: "review", round: 1, approved: true });
    expect(events.at(-1)).toEqual({
      type: "run-finished",
      result: SAMPLE_FINAL_SITE,
      durationMs: expect.any(Number),
    });
  });

  it("de uma falha, conta só em que etapa foi", () => {
    const failure: RunEvent = {
      type: "run-failed",
      stepId: "front",
      provider: "gpt",
      retryable: true,
      errorMessage: "529 Overloaded",
    };

    expect(toPublicEvent(failure)).toEqual({ type: "run-failed", stepId: "front" });
  });

  it("repassa a fase, o veredito da revisão e a rodada", () => {
    expect(toPublicEvent({ type: "stage-started", stageId: "build", round: 2 })).toEqual({
      type: "stage-started",
      stageId: "build",
      round: 2,
    });
    expect(toPublicEvent({ type: "review-result", stageId: "review", round: 1, approved: false })).toEqual({
      type: "review-result",
      stageId: "review",
      round: 1,
      approved: false,
    });
    // A rodada vai junto quando existe, e fica de fora na primeira rodada (implícita).
    expect(toPublicEvent({ type: "step-started", stepId: "front", provider: "gpt", round: 2 })).toEqual({
      type: "step-started",
      stepId: "front",
      provider: "gpt",
      round: 2,
    });
    expect(toPublicEvent({ type: "step-started", stepId: "front", provider: "gpt" })).toEqual({
      type: "step-started",
      stepId: "front",
      provider: "gpt",
    });
  });

  it("um campo interno novo no motor não vaza sem ninguém perceber", () => {
    const event = { type: "step-started", stepId: "brief", provider: "claude", model: "claude-x" } as RunEvent;

    expect(toPublicEvent(event)).toEqual({ type: "step-started", stepId: "brief", provider: "claude" });
  });
});

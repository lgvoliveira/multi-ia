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

    expect(events).toContainEqual({ type: "step-retrying", stepId: "code", attempt: 2 });
    expect(events).toContainEqual({
      type: "step-switched",
      stepId: "code",
      roleId: "programmer",
      from: "gpt",
      to: "claude",
    });
    for (const field of INTERNAL_FIELDS) expect(json, field).not.toContain(`"${field}"`);
    expect(json).not.toContain("falhou de propósito");
  });

  it("mantém o que a tela precisa: etapas, IAs, texto, tempo e o resultado final", async () => {
    const events = await publicNarration();

    expect(events[0]).toEqual({
      type: "run-started",
      steps: [
        { stepId: "plan", provider: "claude" },
        { stepId: "code", provider: "gpt" },
        { stepId: "review", provider: "gemini" },
        { stepId: "consolidate", provider: "claude" },
      ],
    });
    expect(events).toContainEqual({ type: "step-started", stepId: "code", provider: "gpt" });
    expect(events).toContainEqual({ type: "step-finished", stepId: "code", durationMs: expect.any(Number) });
    expect(events.at(-1)).toEqual({
      type: "run-finished",
      result: SAMPLE_FINAL_SITE,
      durationMs: expect.any(Number),
    });
  });

  it("de uma falha, conta só em que etapa foi", () => {
    const failure: RunEvent = {
      type: "run-failed",
      stepId: "code",
      provider: "gpt",
      retryable: true,
      errorMessage: "529 Overloaded",
    };

    expect(toPublicEvent(failure)).toEqual({ type: "run-failed", stepId: "code" });
  });

  it("um campo interno novo no motor não vaza sem ninguém perceber", () => {
    const event = { type: "step-started", stepId: "plan", provider: "claude", model: "claude-x" } as RunEvent;

    expect(toPublicEvent(event)).toEqual({ type: "step-started", stepId: "plan", provider: "claude" });
  });
});

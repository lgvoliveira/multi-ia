import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiCallReport, StepResult } from "@/lib/engine/types";
import { costInCents, costInUsd, USD_TO_BRL } from "@/lib/ock/pricing";
import { getRecipe } from "@/lib/recipes/catalog";
import type { StepCharge } from "./wallet";

// A carteira é um dublê em memória: conferimos o que é cobrado, em que ordem e quando nada é cobrado duas vezes.

const wallet = vi.hoisted(() => ({
  charges: [] as StepCharge[],
  /** Quantas linhas de gasto a execução já tinha antes. */
  alreadyCharged: 0,
  /** Depois de quantas cobranças a reserva aparece fechada (a pessoa cancelou). */
  closesAfter: Infinity,
}));

vi.mock("./wallet", () => ({
  countRunCharges: async () => wallet.alreadyCharged,
  chargeStep: async (_holdId: string, _runId: string, charge: StepCharge) => {
    if (wallet.charges.length >= wallet.closesAfter) return null;
    wallet.charges.push(charge);
    return 100;
  },
}));

import { aiCallRows, chargeCompletedSteps, chargeDescription, stepChargeCents } from "./billing";

const recipe = getRecipe("create-site")!;

function result(stepId: string, provider: StepResult["provider"], inputTokens: number, outputTokens: number): StepResult {
  return { stepId, provider, output: "…", model: `mock-${provider}`, usage: { inputTokens, outputTokens }, truncated: false, durationMs: 10 };
}

afterEach(() => {
  wallet.charges = [];
  wallet.alreadyCharged = 0;
  wallet.closesAfter = Infinity;
});

describe("a conta de uma execução", () => {
  it("cobra o consumo real de cada etapa, com no mínimo 1 centavo", () => {
    expect(stepChargeCents(result("brief", "claude", 2000, 1000))).toBe(costInCents("claude", "padrao", 2000, 1000));
    expect(stepChargeCents(result("research", "gemini", 1, 1))).toBe(1);
  });

  it("descreve o gasto pela receita e pela etapa, nunca pelo pedido", () => {
    expect(chargeDescription(recipe, "front")).toBe("Criar um site · Front-end");
    expect(chargeDescription(recipe, "review")).toBe("Criar um site · Revisão do chefe");
  });

  it("cobra, em ordem, só as etapas que ainda não viraram linha de gasto", async () => {
    const results = [result("brief", "claude", 900, 300), result("front", "gpt", 2000, 3000), result("back", "claude", 2000, 400)];
    wallet.alreadyCharged = 1;

    const charged = await chargeCompletedSteps("run-1", recipe, results, "hold-1");
    expect(charged.map((step) => step.stepId)).toEqual(["front", "back"]);
    expect(wallet.charges).toEqual([
      { amountCents: stepChargeCents(results[1]), description: "Criar um site · Front-end", provider: "gpt" },
      { amountCents: stepChargeCents(results[2]), description: "Criar um site · Back-end", provider: "claude" },
    ]);
  });

  it("se a reserva fechou no meio (a pessoa cancelou), para de cobrar", async () => {
    wallet.closesAfter = 1;
    const results = [result("front", "gpt", 2000, 3000), result("back", "claude", 2000, 400)];
    const charged = await chargeCompletedSteps("run-1", recipe, results, "hold-1");
    expect(charged.map((step) => step.stepId)).toEqual(["front"]);
  });

  it("registra cada chamada com o custo em dólar e o câmbio; só a chamada que deu certo de uma etapa cobrada é cobrada", () => {
    const call = (over: Partial<AiCallReport>): AiCallReport => ({
      stepId: "front",
      provider: "gpt",
      model: "mock-gpt",
      tier: "padrao",
      usage: { inputTokens: 1000, outputTokens: 500 },
      ok: true,
      attempt: 1,
      durationMs: 1234.4,
      ...over,
    });
    const rows = aiCallRows(
      { id: "run-1", company_id: "empresa-1", member_id: "pessoa-1" },
      [
        call({ ok: false, model: null, errorMessage: "caiu", attempt: 1 }),
        call({ attempt: 2 }),
        call({ stepId: "research", provider: "gemini", model: "mock-gemini", ok: true }),
      ],
      new Set(["front"]),
    );

    expect(rows[0]).toEqual({
      company_id: "empresa-1",
      member_id: "pessoa-1",
      run_id: "run-1",
      step_id: "front",
      attempt: 1,
      provider: "gpt",
      model: "desconhecido",
      tier: "padrao",
      input_tokens: 1000,
      output_tokens: 500,
      cost_usd: Number(costInUsd("gpt", "padrao", 1000, 500).toFixed(6)),
      usd_brl: USD_TO_BRL,
      charged: false,
      status: "error",
      error_message: "caiu",
      duration_ms: 1234,
    });
    expect(rows[1]).toMatchObject({ attempt: 2, status: "ok", charged: true, error_message: null });
    // Deu certo, mas a etapa não foi cobrada (ex.: a fase em paralelo foi cancelada): fica sem cobrança.
    expect(rows[2]).toMatchObject({ step_id: "research", status: "ok", charged: false });
  });
});

import { describe, expect, it } from "vitest";
import { outputTokenCap, THINKING_TOKENS } from "./limits";

describe("teto de saída de cada IA (resposta + pensamento)", () => {
  it("o Claude ganha 8 mil tokens de folga quando pensa; sem pensar, fica no limite da etapa", () => {
    expect(outputTokenCap("claude", 1200, "low")).toBe(1200);
    expect(outputTokenCap("claude", 1200, "medium")).toBe(9200);
    expect(outputTokenCap("claude", 1500, "high")).toBe(9500);
  });

  it("o GPT ganha o orçamento de pensamento e mais mil", () => {
    expect(outputTokenCap("gpt", 6000, "low")).toBe(7000);
    expect(outputTokenCap("gpt", 6000, "high")).toBe(6000 + THINKING_TOKENS.high + 1000);
  });

  it("o Gemini ganha o orçamento de pensamento", () => {
    expect(outputTokenCap("gemini", 1200, "low")).toBe(1200);
    expect(outputTokenCap("gemini", 1200, "medium")).toBe(3200);
  });
});

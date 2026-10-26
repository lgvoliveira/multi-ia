import { describe, expect, it } from "vitest";
import { maxInputTokens, outputTokenCap, THINKING_ROOM } from "./limits";

describe("teto de saída de cada IA (resposta + pensamento)", () => {
  it("toda IA ganha folga para pensar, até no esforço baixo (os modelos de hoje sempre pensam um pouco)", () => {
    for (const id of ["claude", "gpt", "gemini"] as const) {
      expect(outputTokenCap(id, 1200, "low")).toBe(1200 + THINKING_ROOM.low);
      expect(outputTokenCap(id, 1200, "medium")).toBe(1200 + THINKING_ROOM.medium);
      expect(outputTokenCap(id, 6000, "high")).toBe(6000 + THINKING_ROOM.high);
    }
  });

  it("mais esforço, mais folga", () => {
    expect(THINKING_ROOM.low).toBeLessThan(THINKING_ROOM.medium);
    expect(THINKING_ROOM.medium).toBeLessThan(THINKING_ROOM.high);
  });
});

describe("a entrada estimada", () => {
  it("conta 3 caracteres por token, a folga do português", () => {
    expect(maxInputTokens("a".repeat(3000))).toBe(1000);
    expect(maxInputTokens("abcd")).toBe(2);
  });
});

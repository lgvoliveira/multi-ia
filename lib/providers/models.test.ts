import { describe, expect, it } from "vitest";
import { PROVIDERS } from "./catalog";
import { MODELS, modelId, modelPrice } from "./models";
import type { ModelTier } from "./types";

const TIERS: ModelTier[] = ["economico", "padrao", "potente"];

describe("modelos e preços oficiais", () => {
  it("toda IA tem um modelo com nome fixo em cada nível (nunca um apelido que troca sozinho)", () => {
    for (const { id } of PROVIDERS) {
      for (const tier of TIERS) {
        expect(modelId(id, tier)).toMatch(/^[a-z0-9.-]+$/);
        expect(modelId(id, tier)).not.toMatch(/latest/);
      }
    }
  });

  it("os nomes conferidos nas páginas oficiais em 25/10/2026", () => {
    expect(TIERS.map((tier) => modelId("claude", tier))).toEqual([
      "claude-haiku-5-5",
      "claude-sonnet-5-5",
      "claude-opus-5-5",
    ]);
    expect(TIERS.map((tier) => modelId("gpt", tier))).toEqual(["gpt-6-luna", "gpt-6.1-sol", "gpt-6-astra"]);
    expect(TIERS.map((tier) => modelId("gemini", tier))).toEqual([
      "gemini-3.5-flash-lite",
      "gemini-3.8-flash",
      "gemini-4-argon",
    ]);
  });

  it("todo preço é positivo, a saída custa mais que a entrada e o cache nunca é mais barato que de graça", () => {
    for (const { id } of PROVIDERS) {
      for (const tier of TIERS) {
        for (const { price } of MODELS[id][tier].prices) {
          expect(price.input).toBeGreaterThan(0);
          expect(price.output).toBeGreaterThan(price.input);
          expect(price.cachedInput).toBeGreaterThan(0);
          expect(price.cachedInput).toBeLessThanOrEqual(price.input);
          expect(price.cacheWrite).toBeGreaterThanOrEqual(price.input);
        }
      }
    }
  });

  it("a pesquisa na internet tem preço nos modelos do Claude (é a IA que pesquisa)", () => {
    for (const tier of TIERS) expect(modelPrice("claude", tier).webSearch).toBe(0.01);
  });

  it("as datas de troca de preço vêm em ordem, e só a primeira não tem data", () => {
    for (const { id } of PROVIDERS) {
      for (const tier of TIERS) {
        const [first, ...rest] = MODELS[id][tier].prices;
        expect(first.from).toBeNull();
        const dates = rest.map((period) => Date.parse(period.from ?? ""));
        expect(dates.every((date) => Number.isFinite(date))).toBe(true);
        expect(dates).toEqual([...dates].sort((a, b) => a - b));
      }
    }
  });

  it("o preço que vale é o da última data que já chegou", () => {
    expect(modelPrice("gemini", "potente", new Date("2026-10-25T12:00:00Z")).input).toBe(2);
    expect(modelPrice("gemini", "potente", new Date("2026-12-01T00:00:00Z")).input).toBe(4);
    expect(modelPrice("gemini", "potente", new Date("2030-01-01T00:00:00Z")).input).toBe(4);
    expect(modelPrice("claude", "padrao", new Date("2030-01-01T00:00:00Z")).input).toBe(2);
  });
});

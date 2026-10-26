import { describe, expect, it } from "vitest";
import { costInCents, costInUsd, formatBRL, transcriptionCostInUsd, USD_TO_BRL } from "./pricing";

const million = (inputTokens: number, outputTokens: number) => ({ inputTokens, outputTokens });

describe("preço de cada uso", () => {
  it("o custo em dólar vem do preço oficial do modelo por milhão de tokens de entrada e de saída", () => {
    // Claude Sonnet 5.5: US$ 2 por milhão de entrada e US$ 10 por milhão de saída.
    expect(costInUsd("claude", "padrao", million(1_000_000, 0))).toBe(2);
    expect(costInUsd("claude", "padrao", million(0, 1_000_000))).toBe(10);
    // GPT-6 Astra: a saída custa US$ 50 (o código antigo usava 40 e cobraria menos do que a plataforma paga).
    expect(costInUsd("gpt", "potente", million(0, 1_000_000))).toBe(50);
  });

  it("a entrada que veio do cache sai mais barata, e a gravada no cache, mais cara (OpenAI)", () => {
    // GPT-6.1 Sol: entrada US$ 2, do cache US$ 0,10, gravada no cache US$ 2,50 por milhão.
    const usage = { inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: 400_000, cacheWriteTokens: 100_000 };
    expect(costInUsd("gpt", "padrao", usage)).toBeCloseTo(0.5 * 2 + 0.4 * 0.1 + 0.1 * 2.5, 10);
  });

  it("cada pesquisa na internet do Claude custa US$ 0,01, além dos tokens", () => {
    expect(costInUsd("claude", "padrao", { inputTokens: 0, outputTokens: 0, webSearchRequests: 3 })).toBeCloseTo(0.03, 10);
    expect(costInUsd("claude", "padrao", { inputTokens: 1_000_000, outputTokens: 0, webSearchRequests: 1 })).toBeCloseTo(2.01, 10);
  });

  it("transcrever a voz custa US$ 0,0045 por minuto de áudio", () => {
    expect(transcriptionCostInUsd(60)).toBeCloseTo(0.0045, 10);
    expect(transcriptionCostInUsd(30)).toBeCloseTo(0.00225, 10);
  });

  it("o preço muda sozinho na data anunciada pela empresa da IA", () => {
    // Gemini 4 Argon dobra em 01/12/2026; Gemini 3.8 Flash, em 01/01/2027 (meia-noite UTC).
    expect(costInUsd("gemini", "potente", million(1_000_000, 0), new Date("2026-11-30T23:59:59Z"))).toBe(2);
    expect(costInUsd("gemini", "potente", million(1_000_000, 0), new Date("2026-12-01T00:00:00Z"))).toBe(4);
    expect(costInUsd("gemini", "padrao", million(0, 1_000_000), new Date("2026-12-31T12:00:00Z"))).toBe(3.75);
    expect(costInUsd("gemini", "padrao", million(0, 1_000_000), new Date("2027-01-01T00:00:00Z"))).toBe(7.5);
  });

  it("em reais, é o custo em dólar no câmbio, sem margem por enquanto, arredondado para cima", () => {
    const usage = million(10_000, 2_000);
    expect(costInCents("gpt", "padrao", usage)).toBe(Math.ceil(costInUsd("gpt", "padrao", usage) * USD_TO_BRL * 100));
    // Um token já custa 1 centavo: fração de centavo sobe.
    expect(costInCents("gemini", "padrao", million(1, 0))).toBe(1);
  });

  it("um resto da conta com vírgula do computador não vira 1 centavo a mais", () => {
    // 100 mil tokens de entrada do Claude Opus: US$ 0,40 × 5,5 = R$ 2,20, exatos. A conta do computador dá
    // 220,00000000000003, que sem o cuidado viraria 221.
    expect(costInCents("claude", "potente", million(100_000, 0))).toBe(220);
  });

  it("mostra centavos como reais", () => {
    expect(formatBRL(531)).toBe("R$ 5,31");
  });
});

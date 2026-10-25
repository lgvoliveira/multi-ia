import { describe, expect, it } from "vitest";
import { costInCents, costInUsd, formatBRL, USD_TO_BRL } from "./pricing";

describe("preço de cada uso", () => {
  it("o custo em dólar vem do preço por milhão de tokens de entrada e de saída", () => {
    // Claude padrão: US$ 3 por milhão de entrada e US$ 15 por milhão de saída.
    expect(costInUsd("claude", "padrao", 1_000_000, 0)).toBe(3);
    expect(costInUsd("claude", "padrao", 0, 1_000_000)).toBe(15);
  });

  it("em reais, é o custo em dólar no câmbio, sem margem por enquanto, arredondado para cima", () => {
    const cents = costInCents("gpt", "padrao", 10_000, 2_000);
    expect(cents).toBe(Math.ceil(costInUsd("gpt", "padrao", 10_000, 2_000) * USD_TO_BRL * 100));
    // Um token já custa 1 centavo: fração de centavo sobe.
    expect(costInCents("gemini", "padrao", 1, 0)).toBe(1);
  });

  it("um resto da conta com vírgula do computador não vira 1 centavo a mais", () => {
    // 100 mil tokens de entrada do Claude padrão: US$ 0,30 × 5,5 = R$ 1,65, exatos. A conta do computador dá
    // 165,00000000000003, que sem o cuidado viraria 166.
    expect(costInCents("claude", "padrao", 100_000, 0)).toBe(165);
  });

  it("mostra centavos como reais", () => {
    expect(formatBRL(531)).toBe("R$ 5,31");
  });
});

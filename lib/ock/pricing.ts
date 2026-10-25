// Preço de cada IA e o cálculo do custo de uma tarefa em reais.
// É o que a OCK usa para MEDIR quanto cada tarefa gastou e descontar da carteira da empresa.
// Os valores ficam todos aqui: é o único lugar a ajustar quando um preço mudar.

import type { ModelTier, ProviderId } from "@/lib/providers/types";

/**
 * Preço por MILHÃO de tokens, em dólar (entrada / saída), por IA e por NÍVEL de modelo.
 * O NÍVEL é a maior alavanca de custo (econômico ≪ padrão ≪ potente) e é onde o Chefe otimiza.
 * Valores aproximados das tabelas públicas — ajustar AQUI quando um preço mudar.
 */
const PRICE_USD: Record<ProviderId, Record<ModelTier, { input: number; output: number }>> = {
  claude: {
    economico: { input: 0.8, output: 4 }, // Haiku
    padrao: { input: 3, output: 15 }, // Sonnet
    potente: { input: 15, output: 75 }, // Opus
  },
  gpt: {
    economico: { input: 0.4, output: 1.6 }, // Luna/mini
    padrao: { input: 2.5, output: 10 }, // Sol
    potente: { input: 10, output: 40 }, // Astra
  },
  gemini: {
    economico: { input: 0.3, output: 1.2 }, // Flash
    padrao: { input: 0.3, output: 1.2 }, // Flash
    potente: { input: 1.25, output: 5 }, // Pro
  },
};

/** O nível mais caro de todos (Claude Opus). Base da "economia": e se tudo rodasse no mais potente? */
const PREMIUM: { provider: ProviderId; tier: ModelTier } = { provider: "claude", tier: "potente" };

/**
 * Câmbio usado para cobrar em reais. Fixo por enquanto (F17); depois vira cotação ao vivo.
 * Cada chamada de IA guarda o câmbio usado (tabela interna ai_calls), para a conta fechar depois.
 */
export const USD_TO_BRL = 5.5;

/**
 * Margem da OCK sobre o custo das IAs, em cada uso (0,2 = 20%). Zero por enquanto: o formato do preço segue em aberto
 * (F04, decisão do Luis de 25/10/2026). É o único lugar a mudar quando ela for decidida.
 */
const USAGE_MARGIN = 0;

/** Nome amigável de cada IA, para a tela. */
export const PROVIDER_LABEL: Record<ProviderId, string> = {
  claude: "Claude",
  gpt: "GPT",
  gemini: "Gemini",
};

/** Quanto a empresa da IA cobra da OCK, em DÓLAR, pelos tokens consumidos. Só interno (tabela ai_calls). */
export function costInUsd(
  provider: ProviderId,
  tier: ModelTier,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = PRICE_USD[provider][tier];
  return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
}

/**
 * Custo de uma tarefa em CENTAVOS de real, a partir da IA, do nível e dos tokens consumidos: o custo em dólar, no
 * câmbio do dia, mais a margem, arredondado para cima (fração de centavo vira 1 centavo).
 */
export function costInCents(
  provider: ProviderId,
  tier: ModelTier,
  inputTokens: number,
  outputTokens: number,
): number {
  const cents = costInUsd(provider, tier, inputTokens, outputTokens) * USD_TO_BRL * (1 + USAGE_MARGIN) * 100;
  // Arredonda antes de subir: 12,000000001 (resto da conta com vírgula do computador) é 12, e não 13.
  return Math.ceil(Number(cents.toFixed(6)));
}

/**
 * Quanto a MESMA quantidade de tokens custaria no modelo mais potente (Claude Opus).
 * A diferença entre isto e o custo real é a ECONOMIA que o Chefe gerou escolhendo IAs/níveis mais baratos.
 */
export function premiumCostInCents(inputTokens: number, outputTokens: number): number {
  return costInCents(PREMIUM.provider, PREMIUM.tier, inputTokens, outputTokens);
}

/** Mostra centavos de real como texto: 1234 → "R$ 12,34". */
export function formatBRL(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Para o funcionário, mostramos o uso em TOKENS (não em reais). Como o preço do token varia por IA,
// a conversão de um teto em reais para "tokens equivalentes" é uma ESTIMATIVA (média das IAs do projeto).
const REAL_PER_MILLION_TOKENS = 23;

/** Quantos tokens, aproximadamente, cabem num valor em centavos de real. */
export function tokensForCents(cents: number): number {
  return Math.round((cents / 100 / REAL_PER_MILLION_TOKENS) * 1_000_000);
}

/** Mostra uma quantidade de tokens de forma legível: 4300000 → "4,3 mi"; 12000 → "12 mil". */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (n >= 1_000) return `${Math.round(n / 1_000).toLocaleString("pt-BR")} mil`;
  return n.toLocaleString("pt-BR");
}

/**
 * Taxa da OCK na ENTRADA do crédito, em escala regressiva: quanto mais a empresa coloca, menor a taxa.
 * Cobrada uma vez, quando o dinheiro entra; o que vira crédito depois não é taxado de novo.
 */
export function depositFeeRate(amountCents: number): number {
  const reais = amountCents / 100;
  if (reais <= 800) return 0.1; // até R$800 → 10%
  if (reais <= 1500) return 0.07; // até R$1.500 → 7%
  if (reais <= 3000) return 0.05; // até R$3.000 → 5%
  return 0.03; // acima → 3%
}

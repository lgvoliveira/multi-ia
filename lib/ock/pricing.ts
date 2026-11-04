// O cálculo do custo de cada uso em reais, a partir do preço oficial de cada modelo (lib/providers/models.ts).
// É o que a OCK usa para MEDIR quanto cada tarefa gastou e descontar da carteira da empresa.

import type { ImageUsage } from "@/lib/providers/images";
import { IMAGE_MODEL, modelPrice, TRANSCRIBE_MODEL } from "@/lib/providers/models";
import type { ModelTier, ProviderId, Usage } from "@/lib/providers/types";

/** O nível mais caro de todos (Claude Opus). Base da "economia": e se tudo rodasse no mais potente? */
const PREMIUM: { provider: ProviderId; tier: ModelTier } = { provider: "claude", tier: "potente" };

/**
 * Câmbio usado para cobrar em reais. Fixo por enquanto (F17, decisão do Luis de 25/10/2026); depois vira cotação ao vivo.
 * Cada chamada de IA guarda o câmbio usado (tabela interna ai_calls), para a conta fechar depois.
 * Atenção (26/10/2026, a decidir com o Luis): o dólar comercial estava em R$ 5,22 (28/09), mas a plataforma paga as IAs
 * com cartão brasileiro, que soma o IOF de 3,5% e a margem do banco: cada dólar sai por uns R$ 5,6 a 5,7.
 */
export const USD_TO_BRL = 5.5;

/**
 * Margem da OCK sobre o custo das IAs, em cada uso (0,2 = 20%). Zero por enquanto: o formato do preço segue em aberto
 * (F04, decisão do Luis de 25/10/2026). É o único lugar a mudar quando ela for decidida.
 */
const USAGE_MARGIN = 0;

/**
 * Quanto a empresa da IA cobra da OCK, em DÓLAR, por um consumo, no preço que vale em `at` (agora, se não vier). A
 * entrada que veio do cache e a que foi gravada nele têm preços próprios, e cada pesquisa na internet é cobrada à parte.
 * Só interno (tabela ai_calls).
 */
export function costInUsd(provider: ProviderId, tier: ModelTier, usage: Usage, at?: Date): number {
  const price = modelPrice(provider, tier, at);
  const cached = usage.cachedInputTokens ?? 0;
  const written = usage.cacheWriteTokens ?? 0;
  const plainInput = Math.max(0, usage.inputTokens - cached - written);
  const microDollars =
    plainInput * price.input + cached * price.cachedInput + written * price.cacheWrite + usage.outputTokens * price.output;
  return microDollars / 1_000_000 + (usage.webSearchRequests ?? 0) * (price.webSearch ?? 0);
}

/** Quanto uma imagem criada custa, em DÓLAR: o texto do pedido, as imagens de referência e a imagem criada. */
export function imageCostInUsd(usage: ImageUsage): number {
  const price = IMAGE_MODEL.prices;
  const microDollars =
    usage.textInputTokens * price.textInput + usage.imageInputTokens * price.imageInput + usage.outputTokens * price.output;
  return microDollars / 1_000_000;
}

/** Quanto transcrever `seconds` segundos de voz custa, em DÓLAR (a OpenAI cobra por minuto de áudio). */
export function transcriptionCostInUsd(seconds: number): number {
  return (seconds / 60) * TRANSCRIBE_MODEL.usdPerMinute;
}

/**
 * Custo de um consumo em CENTAVOS de real: o custo em dólar, no câmbio do dia, mais a margem, arredondado para cima
 * (fração de centavo vira 1 centavo).
 */
export function costInCents(provider: ProviderId, tier: ModelTier, usage: Usage, at?: Date): number {
  return usdToCents(costInUsd(provider, tier, usage, at));
}

/** Um custo em dólar em CENTAVOS de real: no câmbio do dia, mais a margem, arredondado para cima. */
export function usdToCents(usd: number): number {
  const cents = usd * USD_TO_BRL * (1 + USAGE_MARGIN) * 100;
  // Arredonda antes de subir: 12,000000001 (resto da conta com vírgula do computador) é 12, e não 13.
  return Math.ceil(Number(cents.toFixed(6)));
}

/**
 * Quanto o MESMO consumo custaria no modelo mais potente (Claude Opus).
 * A diferença entre isto e o custo real é a ECONOMIA que o Chefe gerou escolhendo IAs/níveis mais baratos.
 */
export function premiumCostInCents(usage: Usage): number {
  return costInCents(PREMIUM.provider, PREMIUM.tier, usage);
}

/** Mostra centavos de real como texto: 1234 → "R$ 12,34". */
export function formatBRL(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Os mesmos centavos vistos como CRÉDITOS da empresa: 1 crédito = R$ 1,00 (o crédito é o real que entrou na carteira,
 * já descontada a taxa de entrada). 1234 → "12,34 créditos". Decisão de 04/11/2026, a confirmar com o Leandro/Luis.
 */
export function formatCredits(cents: number): string {
  const value = (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${value} ${cents === 100 ? "crédito" : "créditos"}`;
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

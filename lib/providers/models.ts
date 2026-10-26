// Os modelos de verdade de cada IA, por nível, e o preço oficial de cada um. É o ÚNICO lugar a mudar quando uma
// empresa trocar o nome de um modelo ou o preço: o conector (real.ts) pede o modelo daqui, e a conta do custo
// (lib/ock/pricing.ts) usa o preço daqui, então os dois nunca ficam desencontrados. Só dados: pode ir para a tela.
//
// Conferido nas páginas oficiais em 25/10/2026 (F17): Anthropic (referência da API), OpenAI
// (developers.openai.com/api/docs/pricing e a página de cada modelo) e Google (ai.google.dev/gemini-api/docs/pricing).
// Os nomes são sempre os fixos, nunca apelidos como "gemini-flash-latest", que trocam de modelo (e de preço) sozinhos.
//
// Preços em dólar por MILHÃO de tokens. Ficaram de fora as faixas de pedido gigante (Claude Haiku acima de 100 mil
// tokens de entrada, GPT acima de 272 mil), porque nenhum pedido da plataforma chega perto: o pedido tem até 4.000
// caracteres e os anexos do chat, até 30.000.

import type { ModelTier, ProviderId } from "./types";

/** O preço de um modelo, em dólar por milhão de tokens. */
export interface ModelPrice {
  /** Entrada comum. */
  input: number;
  /** Saída, contando o "pensamento". */
  output: number;
  /** Entrada que a empresa da IA já tinha guardada (cache): sai mais barata. */
  cachedInput: number;
  /** Entrada que a empresa da IA guarda no cache nesta chamada. Na OpenAI, custa 1,25 vez a entrada comum. */
  cacheWrite: number;
}

/** Um preço e a partir de quando ele vale (data e hora em UTC). O primeiro de cada modelo não tem data. */
export interface PricePeriod {
  from: string | null;
  price: ModelPrice;
}

export interface ModelInfo {
  /** O nome do modelo na API da empresa. */
  id: string;
  /** Do mais antigo para o mais novo. */
  prices: readonly PricePeriod[];
}

/** Um preço que não muda com a data. Sem cache informado, a entrada guardada custa o mesmo que a comum. */
function fixed(input: number, output: number, cache: Partial<ModelPrice> = {}): PricePeriod[] {
  return [{ from: null, price: { input, output, cachedInput: input, cacheWrite: input, ...cache } }];
}

export const MODELS: Record<ProviderId, Record<ModelTier, ModelInfo>> = {
  // Não usamos o cache do Claude (ele só guarda quando o pedido manda); os valores ficam para o caso de vir no consumo.
  claude: {
    economico: { id: "claude-haiku-5-5", prices: fixed(0.1, 0.5, { cachedInput: 0.01, cacheWrite: 0.125 }) },
    padrao: { id: "claude-sonnet-5-5", prices: fixed(2, 10, { cachedInput: 0.2, cacheWrite: 2.5 }) },
    potente: { id: "claude-opus-5-5", prices: fixed(4, 20, { cachedInput: 0.2, cacheWrite: 5 }) },
  },
  // A OpenAI guarda pedidos longos no cache sozinha: gravar custa 1,25 vez a entrada, e ler sai bem mais barato.
  gpt: {
    economico: { id: "gpt-6-luna", prices: fixed(0.1, 0.5, { cachedInput: 0.01, cacheWrite: 0.125 }) },
    padrao: { id: "gpt-6.1-sol", prices: fixed(2, 10, { cachedInput: 0.1, cacheWrite: 2.5 }) },
    potente: { id: "gpt-6-astra", prices: fixed(10, 50, { cachedInput: 1, cacheWrite: 12.5 }) },
  },
  // O Google também guarda sozinho e cobra a leitura mais barata; gravar não custa a mais. Dois modelos dobram de preço
  // em datas já anunciadas: a conta troca sozinha (meia-noite UTC, umas horas antes da Califórnia, para nunca cobrar
  // a menos).
  gemini: {
    economico: { id: "gemini-3.5-flash-lite", prices: fixed(0.3, 2.5, { cachedInput: 0.03 }) },
    padrao: {
      id: "gemini-3.8-flash",
      prices: [
        { from: null, price: { input: 0.75, output: 3.75, cachedInput: 0.075, cacheWrite: 0.75 } },
        { from: "2027-01-01T00:00:00Z", price: { input: 1.5, output: 7.5, cachedInput: 0.15, cacheWrite: 1.5 } },
      ],
    },
    potente: {
      id: "gemini-4-argon",
      prices: [
        { from: null, price: { input: 2, output: 10, cachedInput: 0.1, cacheWrite: 2 } },
        { from: "2026-12-01T00:00:00Z", price: { input: 4, output: 20, cachedInput: 0.2, cacheWrite: 4 } },
      ],
    },
  },
};

/** O nome do modelo na API da empresa. */
export function modelId(provider: ProviderId, tier: ModelTier): string {
  return MODELS[provider][tier].id;
}

/** O preço que vale no momento `at` (agora, se não vier). */
export function modelPrice(provider: ProviderId, tier: ModelTier, at: Date = new Date()): ModelPrice {
  const periods = MODELS[provider][tier].prices;
  let current = periods[0].price;
  for (const period of periods) {
    if (period.from === null || Date.parse(period.from) <= at.getTime()) current = period.price;
  }
  return current;
}

// Quanto cada IA pode escrever numa chamada, contando o "pensamento". É o mesmo teto que os conectores reais mandam
// para a API de cada empresa (real.ts) e a base da estimativa de custo (lib/runs/estimate.ts e a reserva do chat):
// mudou aqui, muda nos dois lugares, e a estimativa continua sendo o máximo que a IA consegue gastar.

import type { AiTool, Effort, ProviderId } from "./types";

/**
 * Folga para o pensamento, em tokens, além do limite da resposta, por esforço. Nos modelos de hoje, as três IAs pensam
 * até no esforço baixo (o Claude Opus 5.5 nem deixa desligar), e o pensamento gasta do mesmo teto que a resposta: sem
 * folga, a IA pode gastar o teto pensando e devolver a resposta cortada ou vazia (que é cobrada mesmo assim).
 * Decisão provisória do Claude (25/10/2026): rever com o consumo de verdade das primeiras execuções.
 */
export const THINKING_ROOM: Record<Effort, number> = { low: 2000, medium: 8000, high: 16000 };

/**
 * Quantos caracteres de texto contam como 1 token na hora de estimar a entrada. O consumo de verdade vem da empresa da
 * IA (F40); para estimar o máximo antes, o texto em português gasta mais tokens por letra que o inglês (uns 3 a 4
 * caracteres por token, contra 4 ou mais), então a conta usa 3.
 */
export const ESTIMATE_CHARS_PER_TOKEN = 3;

/** No máximo quantas pesquisas na internet a IA faz numa chamada (cada uma é cobrada à parte). */
export const MAX_WEB_SEARCHES = 3;

/**
 * Quanto cada ferramenta pode somar à entrada, em tokens, para estimar o máximo: o que a pesquisa traz das páginas (por
 * pesquisa) e o código e os resultados que a IA relê quando roda um programa. Não há teto exato (a empresa da IA não
 * deixa limitar); se passar, a mensagem é cobrada pelo que a IA informou (F29). Rever com o consumo de verdade.
 */
export const TOOL_INPUT_TOKENS: Record<AiTool, number> = { web_search: 40_000, code_execution: 20_000 };

/** O máximo que as ferramentas de um pedido somam à entrada, em tokens. */
export function toolInputTokens(tools: readonly AiTool[] = []): number {
  return tools.reduce((total, tool) => total + (tool === "web_search" ? MAX_WEB_SEARCHES : 1) * TOOL_INPUT_TOKENS[tool], 0);
}

/** A entrada que um texto pode gastar, em tokens, para estimar o máximo. */
export function maxInputTokens(text: string): number {
  return Math.ceil(text.length / ESTIMATE_CHARS_PER_TOKEN);
}

/**
 * O teto de tokens de saída (resposta + pensamento) que a IA recebe para uma etapa com este limite de resposta e este
 * esforço. A empresa da IA cobra no máximo isso de saída. Hoje é igual para as três IAs; o `id` fica para quando uma
 * delas precisar de outra folga.
 */
export function outputTokenCap(id: ProviderId, maxOutputTokens: number, effort: Effort): number {
  void id;
  return maxOutputTokens + THINKING_ROOM[effort];
}

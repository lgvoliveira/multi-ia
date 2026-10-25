// Quanto cada IA pode escrever numa chamada, contando o "pensamento". É o mesmo teto que os conectores reais mandam
// para a API de cada empresa (real.ts) e a base da estimativa de custo (lib/runs/estimate.ts): mudou aqui, muda nos
// dois lugares, e a estimativa continua sendo o máximo que a IA consegue gastar.

import type { Effort, ProviderId } from "./types";

/** Orçamento de "pensamento" (em tokens) por esforço. Usado pelo Claude e pelo Gemini; "low" = sem pensar. */
export const THINKING_TOKENS: Record<Effort, number> = { low: 0, medium: 2000, high: 6000 };

/** Folga para o pensamento do Claude caber junto com a resposta quando o esforço é médio ou alto. */
const CLAUDE_THINKING_ROOM = 8000;

/** Folga a mais do GPT: o raciocínio dele também gasta do mesmo limite. */
const GPT_EXTRA_ROOM = 1000;

/**
 * O teto de tokens de saída (resposta + pensamento) que a IA recebe para uma etapa com este limite de resposta e este
 * esforço. A empresa da IA cobra no máximo isso de saída.
 */
export function outputTokenCap(id: ProviderId, maxOutputTokens: number, effort: Effort): number {
  switch (id) {
    case "claude":
      return effort === "low" ? maxOutputTokens : maxOutputTokens + CLAUDE_THINKING_ROOM;
    case "gpt":
      return maxOutputTokens + THINKING_TOKENS[effort] + GPT_EXTRA_ROOM;
    case "gemini":
      return maxOutputTokens + THINKING_TOKENS[effort];
  }
}

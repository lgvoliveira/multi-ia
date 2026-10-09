// Confere o pedido de execução que chega pela internet. De fora pode vir qualquer coisa
// (alguém pode adulterar o que o navegador manda), então nada passa sem conferir tipo e tamanho.
// Só o servidor usa este arquivo: ele lê as receitas completas, com as instruções das IAs.

import type { RunInput, TeamChoice } from "@/lib/engine/types";
import { findRunProblems } from "@/lib/engine/validate";
import type { ProviderId } from "@/lib/providers/types";
import { getRecipe } from "@/lib/recipes/catalog";

/** O que o navegador manda para começar uma execução. */
export interface RunRequestBody {
  recipeId: string;
  request: string;
  /** IA escolhida para cada papel (id do papel → IA). */
  team?: Record<string, ProviderId>;
}

/** O que o servidor responde quando recusa o pedido. */
export interface RunRefusalBody {
  problems: string[];
}

export type ParsedRunRequest = { ok: true; input: RunInput } | { ok: false; problems: string[] };

/** Transforma o que chegou num pedido pronto para o motor ou na lista de problemas, em português. */
export function parseRunRequest(body: unknown): ParsedRunRequest {
  if (!isPlainObject(body)) return refuse("Não entendemos o pedido enviado.");

  // Receita "Em breve" também não existe aqui: só as prontas rodam.
  const recipe = typeof body.recipeId === "string" ? getRecipe(body.recipeId) : undefined;
  if (!recipe) return refuse("Receita não encontrada.");
  if (typeof body.request !== "string") return refuse("Escreva o que você quer que o time faça.");
  if (body.team !== undefined && !isPlainObject(body.team)) {
    return refuse("O time enviado não é válido.");
  }

  // Cada papel e cada IA do time são conferidos em findRunProblems, junto com o tamanho do pedido.
  const input: RunInput = { recipe, request: body.request, team: body.team as TeamChoice | undefined };
  const problems = findRunProblems(input);
  return problems.length > 0 ? { ok: false, problems } : { ok: true, input };
}

function refuse(problem: string): ParsedRunRequest {
  return { ok: false, problems: [problem] };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

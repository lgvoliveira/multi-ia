// Confere o pedido de execução antes de chamar qualquer IA. O servidor confere sempre,
// mesmo que a tela já tenha conferido: nunca se confia só no que vem do navegador.

import { isProviderId } from "@/lib/providers/catalog";
import { findRecipeProblems } from "@/lib/recipes/validate";
import type { RunInput } from "./types";

/** Tamanho máximo do pedido no MVP. A tela mostra um contador com este limite. */
export const MAX_REQUEST_CHARS = 4000;

/** Devolve a lista de problemas da execução. Lista vazia = pode começar. */
export function findRunProblems(input: RunInput): string[] {
  const { recipe } = input;
  // Receita com defeito não deveria chegar aqui (os testes barram), mas o motor não roda uma.
  const problems = findRecipeProblems(recipe);

  const request = input.request.trim();
  if (!request) problems.push("Escreva o que você quer que o time faça.");
  if (request.length > MAX_REQUEST_CHARS) {
    problems.push(
      `O pedido passou do limite de ${formatNumber(MAX_REQUEST_CHARS)} caracteres ` +
        `(tem ${formatNumber(request.length)}).`,
    );
  }

  for (const [roleId, providerId] of Object.entries(input.team ?? {})) {
    if (providerId === undefined) continue;
    if (!recipe.roles.some((role) => role.id === roleId)) {
      problems.push(`A receita não tem o papel "${roleId}".`);
    } else if (!isProviderId(providerId)) {
      problems.push(`IA desconhecida para o papel "${roleId}": "${providerId}".`);
    }
  }

  return problems;
}

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

// Motor de orquestração: roda as etapas de uma receita, em ordem, e narra cada passo.
// Não conhece telas nem IAs específicas: recebe as IAs prontas (getProvider) e devolve eventos.

import { ProviderError, type AiProvider, type ProviderId, type Usage } from "@/lib/providers/types";
import type { Recipe, Role, Step } from "@/lib/recipes/types";
import { buildStepInput, buildSystemPrompt } from "./input";
import type { RunEvent, RunInput, StepResult, TeamChoice } from "./types";
import { findRunProblems } from "./validate";

export interface RunOptions {
  /** Entrega a IA de cada identificador. No servidor, é o getProvider de lib/providers/registry. */
  getProvider: (id: ProviderId) => AiProvider;
  /** Permite cancelar a execução no meio (ex.: o usuário fechou a página). */
  signal?: AbortSignal;
  /** Relógio, em milissegundos. Os testes trocam por um relógio falso. */
  now?: () => number;
}

/** O que uma etapa precisa para rodar. */
interface StepContext {
  step: Step;
  role: Role;
  provider: AiProvider;
  request: string;
  outputs: ReadonlyMap<string, string>;
  signal?: AbortSignal;
  now: () => number;
}

/**
 * Roda a receita e devolve a narração, evento por evento, enquanto as IAs trabalham.
 * Pedido inválido não começa: dá erro na hora, antes de chamar qualquer IA.
 * Quem recebe o pedido do usuário deve conferir antes com findRunProblems, para mostrar os problemas.
 */
export function runRecipe(input: RunInput, options: RunOptions): AsyncGenerator<RunEvent> {
  const problems = findRunProblems(input);
  if (problems.length > 0) throw new Error(`Execução inválida: ${problems.join(" ")}`);
  return runSteps(input, options);
}

/** IA de cada papel: a escolhida pelo usuário ou, se ele não escolheu, a sugerida pela receita. */
export function resolveTeam(recipe: Recipe, choice: TeamChoice = {}): Record<string, ProviderId> {
  return Object.fromEntries(
    recipe.roles.map((role) => [role.id, choice[role.id] ?? role.suggestedProvider]),
  );
}

async function* runSteps(input: RunInput, options: RunOptions): AsyncGenerator<RunEvent> {
  const { recipe } = input;
  const { signal } = options;
  const now = options.now ?? Date.now;
  const team = resolveTeam(recipe, input.team);
  const request = input.request.trim();
  const outputs = new Map<string, string>();
  const results: StepResult[] = [];
  const runStartedAt = now();

  yield {
    type: "run-started",
    recipeId: recipe.id,
    steps: recipe.steps.map((step) => ({ stepId: step.id, provider: team[step.roleId] })),
  };

  for (const step of recipe.steps) {
    if (signal?.aborted) {
      yield { type: "run-cancelled", stepId: step.id };
      return;
    }

    const role = findRole(recipe, step.roleId);
    const providerId = team[step.roleId];
    yield { type: "step-started", stepId: step.id, provider: providerId };

    let result: StepResult;
    try {
      // Pegar a IA fica aqui dentro: se der erro (ex.: falta a chave), vira falha da etapa.
      const provider = options.getProvider(providerId);
      result = yield* runStep({ step, role, provider, request, outputs, signal, now });
    } catch (error) {
      // Se foi o usuário quem cancelou, o erro é só a IA parando de escrever: não é falha.
      if (signal?.aborted) {
        yield { type: "run-cancelled", stepId: step.id };
      } else {
        yield { type: "run-failed", stepId: step.id, provider: providerId, ...describeError(error) };
      }
      return;
    }

    outputs.set(step.id, result.output);
    results.push(result);
    yield { type: "step-finished", ...result };
  }

  yield {
    type: "run-finished",
    result: results[results.length - 1].output,
    steps: results,
    usage: sumUsage(results),
    durationMs: now() - runStartedAt,
  };
}

/** Roda uma etapa: repassa cada pedaço que a IA escreve e, no fim, devolve o resultado da etapa. */
async function* runStep(context: StepContext): AsyncGenerator<RunEvent, StepResult> {
  const { step, role, provider, now } = context;
  const startedAt = now();
  let output = "";

  const chunks = provider.generate({
    systemPrompt: buildSystemPrompt(role, step),
    input: buildStepInput(step, context.request, context.outputs),
    maxOutputTokens: step.maxOutputTokens,
    sampleResponse: step.sampleOutput,
    signal: context.signal,
  });

  for await (const chunk of chunks) {
    if (chunk.type === "text") {
      output += chunk.text;
      yield { type: "step-text", stepId: step.id, text: chunk.text };
      continue;
    }
    return {
      stepId: step.id,
      provider: provider.id,
      output,
      model: chunk.model,
      usage: chunk.usage,
      truncated: chunk.truncated,
      durationMs: now() - startedAt,
    };
  }

  // A IA parou de mandar pedaços sem avisar que terminou: a resposta pode estar pela metade.
  throw new ProviderError("A IA parou de responder antes de terminar.", { retryable: true });
}

function findRole(recipe: Recipe, roleId: string): Role {
  const role = recipe.roles.find((candidate) => candidate.id === roleId);
  if (!role) throw new Error(`Papel desconhecido: "${roleId}".`);
  return role;
}

function describeError(error: unknown): { retryable: boolean; errorMessage: string } {
  if (error instanceof ProviderError) {
    return { retryable: error.retryable, errorMessage: error.message };
  }
  // Erro que não veio de uma IA é defeito no nosso código: tentar de novo não resolve.
  return { retryable: false, errorMessage: error instanceof Error ? error.message : String(error) };
}

function sumUsage(results: StepResult[]): Usage {
  return results.reduce(
    (total, result) => ({
      inputTokens: total.inputTokens + result.usage.inputTokens,
      outputTokens: total.outputTokens + result.usage.outputTokens,
    }),
    { inputTokens: 0, outputTokens: 0 },
  );
}

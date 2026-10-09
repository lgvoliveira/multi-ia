// Motor de orquestração: roda as etapas de uma receita, em ordem, e narra cada passo.
// Não conhece telas nem IAs específicas: recebe as IAs prontas (getProvider) e devolve eventos.
// Quando uma IA falha, tenta de novo e, se preciso, troca a IA do papel (regras do AGENTS.md, seção 5).

import { ProviderError, type AiProvider, type ProviderId, type Usage } from "@/lib/providers/types";
import type { Recipe, Role, Step } from "@/lib/recipes/types";
import { buildStepInput, buildSystemPrompt } from "./input";
import type { RunEvent, RunInput, StepResult, TeamChoice } from "./types";
import { findRunProblems } from "./validate";

/**
 * Espera antes de cada nova tentativa com a mesma IA, em milissegundos: são 2 novas tentativas,
 * a primeira depois de 1 s e a segunda depois de mais 2 s. Às vezes a IA só está sobrecarregada por um instante.
 */
export const RETRY_DELAYS_MS: readonly number[] = [1000, 2000];

export interface RunOptions {
  /**
   * Entrega a IA de cada identificador. No servidor, é o getProvider de lib/providers/registry.
   * É chamado uma vez por etapa para cada IA que trabalha nela; as novas tentativas usam a mesma IA entregue.
   */
  getProvider: (id: ProviderId) => AiProvider;
  /** Permite cancelar a execução no meio (ex.: o usuário fechou a página). */
  signal?: AbortSignal;
  /** Relógio, em milissegundos. Os testes trocam por um relógio falso. */
  now?: () => number;
  /** Espera entre uma tentativa e outra; para na hora se a execução for cancelada. Os testes trocam por uma que não espera. */
  wait?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

/** O que uma etapa precisa para rodar. */
interface StepContext {
  step: Step;
  role: Role;
  request: string;
  outputs: ReadonlyMap<string, string>;
  options: RunOptions;
}

/** O que uma tentativa que deu certo produziu. O tempo é medido na etapa inteira (veja StepResult). */
type AttemptResult = Omit<StepResult, "durationMs">;

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
  // IA atual de cada papel. Muda quando uma IA falha e outra assume o papel.
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
    const stepStartedAt = now();
    yield { type: "step-started", stepId: step.id, provider: team[role.id] };

    let result: StepResult;
    try {
      const attempt = yield* runStepWithBackup({ step, role, request, outputs, options }, team);
      result = { ...attempt, durationMs: now() - stepStartedAt };
    } catch (error) {
      // Se foi o usuário quem cancelou, o erro é só a IA parando de escrever: não é falha.
      if (signal?.aborted) {
        yield { type: "run-cancelled", stepId: step.id };
      } else {
        yield { type: "run-failed", stepId: step.id, provider: team[role.id], ...describeError(error) };
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

/**
 * Roda a etapa com a IA do papel. Se ela não conseguir, mesmo tentando de novo, outra IA assume o papel
 * e faz a etapa do zero; se essa também não conseguir, a etapa falha.
 * Quando outra IA assume, `team` passa a apontar para ela: ela segue no papel nas próximas etapas.
 */
async function* runStepWithBackup(
  context: StepContext,
  team: Record<string, ProviderId>,
): AsyncGenerator<RunEvent, AttemptResult> {
  const { step, role } = context;
  const first = team[role.id];
  try {
    return yield* runStepWithRetries(context, first);
  } catch (error) {
    // Cancelar não é falha, e um defeito no nosso código não se resolve trocando de IA.
    if (context.options.signal?.aborted || !(error instanceof ProviderError)) throw error;

    const backup = pickBackup(role, first);
    team[role.id] = backup;
    yield {
      type: "step-switched",
      stepId: step.id,
      roleId: role.id,
      from: first,
      to: backup,
      errorMessage: error.message,
    };
    return yield* runStepWithRetries(context, backup);
  }
}

/** IA que assume o papel quando `failed` não consegue: a recomendada pela receita ou, se foi ela que falhou, a reserva. */
function pickBackup(role: Role, failed: ProviderId): ProviderId {
  return failed === role.suggestedProvider ? role.backupProvider : role.suggestedProvider;
}

/** Roda a etapa com uma IA. Se ela falhar com um erro passageiro, espera um pouco e ela recomeça a etapa. */
async function* runStepWithRetries(
  context: StepContext,
  providerId: ProviderId,
): AsyncGenerator<RunEvent, AttemptResult> {
  const { step, options } = context;
  const wait = options.wait ?? waitFor;
  // Pegar a IA fica aqui dentro: se der erro (ex.: falta a chave), vira falha da etapa.
  const provider = options.getProvider(providerId);

  for (let attempt = 1; ; attempt++) {
    try {
      return yield* runAttempt(context, provider);
    } catch (error) {
      const delayMs = RETRY_DELAYS_MS[attempt - 1];
      const retryable = error instanceof ProviderError && error.retryable;
      if (options.signal?.aborted || !retryable || delayMs === undefined) throw error;

      yield {
        type: "step-retrying",
        stepId: step.id,
        provider: providerId,
        attempt: attempt + 1,
        delayMs,
        errorMessage: error.message,
      };
      await wait(delayMs, options.signal);
    }
  }
}

/** Uma tentativa: repassa cada pedaço que a IA escreve e, no fim, devolve o que ela produziu. */
async function* runAttempt(context: StepContext, provider: AiProvider): AsyncGenerator<RunEvent, AttemptResult> {
  const { step, role } = context;
  let output = "";

  const chunks = provider.generate({
    systemPrompt: buildSystemPrompt(role, step),
    input: buildStepInput(step, context.request, context.outputs),
    maxOutputTokens: step.maxOutputTokens,
    sampleResponse: step.sampleOutput,
    signal: context.options.signal,
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
    };
  }

  // A IA parou de mandar pedaços sem avisar que terminou: a resposta pode estar pela metade.
  throw new ProviderError("A IA parou de responder antes de terminar.", { retryable: true });
}

/** Espera `ms` milissegundos. Se a execução for cancelada no meio, para de esperar na hora. */
function waitFor(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const stop = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", stop);
      resolve();
    }, ms);
    signal?.addEventListener("abort", stop, { once: true });
  });
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

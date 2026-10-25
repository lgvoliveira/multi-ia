// Motor de orquestração: roda as etapas de uma receita, em ordem, e narra cada passo.
// Não conhece telas nem IAs específicas: recebe as IAs prontas (getProvider) e devolve eventos.
// Quando uma IA falha, tenta de novo e, se preciso, troca a IA do papel (regras do AGENTS.md, seção 5).

import { estimateTokens } from "@/lib/providers/mock";
import { DEFAULT_TIER, ProviderError, type AiProvider, type ProviderId, type Usage } from "@/lib/providers/types";
import { stageSteps, type Recipe, type Role, type Stage, type Step } from "@/lib/recipes/types";
import { buildStepInput, buildSystemPrompt, REVIEW_FEEDBACK_KEY } from "./input";
import { initialSnapshot, runSegment } from "./segment";
import type {
  AiCallReport,
  PlannedStage,
  RunEvent,
  RunInput,
  RunSnapshot,
  StepResult,
  TeamChoice,
} from "./types";
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
  /**
   * Avisado a cada chamada a uma IA que termina, bem ou mal (veja AiCallReport). É por aqui que o servidor registra
   * o custo real, inclusive o das tentativas que falharam, que não vão para a narração.
   */
  onAiCall?: (call: AiCallReport) => void;
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

/**
 * Roda a receita inteira como um laço sobre `runSegment`: parte do estado inicial e roda uma unidade de cada vez,
 * sempre alimentando o laço com o estado devolvido, até terminar. O que sai daqui é igual, evento por evento,
 * ao que `runSegment` produz quando alimentado unidade por unidade de fora (é o que o teste de equivalência prova).
 */
async function* runSteps(input: RunInput, options: RunOptions): AsyncGenerator<RunEvent> {
  let snapshot = initialSnapshot(input);
  while (!snapshot.done) {
    snapshot = yield* runSegment(snapshot, input.recipe, options);
  }
}

/** IA de cada papel: a escolhida pelo usuário ou, se ele não escolheu, a sugerida pela receita. */
export function resolveTeam(recipe: Recipe, choice: TeamChoice = {}): Record<string, ProviderId> {
  return Object.fromEntries(
    recipe.roles.map((role) => [role.id, choice[role.id] ?? role.suggestedProvider]),
  );
}

/**
 * A IA que roda uma etapa: a IA FIXA da etapa (`step.provider`), quando a etapa exige uma específica
 * (ex.: revisão sempre de família diferente de quem escreveu); senão, a IA do papel no time.
 */
function providerForStep(step: Step, team: Record<string, ProviderId>): ProviderId {
  return step.provider ?? team[step.roleId];
}

/** Erro de uma etapa já identificada. Carrega qual etapa e qual IA, para o motor narrar a falha certa. */
export class StageStepError extends Error {
  constructor(
    readonly stepId: string,
    readonly provider: ProviderId,
    /** O erro original (de uma IA ou um defeito no nosso código). */
    readonly cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = "StageStepError";
  }
}

/** O que cada fase precisa para rodar. Compartilhado por todas as fases de uma execução. */
export interface StageContext {
  recipe: Recipe;
  request: string;
  outputs: Map<string, string>;
  options: RunOptions;
  /** IA atual de cada papel. Muda quando uma IA falha e outra assume o papel. */
  team: Record<string, ProviderId>;
  /** Cada etapa concluída, na ordem em que terminou. Base do resultado, do tempo e do consumo. */
  results: StepResult[];
}

/**
 * Reconstrói o StageContext interno a partir de um RunSnapshot, para a execução continuar de onde parou.
 * Copia o time e as etapas concluídas (não são compartilhados com o estado de origem) e refaz o mapa de saídas.
 */
export function hydrateContext(snapshot: RunSnapshot, recipe: Recipe, options: RunOptions): StageContext {
  return {
    recipe,
    request: snapshot.request,
    outputs: new Map(Object.entries(snapshot.outputs)),
    options,
    team: { ...snapshot.team },
    results: [...snapshot.results],
  };
}

/** O plano de cada fase para o "run-started": tipo da fase e a IA decidida para cada etapa. */
export function planStages(context: StageContext): PlannedStage[] {
  return context.recipe.stages.map((stage) => ({
    stageId: stage.id,
    kind: stage.kind,
    steps: stageSteps(stage).map((step) => ({ stepId: step.id, provider: providerForStep(step, context.team) })),
  }));
}

/** Fase sequencial: cada etapa roda depois da anterior, usando o que ela produziu (o fluxo de sempre). */
export async function* runSequentialStage(
  context: StageContext,
  stage: Extract<Stage, { kind: "sequential" }>,
  round: number,
): AsyncGenerator<RunEvent, void> {
  yield { type: "stage-started", stageId: stage.id, round };
  for (const step of stage.steps) {
    yield* runStageStep(context, step, round);
  }
}

/**
 * Fase em paralelo: todas as etapas começam juntas e rodam ao mesmo tempo.
 * O mapa de IAs por papel é compartilhado, mas é seguro porque cada etapa em paralelo tem um papel diferente
 * (a verificação da receita garante isso): duas etapas nunca mexem na mesma posição do mapa ao mesmo tempo.
 * Se uma etapa falhar, as outras param e a fase inteira falha (como a pausa já faz, agora no nível da fase).
 */
export async function* runParallelStage(
  context: StageContext,
  stage: Extract<Stage, { kind: "parallel" }>,
  round: number,
): AsyncGenerator<RunEvent, void> {
  const { options, team, outputs, results } = context;
  const now = options.now ?? Date.now;

  yield { type: "stage-started", stageId: stage.id, round };
  // Avisa o começo de TODAS as etapas de uma vez, antes de qualquer resposta.
  for (const step of stage.steps) {
    yield tagRound({ type: "step-started", stepId: step.id, provider: providerForStep(step, team) }, round);
  }

  const streams = stage.steps.map((step) => ({
    stepId: step.id,
    gen: runStepUnit(context, step, round, now()),
  }));
  const finished = yield* mergeStepStreams(streams, options.signal);

  // Escreve as saídas em ordem (a ordem em que as etapas terminaram é imprevisível).
  for (const step of stage.steps) {
    const result = finished.get(step.id);
    if (!result) throw new Error(`A etapa "${step.id}" terminou sem resposta.`);
    outputs.set(step.id, result.output);
    results.push(result);
    yield tagRound({ type: "step-finished", ...result }, round);
  }
}

/**
 * Fase de revisão: uma etapa revisa o trabalho. Se aprovar (ou acabarem as rodadas), segue em frente;
 * se mandar refazer, a fase `reworkStageId` roda de novo com o que a revisão pediu, e a revisão roda outra vez.
 * Veredito que não dá para entender conta como aprovado, para não ficar refazendo sem fim.
 */
export async function* runReviewStage(
  context: StageContext,
  stage: Extract<Stage, { kind: "review" }>,
): AsyncGenerator<RunEvent, void> {
  for (let round = 1; ; round++) {
    const { approved } = yield* runReviewRound(context, stage, round);
    if (approved || round >= stage.maxRounds) return;
  }
}

/**
 * Uma única rodada de revisão, como unidade retomável: da 2ª rodada em diante, primeiro refaz a fase apontada
 * (com o que a revisão pediu); depois roda a etapa que revisa e devolve o veredito. Quem chama decide se há
 * outra rodada. O motor inteiro de revisão (`runReviewStage`) e o executor por segmento usam esta mesma função,
 * então a ordem dos eventos é exatamente a mesma rodando tudo de uma vez ou uma unidade por vez.
 */
export async function* runReviewRound(
  context: StageContext,
  stage: Extract<Stage, { kind: "review" }>,
  round: number,
): AsyncGenerator<RunEvent, { approved: boolean }> {
  const reworkStage = findStage(context.recipe, stage.reworkStageId);
  if (reworkStage.kind !== "parallel") {
    throw new Error(`A revisão "${stage.id}" refaz "${stage.reworkStageId}", que não é uma fase em paralelo.`);
  }

  // A partir da 2ª rodada, refaz a fase apontada com o que a revisão pediu (já está em REVIEW_FEEDBACK_KEY).
  if (round > 1) yield* runParallelStage(context, reworkStage, round);

  yield { type: "stage-started", stageId: stage.id, round };
  const result = yield* runStageStep(context, stage.step, round);
  // Guarda o veredito para a fase refeita ler (from:"review").
  context.outputs.set(REVIEW_FEEDBACK_KEY, result.output);

  const approved = parseVerdict(result.output);
  yield { type: "review-result", stageId: stage.id, round, approved };
  return { approved };
}

/** Lê o veredito da revisão pela primeira linha: "APROVADO" aprova, "REVISAR:" manda refazer. */
export function parseVerdict(text: string): boolean {
  const firstLine = text.trim().split(/\r?\n/, 1)[0]?.trim().toUpperCase() ?? "";
  if (firstLine.startsWith("APROVADO")) return true;
  if (firstLine.startsWith("REVISAR")) return false;
  // Veredito fora do combinado: aprova, para a revisão não virar um laço sem fim.
  return true;
}

/**
 * Roda uma etapa de ponta a ponta: avisa o começo, repassa os pedaços, guarda a saída e avisa o fim.
 * Devolve o resultado completo. Usada nas fases sequencial e de revisão (a em paralelo controla isso por fora).
 */
async function* runStageStep(context: StageContext, step: Step, round: number): AsyncGenerator<RunEvent, StepResult> {
  const { options, team } = context;
  const now = options.now ?? Date.now;
  yield tagRound({ type: "step-started", stepId: step.id, provider: team[step.roleId] }, round);
  const result = yield* runStepUnit(context, step, round, now());
  context.outputs.set(step.id, result.output);
  context.results.push(result);
  yield tagRound({ type: "step-finished", ...result }, round);
  return result;
}

/**
 * Uma etapa como unidade: roda com a IA do papel (com novas tentativas e troca de IA) e devolve o resultado,
 * com o tempo que levou. NÃO avisa o começo nem o fim — quem a chama decide quando avisar.
 * Falha vira um StageStepError, que identifica a etapa e a IA; o cancelamento sobe como está.
 */
async function* runStepUnit(
  context: StageContext,
  step: Step,
  round: number,
  startedAt: number,
): AsyncGenerator<RunEvent, StepResult> {
  const { options, team } = context;
  const now = options.now ?? Date.now;
  const role = findRole(context.recipe, step.roleId);
  const stepContext: StepContext = {
    step,
    role,
    request: context.request,
    outputs: context.outputs,
    options,
  };
  try {
    const attempt = yield* tagRoundStream(runStepWithBackup(stepContext, team), round);
    return { ...attempt, durationMs: now() - startedAt };
  } catch (error) {
    throw new StageStepError(step.id, providerForStep(step, team), error);
  }
}

/**
 * Roda várias etapas ao mesmo tempo. A cada volta, espera a primeira que tiver uma novidade (um pedaço de texto
 * ou o fim), repassa o evento e rearma essa etapa. Junta o resultado de cada etapa num mapa por identificador.
 * Se uma etapa falhar (ou tudo for cancelado), manda as irmãs pararem e repassa o erro: a fase inteira falha.
 */
export async function* mergeStepStreams<R>(
  streams: { stepId: string; gen: AsyncGenerator<RunEvent, R> }[],
  signal?: AbortSignal,
): AsyncGenerator<RunEvent, Map<string, R>> {
  const results = new Map<string, R>();
  type Settled = { stepId: string; res: IteratorResult<RunEvent, R> };
  interface Pending {
    gen: AsyncGenerator<RunEvent, R>;
    promise: Promise<Settled>;
  }
  const active = new Map<string, Pending>();
  const arm = (stepId: string, gen: AsyncGenerator<RunEvent, R>) => {
    active.set(stepId, { gen, promise: gen.next().then((res) => ({ stepId, res })) });
  };
  for (const { stepId, gen } of streams) arm(stepId, gen);

  try {
    while (active.size > 0) {
      // Cancelou tudo: solta o erro para mandar as etapas irmãs pararem lá embaixo.
      signal?.throwIfAborted();
      const { stepId, res } = await Promise.race([...active.values()].map((pending) => pending.promise));
      if (res.done) {
        results.set(stepId, res.value);
        active.delete(stepId);
        continue;
      }
      yield res.value;
      const pending = active.get(stepId);
      if (pending) pending.promise = pending.gen.next().then((next) => ({ stepId, res: next }));
    }
    return results;
  } catch (error) {
    // Evita rejeições sem dono das etapas irmãs que ainda estavam no ar, e manda todas pararem.
    const siblings = [...active.values()];
    for (const pending of siblings) pending.promise.catch(() => {});
    await Promise.allSettled(siblings.map((pending) => pending.gen.return(undefined as unknown as R)));
    throw error;
  }
}

/** Marca o evento de uma etapa com a rodada, só a partir da 2ª (na 1ª rodada a rodada é implícita). */
function tagRound(event: RunEvent, round: number): RunEvent {
  if (round <= 1) return event;
  switch (event.type) {
    case "step-started":
    case "step-text":
    case "step-retrying":
    case "step-finished":
      return { ...event, round };
    default:
      return event;
  }
}

/**
 * Repassa os eventos de uma etapa marcando a rodada, e devolve o resultado dela no fim.
 * Se mandarem parar no meio (numa fase em paralelo, uma etapa irmã falhou), repassa a ordem para a etapa: assim a
 * conexão com a IA fecha e a chamada interrompida é avisada (onAiCall).
 */
async function* tagRoundStream<R>(
  gen: AsyncGenerator<RunEvent, R>,
  round: number,
): AsyncGenerator<RunEvent, R> {
  let finished = false;
  try {
    let next = await gen.next();
    while (!next.done) {
      yield tagRound(next.value, round);
      next = await gen.next();
    }
    finished = true;
    return next.value;
  } finally {
    if (!finished) await gen.return(undefined as unknown as R);
  }
}

/** Primeira etapa de uma fase: a que fica como cancelada quando a pessoa para entre as fases. */
export function firstStepId(stage: Stage): string {
  return stageSteps(stage)[0].id;
}

function findStage(recipe: Recipe, stageId: string): Stage {
  const stage = recipe.stages.find((candidate) => candidate.id === stageId);
  if (!stage) throw new Error(`Fase desconhecida: "${stageId}".`);
  return stage;
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
  const first = providerForStep(step, team);
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
      return yield* runAttempt(context, provider, attempt);
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

/**
 * Uma tentativa: repassa cada pedaço que a IA escreve e, no fim, devolve o que ela produziu.
 * Termine como terminar (resposta completa, erro, cancelamento ou a fase mandando parar), avisa onAiCall no fim.
 */
async function* runAttempt(
  context: StepContext,
  provider: AiProvider,
  attempt: number,
): AsyncGenerator<RunEvent, AttemptResult> {
  const { step, role, options } = context;
  const now = options.now ?? Date.now;
  const startedAt = now();
  const systemPrompt = buildSystemPrompt(role, step);
  const input = buildStepInput(step, context.request, context.outputs);
  let output = "";
  let result: AttemptResult | null = null;
  // Fica sem valor se a fase mandar esta tentativa parar no meio (uma etapa irmã falhou ou foi cancelada).
  let failure: unknown = undefined;

  try {
    const chunks = provider.generate({
      systemPrompt,
      input,
      maxOutputTokens: step.maxOutputTokens,
      effort: step.effort ?? "medium",
      tier: DEFAULT_TIER,
      sampleResponse: step.sampleOutput,
      signal: options.signal,
    });

    for await (const chunk of chunks) {
      if (chunk.type === "text") {
        output += chunk.text;
        yield { type: "step-text", stepId: step.id, text: chunk.text };
        continue;
      }
      result = {
        stepId: step.id,
        provider: provider.id,
        output,
        model: chunk.model,
        usage: chunk.usage,
        truncated: chunk.truncated,
      };
      return result;
    }

    // A IA parou de mandar pedaços sem avisar que terminou: a resposta pode estar pela metade.
    throw new ProviderError("A IA parou de responder antes de terminar.", { retryable: true });
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    options.onAiCall?.({
      stepId: step.id,
      provider: provider.id,
      model: result?.model ?? (failure instanceof ProviderError ? failure.model : undefined) ?? null,
      tier: DEFAULT_TIER,
      // Sem a conta da IA (ela não terminou), conta pelo tamanho do que foi enviado e do que ela escreveu.
      usage: result?.usage ?? {
        inputTokens: estimateTokens(systemPrompt + input),
        outputTokens: estimateTokens(output),
      },
      ok: result !== null,
      ...(result ? {} : { errorMessage: failureMessage(failure, options.signal) }),
      attempt,
      durationMs: now() - startedAt,
    });
  }
}

/** A mensagem técnica de uma tentativa que não terminou, para o registro interno. */
function failureMessage(failure: unknown, signal: AbortSignal | undefined): string {
  if (signal?.aborted) return "Cancelada no meio.";
  if (failure === undefined) return "Parou no meio: outra etapa da fase falhou.";
  return failure instanceof Error ? failure.message : String(failure);
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

export function describeError(error: unknown): { retryable: boolean; errorMessage: string } {
  if (error instanceof ProviderError) {
    return { retryable: error.retryable, errorMessage: error.message };
  }
  // Erro que não veio de uma IA é defeito no nosso código: tentar de novo não resolve.
  return { retryable: false, errorMessage: error instanceof Error ? error.message : String(error) };
}

export function sumUsage(results: StepResult[]): Usage {
  return results.reduce(
    (total, result) => ({
      inputTokens: total.inputTokens + result.usage.inputTokens,
      outputTokens: total.outputTokens + result.usage.outputTokens,
    }),
    { inputTokens: 0, outputTokens: 0 },
  );
}

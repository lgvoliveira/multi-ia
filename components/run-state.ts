// Estado da execução na tela: o que cada cartão de etapa mostra, atualizado a cada evento da narração,
// e o resultado no fim. Só dados e funções puras, para os testes conferirem cada passagem.

import type { ProviderId } from "@/lib/providers/types";
import type { OutputFormat, StageKind } from "@/lib/recipes/types";
import type { PublicRunEvent } from "@/lib/runs/public-events";

/**
 * waiting: esperando a vez; working: a IA está escrevendo; done: concluída; failed: a IA não conseguiu;
 * stopped: parou no meio (cancelada ou a conexão caiu); skipped: a execução acabou antes de ela começar.
 */
export type StepStatus = "waiting" | "working" | "done" | "failed" | "stopped" | "skipped";

/** Uma etapa como a tela mostra. */
export interface StepView {
  id: string;
  /** Fase a que a etapa pertence. Numa fase em paralelo, várias etapas trabalham ao mesmo tempo. */
  stageId: string;
  /** Papel que faz a etapa. Quando outra IA assume um papel, ela fica com as próximas etapas dele. */
  roleId: string;
  name: string;
  summary: string;
  doneSummary: string;
  format: OutputFormat;
  provider: ProviderId;
  status: StepStatus;
  /** O que a IA escreveu até agora. */
  text: string;
  /** Rodada atual da etapa. Começa em 1; a revisão pode mandar refazer e aí sobe para 2, 3... */
  round: number;
  durationMs?: number;
  /** IA que não conseguiu fazer a etapa (ou uma anterior do mesmo papel); `provider` entrou no lugar dela. */
  replacedProvider?: ProviderId;
  /** Número da tentativa, quando a IA teve um problema e está tentando de novo. */
  retryAttempt?: number;
}

/** O que a tela já sabe de cada etapa antes de a execução começar. */
export type PlannedStepView = Pick<
  StepView,
  "id" | "roleId" | "name" | "summary" | "doneSummary" | "format" | "provider"
>;

/** Uma fase como a tela já a conhece antes de a execução começar. */
export interface PlannedStageView {
  id: string;
  kind: StageKind;
  steps: PlannedStepView[];
}

/** Uma fase no estado da execução: o tipo e a rodada atual. As etapas ficam na lista plana `steps`. */
export interface RunStage {
  id: string;
  kind: StageKind;
  round: number;
  /** Veredito da última rodada de revisão, quando houve uma. */
  approved?: boolean;
}

/**
 * running: o time está trabalhando. paused: o custo ia passar do que foi reservado, e o time espera a pessoa dizer se
 * continua. Os outros são o fim: terminou, uma IA falhou, a pessoa cancelou ou a conexão caiu no meio do caminho.
 */
export type RunStatus = "running" | "paused" | "finished" | "failed" | "cancelled" | "interrupted";

export interface RunState {
  status: RunStatus;
  /** Todas as etapas numa lista só, na ordem das fases. Cada uma sabe a sua fase (stageId). */
  steps: StepView[];
  /** As fases, na ordem, com a rodada atual de cada uma. */
  stages: RunStage[];
  /** O resultado final, quando o time termina. */
  result?: string;
  /** Quanto tempo o time levou, quando termina. */
  durationMs?: number;
  /** Numa pausa: quanto é preciso reservar, em centavos, para o time terminar. */
  neededCents?: number;
}

export type RunAction =
  | { type: "event"; event: PublicRunEvent }
  /** A pessoa apertou "Cancelar". */
  | { type: "cancel" }
  /** A narração acabou. Se ela não trouxe um evento de fim, a conexão caiu no meio. */
  | { type: "stream-ended" };

export function createRunState(stages: PlannedStageView[]): RunState {
  return {
    status: "running",
    steps: stages.flatMap((stage) =>
      stage.steps.map((step) => ({ ...step, stageId: stage.id, status: "waiting" as StepStatus, text: "", round: 1 })),
    ),
    stages: stages.map((stage) => ({ id: stage.id, kind: stage.kind, round: 1 })),
  };
}

export function runReducer(state: RunState, action: RunAction): RunState {
  // Depois do fim, nada muda (ex.: um pedaço de texto que chega atrasado depois do "Cancelar").
  if (state.status !== "running" && state.status !== "paused") return state;

  switch (action.type) {
    case "cancel":
      return endRun(state, "cancelled");
    case "stream-ended":
      return endRun(state, "interrupted");
    case "event":
      return applyEvent(state, action.event);
  }
}

function applyEvent(state: RunState, event: PublicRunEvent): RunState {
  switch (event.type) {
    case "run-started": {
      // Vale a IA que o servidor decidiu para cada etapa.
      const providers = new Map<string, ProviderId>();
      for (const stage of event.stages) {
        for (const step of stage.steps) providers.set(step.stepId, step.provider);
      }
      return mapSteps(state, (step) => ({ ...step, provider: providers.get(step.id) ?? step.provider }));
    }
    case "stage-started":
      return updateStage(state, event.stageId, (stage) => ({ ...stage, round: event.round }));
    case "step-started": {
      const round = event.round ?? 1;
      // step-started sempre recomeça a etapa do zero; numa rodada nova (revisão), o texto anterior também sai.
      return updateStep(state, event.stepId, (step) => ({
        ...step,
        provider: event.provider,
        status: "working",
        text: "",
        round: round > step.round ? round : step.round,
      }));
    }
    case "step-text":
      return updateStep(state, event.stepId, (step) => ({ ...step, text: step.text + event.text }));
    case "step-retrying":
      // A IA recomeça a etapa do zero: o que ela tinha escrito sai da tela.
      return updateStep(state, event.stepId, (step) => ({ ...step, text: "", retryAttempt: event.attempt }));
    case "step-switched":
      // Outra IA assume o papel: recomeça esta etapa do zero e fica com as próximas etapas do papel.
      return mapSteps(state, (step) => {
        const replaced = { ...step, provider: event.to, replacedProvider: event.from };
        if (step.id === event.stepId) return { ...replaced, text: "", retryAttempt: undefined };
        if (step.roleId === event.roleId && step.status === "waiting") return replaced;
        return step;
      });
    case "review-result":
      return updateStage(state, event.stageId, (stage) => ({ ...stage, round: event.round, approved: event.approved }));
    case "step-finished":
      return updateStep(state, event.stepId, (step) => ({
        ...step,
        status: "done",
        durationMs: event.durationMs,
        retryAttempt: undefined,
      }));
    case "run-finished":
      return { ...state, status: "finished", result: event.result, durationMs: event.durationMs };
    case "run-failed":
      return endRun(
        updateStep(state, event.stepId, (step) => ({ ...step, status: "failed" })),
        "failed",
      );
    case "run-cancelled":
      return endRun(state, "cancelled");
    case "run-paused":
      return { ...state, status: "paused", neededCents: event.neededCents };
    case "run-resumed":
      return { ...state, status: "running", neededCents: undefined };
  }
}

/** Encerra a execução: as etapas que trabalhavam param no meio, e as que esperavam não vão mais começar. */
function endRun(state: RunState, status: RunStatus): RunState {
  const ended = mapSteps(state, (step) => {
    if (step.status === "working") return { ...step, status: "stopped" };
    if (step.status === "waiting") return { ...step, status: "skipped" };
    return step;
  });
  return { ...ended, status };
}

function mapSteps(state: RunState, change: (step: StepView) => StepView): RunState {
  return { ...state, steps: state.steps.map(change) };
}

function updateStep(state: RunState, stepId: string, change: (step: StepView) => StepView): RunState {
  return mapSteps(state, (step) => (step.id === stepId ? change(step) : step));
}

function updateStage(state: RunState, stageId: string, change: (stage: RunStage) => RunStage): RunState {
  return { ...state, stages: state.stages.map((stage) => (stage.id === stageId ? change(stage) : stage)) };
}

/** Uma fase com as suas etapas, para a tela desenhar fase por fase. */
export interface StageView extends RunStage {
  steps: StepView[];
}

/** Agrupa as etapas por fase, na ordem, com o tipo e a rodada de cada fase. */
export function stagesOf(state: RunState): StageView[] {
  return state.stages.map((stage) => ({
    ...stage,
    steps: state.steps.filter((step) => step.stageId === stage.id),
  }));
}

/** As partes do documento vivo, montadas a partir do que cada etapa escreveu até agora. */
export interface LiveDocument {
  brief?: string;
  front?: string;
  back?: string;
  research?: string;
  reviewNotes?: string;
}

/** Junta o que cada etapa produziu num "documento vivo" que a tela mostra enquanto o time trabalha. */
export function liveDocument(state: RunState): LiveDocument {
  const textOf = (stepId: string) => {
    const step = state.steps.find((candidate) => candidate.id === stepId);
    return step && step.text.length > 0 ? step.text : undefined;
  };
  const document: LiveDocument = {
    brief: textOf("brief"),
    front: textOf("front"),
    back: textOf("back"),
    research: textOf("research"),
    reviewNotes: textOf("review"),
  };
  return document;
}

/** O site pronto, quando o time terminou e o resultado final é um site. Senão, null. */
export function finishedSite(state: RunState): string | null {
  const finalStep = state.steps.at(-1);
  if (state.status !== "finished" || state.result === undefined || finalStep?.format !== "html") return null;
  return state.result;
}

/** Tempo de uma etapa, do jeito que se fala: "menos de 1 s", "12 s", "1 min 5 s". */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 1) return "menos de 1 s";
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`;
}

// Estado da tela "Seu time está trabalhando": o que cada cartão de etapa mostra, atualizado a cada
// evento da narração. Só dados e funções puras, para os testes conferirem cada passagem.

import type { ProviderId } from "@/lib/providers/types";
import type { OutputFormat } from "@/lib/recipes/types";
import type { PublicRunEvent } from "@/lib/runs/public-events";

/**
 * waiting: esperando a vez; working: a IA está escrevendo; done: concluída; failed: a IA não conseguiu;
 * stopped: parou no meio (cancelada ou a conexão caiu); skipped: a execução acabou antes de ela começar.
 */
export type StepStatus = "waiting" | "working" | "done" | "failed" | "stopped" | "skipped";

/** Uma etapa como a tela mostra. */
export interface StepView {
  id: string;
  name: string;
  summary: string;
  format: OutputFormat;
  provider: ProviderId;
  status: StepStatus;
  /** O que a IA escreveu até agora. */
  text: string;
  durationMs?: number;
}

/** O que a tela já sabe de cada etapa antes de a execução começar. */
export type PlannedStepView = Pick<StepView, "id" | "name" | "summary" | "format" | "provider">;

/**
 * running: o time está trabalhando. Os outros são o fim: terminou, uma IA falhou,
 * a pessoa cancelou ou a conexão caiu no meio do caminho.
 */
export type RunStatus = "running" | "finished" | "failed" | "cancelled" | "interrupted";

export interface RunState {
  status: RunStatus;
  steps: StepView[];
  /** O resultado final, quando o time termina. */
  result?: string;
}

export type RunAction =
  | { type: "event"; event: PublicRunEvent }
  /** A pessoa apertou "Cancelar". */
  | { type: "cancel" }
  /** A narração acabou. Se ela não trouxe um evento de fim, a conexão caiu no meio. */
  | { type: "stream-ended" };

export function createRunState(steps: PlannedStepView[]): RunState {
  return {
    status: "running",
    steps: steps.map((step) => ({ ...step, status: "waiting", text: "" })),
  };
}

export function runReducer(state: RunState, action: RunAction): RunState {
  // Depois do fim, nada muda (ex.: um pedaço de texto que chega atrasado depois do "Cancelar").
  if (state.status !== "running") return state;

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
      const providers = new Map(event.steps.map((step) => [step.stepId, step.provider]));
      return mapSteps(state, (step) => ({ ...step, provider: providers.get(step.id) ?? step.provider }));
    }
    case "step-started":
      return updateStep(state, event.stepId, (step) => ({
        ...step,
        provider: event.provider,
        status: "working",
        text: "",
      }));
    case "step-text":
      return updateStep(state, event.stepId, (step) => ({ ...step, text: step.text + event.text }));
    case "step-finished":
      return updateStep(state, event.stepId, (step) => ({
        ...step,
        status: "done",
        durationMs: event.durationMs,
      }));
    case "run-finished":
      return { ...state, status: "finished", result: event.result };
    case "run-failed":
      return endRun(
        updateStep(state, event.stepId, (step) => ({ ...step, status: "failed" })),
        "failed",
      );
    case "run-cancelled":
      return endRun(state, "cancelled");
  }
}

/** Encerra a execução: a etapa que trabalhava parou no meio, e as que esperavam não vão mais começar. */
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

/** Tempo de uma etapa, do jeito que se fala: "menos de 1 s", "12 s", "1 min 5 s". */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 1) return "menos de 1 s";
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`;
}

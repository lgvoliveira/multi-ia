import { describe, expect, it } from "vitest";
import type { PublicRunEvent } from "@/lib/runs/public-events";
import {
  createRunState,
  formatDuration,
  runReducer,
  type PlannedStepView,
  type RunAction,
  type RunState,
} from "./run-state";

const PLANNED: PlannedStepView[] = [
  { id: "plan", name: "Chefe", summary: "Vai planejar", format: "text", provider: "claude" },
  { id: "code", name: "Programador", summary: "Vai programar", format: "html", provider: "gpt" },
  { id: "review", name: "Revisor", summary: "Vai revisar", format: "text", provider: "gemini" },
];

function event(publicEvent: PublicRunEvent): RunAction {
  return { type: "event", event: publicEvent };
}

/** Aplica as ações em ordem, a partir do começo da execução. */
function play(...actions: RunAction[]): RunState {
  return actions.reduce(runReducer, createRunState(PLANNED));
}

/** Resumo de cada etapa: "id status". */
function statuses(state: RunState): string[] {
  return state.steps.map((step) => `${step.id} ${step.status}`);
}

const PLAN_DONE = [
  event({ type: "step-started", stepId: "plan", provider: "claude" }),
  event({ type: "step-text", stepId: "plan", text: "Plano: " }),
  event({ type: "step-text", stepId: "plan", text: "4 seções." }),
  event({ type: "step-finished", stepId: "plan", durationMs: 3200 }),
];

describe("estado da tela do time trabalhando", () => {
  it("começa com todas as etapas aguardando, cada uma com a IA escolhida", () => {
    const state = createRunState(PLANNED);

    expect(state.status).toBe("running");
    expect(statuses(state)).toEqual(["plan waiting", "code waiting", "review waiting"]);
    expect(state.steps.map((step) => step.provider)).toEqual(["claude", "gpt", "gemini"]);
  });

  it("a etapa trabalha, junta o texto que chega aos pedaços e termina com o tempo que levou", () => {
    const working = play(...PLAN_DONE.slice(0, 3));
    expect(statuses(working)).toEqual(["plan working", "code waiting", "review waiting"]);
    expect(working.steps[0].text).toBe("Plano: 4 seções.");

    const done = play(...PLAN_DONE);
    expect(statuses(done)).toEqual(["plan done", "code waiting", "review waiting"]);
    expect(done.steps[0]).toMatchObject({ text: "Plano: 4 seções.", durationMs: 3200 });
  });

  it("vale a IA que o servidor decidiu para cada etapa", () => {
    const state = play(
      event({
        type: "run-started",
        steps: [
          { stepId: "plan", provider: "claude" },
          { stepId: "code", provider: "claude" },
          { stepId: "review", provider: "gemini" },
        ],
      }),
      event({ type: "step-started", stepId: "review", provider: "gpt" }),
    );

    expect(state.steps.map((step) => step.provider)).toEqual(["claude", "claude", "gpt"]);
  });

  it("quando o time termina, guarda o resultado final", () => {
    const state = play(...PLAN_DONE, event({ type: "run-finished", result: "<!DOCTYPE html>", durationMs: 9000 }));

    expect(state.status).toBe("finished");
    expect(state.result).toBe("<!DOCTYPE html>");
  });

  it("quando uma IA falha, marca a etapa, e as seguintes ficam como não começadas", () => {
    const state = play(
      ...PLAN_DONE,
      event({ type: "step-started", stepId: "code", provider: "gpt" }),
      event({ type: "step-text", stepId: "code", text: "<html>" }),
      event({ type: "run-failed", stepId: "code" }),
    );

    expect(state.status).toBe("failed");
    expect(statuses(state)).toEqual(["plan done", "code failed", "review skipped"]);
    expect(state.steps[1].text).toBe("<html>");
  });

  it("ao cancelar, a etapa que trabalhava fica interrompida e guarda o que já tinha escrito", () => {
    const state = play(
      ...PLAN_DONE,
      event({ type: "step-started", stepId: "code", provider: "gpt" }),
      event({ type: "step-text", stepId: "code", text: "<html>" }),
      { type: "cancel" },
    );

    expect(state.status).toBe("cancelled");
    expect(statuses(state)).toEqual(["plan done", "code stopped", "review skipped"]);
    expect(state.steps[1].text).toBe("<html>");
  });

  it("se a narração acaba sem um evento de fim, a conexão caiu no meio", () => {
    const state = play(...PLAN_DONE, { type: "stream-ended" });

    expect(state.status).toBe("interrupted");
    expect(statuses(state)).toEqual(["plan done", "code skipped", "review skipped"]);
  });

  it("o fim normal da narração, depois do evento de fim, não muda nada", () => {
    const finished = play(...PLAN_DONE, event({ type: "run-finished", result: "Pronto", durationMs: 1 }));

    expect(runReducer(finished, { type: "stream-ended" })).toBe(finished);
  });

  it("depois do fim, um pedaço de texto atrasado é ignorado", () => {
    const cancelled = play(PLAN_DONE[0], { type: "cancel" });
    const late = runReducer(cancelled, event({ type: "step-text", stepId: "plan", text: "atrasado" }));

    expect(late).toBe(cancelled);
  });
});

describe("tempo de cada etapa", () => {
  it("fala o tempo do jeito do dia a dia", () => {
    expect(formatDuration(400)).toBe("menos de 1 s");
    expect(formatDuration(3200)).toBe("3 s");
    expect(formatDuration(59_400)).toBe("59 s");
    expect(formatDuration(59_600)).toBe("1 min");
    expect(formatDuration(65_000)).toBe("1 min 5 s");
  });
});

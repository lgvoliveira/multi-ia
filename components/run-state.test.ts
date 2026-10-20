import { describe, expect, it } from "vitest";
import type { ProviderId } from "@/lib/providers/types";
import type { OutputFormat, StageKind } from "@/lib/recipes/types";
import type { PublicRunEvent } from "@/lib/runs/public-events";
import {
  createRunState,
  finishedSite,
  formatDuration,
  liveDocument,
  runReducer,
  stagesOf,
  type PlannedStageView,
  type PlannedStepView,
  type RunAction,
  type RunState,
} from "./run-state";

function stepView(
  id: string,
  roleId: string,
  name: string,
  format: OutputFormat,
  provider: ProviderId,
): PlannedStepView {
  return { id, roleId, name, summary: `Vai ${name}`, doneSummary: `${name} pronto`, format, provider };
}

function parallelStage(id: string, kind: StageKind, steps: PlannedStepView[]): PlannedStageView {
  return { id, kind, steps };
}

// Mesma forma da receita "Criar um site": planejar, construir (em paralelo), revisar e consolidar.
const STAGES: PlannedStageView[] = [
  parallelStage("brief", "sequential", [stepView("brief", "chief", "Chefe", "text", "claude")]),
  parallelStage("build", "parallel", [
    stepView("front", "frontend", "Front-end", "html", "gpt"),
    stepView("back", "backend", "Back-end", "text", "claude"),
    stepView("research", "researcher", "Pesquisador", "text", "gemini"),
  ]),
  parallelStage("review", "review", [stepView("review", "chief", "Revisão", "text", "claude")]),
  parallelStage("final", "sequential", [stepView("consolidate", "chief", "Consolidação", "html", "claude")]),
];

function event(publicEvent: PublicRunEvent): RunAction {
  return { type: "event", event: publicEvent };
}

/** Aplica as ações em ordem, a partir do começo da execução. */
function play(...actions: RunAction[]): RunState {
  return actions.reduce(runReducer, createRunState(STAGES));
}

/** Resumo de cada etapa: "id status". */
function statuses(state: RunState): string[] {
  return state.steps.map((step) => `${step.id} ${step.status}`);
}

function stepById(state: RunState, id: string) {
  const step = state.steps.find((candidate) => candidate.id === id);
  if (!step) throw new Error(`Etapa não encontrada: ${id}`);
  return step;
}

const BRIEF_DONE = [
  event({ type: "stage-started", stageId: "brief", round: 1 }),
  event({ type: "step-started", stepId: "brief", provider: "claude" }),
  event({ type: "step-text", stepId: "brief", text: "Plano: " }),
  event({ type: "step-text", stepId: "brief", text: "4 seções." }),
  event({ type: "step-finished", stepId: "brief", durationMs: 3200 }),
];

describe("estado da tela do time trabalhando", () => {
  it("começa com todas as etapas aguardando, cada uma com a IA escolhida, agrupadas por fase", () => {
    const state = createRunState(STAGES);

    expect(state.status).toBe("running");
    expect(statuses(state)).toEqual([
      "brief waiting",
      "front waiting",
      "back waiting",
      "research waiting",
      "review waiting",
      "consolidate waiting",
    ]);
    expect(state.steps.map((step) => step.provider)).toEqual(["claude", "gpt", "claude", "gemini", "claude", "claude"]);
    expect(state.stages.map((stage) => [stage.id, stage.kind, stage.round])).toEqual([
      ["brief", "sequential", 1],
      ["build", "parallel", 1],
      ["review", "review", 1],
      ["final", "sequential", 1],
    ]);
    // Cada etapa sabe a fase a que pertence.
    expect(stepById(state, "front").stageId).toBe("build");
  });

  it("a etapa trabalha, junta o texto que chega aos pedaços e termina com o tempo que levou", () => {
    const working = play(...BRIEF_DONE.slice(0, 3));
    expect(stepById(working, "brief").status).toBe("working");
    expect(stepById(working, "brief").text).toBe("Plano: ");

    const done = play(...BRIEF_DONE);
    expect(stepById(done, "brief")).toMatchObject({ status: "done", text: "Plano: 4 seções.", durationMs: 3200 });
  });

  it("vale a IA que o servidor decidiu para cada etapa", () => {
    const state = play(
      event({
        type: "run-started",
        stages: [
          { stageId: "brief", kind: "sequential", steps: [{ stepId: "brief", provider: "claude" }] },
          {
            stageId: "build",
            kind: "parallel",
            steps: [
              { stepId: "front", provider: "claude" },
              { stepId: "back", provider: "claude" },
              { stepId: "research", provider: "gemini" },
            ],
          },
          { stageId: "review", kind: "review", steps: [{ stepId: "review", provider: "claude" }] },
          { stageId: "final", kind: "sequential", steps: [{ stepId: "consolidate", provider: "gpt" }] },
        ],
      }),
    );

    expect(state.steps.map((step) => step.provider)).toEqual([
      "claude",
      "claude",
      "claude",
      "gemini",
      "claude",
      "gpt",
    ]);
  });

  it("numa fase em paralelo, várias etapas trabalham ao mesmo tempo", () => {
    const state = play(
      ...BRIEF_DONE,
      event({ type: "stage-started", stageId: "build", round: 1 }),
      event({ type: "step-started", stepId: "front", provider: "gpt" }),
      event({ type: "step-started", stepId: "back", provider: "claude" }),
      event({ type: "step-started", stepId: "research", provider: "gemini" }),
      event({ type: "step-text", stepId: "front", text: "<!DOCTYPE html>" }),
      event({ type: "step-text", stepId: "back", text: "Estrutura…" }),
    );

    expect(statuses(state)).toEqual([
      "brief done",
      "front working",
      "back working",
      "research working",
      "review waiting",
      "consolidate waiting",
    ]);
    expect(stepById(state, "front").text).toBe("<!DOCTYPE html>");
    expect(stepById(state, "back").text).toBe("Estrutura…");
  });

  it("quando a revisão manda refazer, a fase volta na rodada 2 e os cartões reiniciam", () => {
    const state = play(
      event({ type: "step-started", stepId: "front", provider: "gpt" }),
      event({ type: "step-text", stepId: "front", text: "rascunho 1" }),
      event({ type: "step-finished", stepId: "front", durationMs: 2000 }),
      event({ type: "review-result", stageId: "review", round: 1, approved: false }),
      // Rodada 2: a fase de construção roda de novo.
      event({ type: "stage-started", stageId: "build", round: 2 }),
      event({ type: "step-started", stepId: "front", provider: "gpt", round: 2 }),
    );

    expect(stepById(state, "front")).toMatchObject({ status: "working", text: "", round: 2 });
    expect(state.stages.find((stage) => stage.id === "build")?.round).toBe(2);
    expect(state.stages.find((stage) => stage.id === "review")?.approved).toBe(false);
  });

  it("quando a IA tenta de novo, o texto da tentativa que falhou some e a etapa mostra a tentativa", () => {
    const retrying = play(
      event({ type: "step-started", stepId: "front", provider: "gpt" }),
      event({ type: "step-text", stepId: "front", text: "<html><bo" }),
      event({ type: "step-retrying", stepId: "front", attempt: 2 }),
    );
    expect(stepById(retrying, "front")).toMatchObject({ status: "working", text: "", retryAttempt: 2, provider: "gpt" });

    const done = play(
      event({ type: "step-started", stepId: "front", provider: "gpt" }),
      event({ type: "step-retrying", stepId: "front", attempt: 2 }),
      event({ type: "step-text", stepId: "front", text: "<html></html>" }),
      event({ type: "step-finished", stepId: "front", durationMs: 4000 }),
    );
    expect(stepById(done, "front")).toMatchObject({ status: "done", text: "<html></html>", retryAttempt: undefined });
  });

  it("quando outra IA assume o papel, a etapa recomeça com ela, e as próximas etapas do papel também passam", () => {
    // O Chefe (Claude) falha no plano e o GPT assume; a consolidação, também do Chefe, já passa para o GPT.
    const state = play(
      event({ type: "step-started", stepId: "brief", provider: "claude" }),
      event({ type: "step-text", stepId: "brief", text: "Plano pela met" }),
      event({ type: "step-retrying", stepId: "brief", attempt: 3 }),
      event({ type: "step-switched", stepId: "brief", roleId: "chief", from: "claude", to: "gpt" }),
    );

    expect(stepById(state, "brief")).toMatchObject({
      provider: "gpt",
      replacedProvider: "claude",
      status: "working",
      text: "",
      retryAttempt: undefined,
    });
    // A revisão e a consolidação (ambas do chefe) ainda aguardam e passam para o GPT.
    expect(stepById(state, "review")).toMatchObject({ provider: "gpt", replacedProvider: "claude" });
    expect(stepById(state, "consolidate")).toMatchObject({ provider: "gpt", replacedProvider: "claude" });
    // Os outros papéis não mudam.
    expect(stepById(state, "front").replacedProvider).toBeUndefined();
  });

  it("quando o time termina, guarda o resultado final e o tempo total", () => {
    const state = play(...BRIEF_DONE, event({ type: "run-finished", result: "<!DOCTYPE html>", durationMs: 9000 }));

    expect(state.status).toBe("finished");
    expect(state.result).toBe("<!DOCTYPE html>");
    expect(state.durationMs).toBe(9000);
  });

  it("quando uma IA falha, marca a etapa, as concluídas continuam com o texto e as seguintes não começam", () => {
    const state = play(
      ...BRIEF_DONE,
      event({ type: "step-started", stepId: "front", provider: "gpt" }),
      event({ type: "step-text", stepId: "front", text: "<html>" }),
      event({ type: "run-failed", stepId: "front" }),
    );

    expect(state.status).toBe("failed");
    expect(stepById(state, "brief")).toMatchObject({ status: "done", text: "Plano: 4 seções." });
    expect(stepById(state, "front")).toMatchObject({ status: "failed", text: "<html>" });
    expect(stepById(state, "research").status).toBe("skipped");
  });

  it("ao cancelar, as etapas que trabalhavam ficam interrompidas e guardam o que já tinham escrito", () => {
    const state = play(
      ...BRIEF_DONE,
      event({ type: "step-started", stepId: "front", provider: "gpt" }),
      event({ type: "step-started", stepId: "back", provider: "claude" }),
      event({ type: "step-text", stepId: "front", text: "<html>" }),
      { type: "cancel" },
    );

    expect(state.status).toBe("cancelled");
    expect(stepById(state, "front")).toMatchObject({ status: "stopped", text: "<html>" });
    expect(stepById(state, "back").status).toBe("stopped");
    expect(stepById(state, "research").status).toBe("skipped");
  });

  it("se a narração acaba sem um evento de fim, a conexão caiu no meio", () => {
    const state = play(...BRIEF_DONE, { type: "stream-ended" });

    expect(state.status).toBe("interrupted");
    expect(stepById(state, "brief").status).toBe("done");
    expect(stepById(state, "front").status).toBe("skipped");
  });

  it("depois do fim, um pedaço de texto atrasado é ignorado", () => {
    const cancelled = play(BRIEF_DONE[1], { type: "cancel" });
    const late = runReducer(cancelled, event({ type: "step-text", stepId: "brief", text: "atrasado" }));

    expect(late).toBe(cancelled);
  });
});

describe("agrupamento por fase e documento vivo", () => {
  it("stagesOf agrupa as etapas por fase, na ordem, com o tipo e a rodada", () => {
    const state = play(event({ type: "stage-started", stageId: "build", round: 2 }));
    const stages = stagesOf(state);

    expect(stages.map((stage) => [stage.id, stage.kind, stage.round, stage.steps.map((s) => s.id)])).toEqual([
      ["brief", "sequential", 1, ["brief"]],
      ["build", "parallel", 2, ["front", "back", "research"]],
      ["review", "review", 1, ["review"]],
      ["final", "sequential", 1, ["consolidate"]],
    ]);
  });

  it("liveDocument junta o que cada etapa escreveu, só as partes que já têm texto", () => {
    const empty = liveDocument(createRunState(STAGES));
    expect(empty).toEqual({
      brief: undefined,
      front: undefined,
      back: undefined,
      research: undefined,
      reviewNotes: undefined,
    });

    const state = play(
      event({ type: "step-started", stepId: "brief", provider: "claude" }),
      event({ type: "step-text", stepId: "brief", text: "Plano do site." }),
      event({ type: "step-started", stepId: "research", provider: "gemini" }),
      event({ type: "step-text", stepId: "research", text: "Ideias de conteúdo." }),
    );

    expect(liveDocument(state)).toEqual({
      brief: "Plano do site.",
      front: undefined,
      back: undefined,
      research: "Ideias de conteúdo.",
      reviewNotes: undefined,
    });
  });
});

describe("site pronto", () => {
  // Fases que terminam com texto, para conferir o caso em que o resultado não é um site.
  const TEXT_ONLY: PlannedStageView[] = [
    parallelStage("brief", "sequential", [stepView("brief", "chief", "Chefe", "text", "claude")]),
  ];
  const SITE = "<!DOCTYPE html><title>Doce Encanto</title>";

  it("quando o time termina e a última etapa escreve HTML, o resultado é o site", () => {
    const state = runReducer(
      createRunState(STAGES),
      event({ type: "run-finished", result: SITE, durationMs: 1 }),
    );

    expect(finishedSite(state)).toBe(SITE);
  });

  it("não há site se o resultado final é texto ou se o time não terminou", () => {
    const textResult = runReducer(
      createRunState(TEXT_ONLY),
      event({ type: "run-finished", result: "Texto final.", durationMs: 1 }),
    );
    const cancelled = runReducer(createRunState(STAGES), { type: "cancel" });

    expect(finishedSite(textResult)).toBeNull();
    expect(finishedSite(cancelled)).toBeNull();
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

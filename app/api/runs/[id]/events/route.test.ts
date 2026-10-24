import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OwnRun, StoredEvent } from "@/lib/runs/store";
import { GET } from "./route";

// Quem está logado, o banco lido com a sessão e a retomada são dublês: a rota só decide o que pedir a cada um.

const RUN_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

const state = vi.hoisted(() => ({
  signedIn: true,
  run: null as OwnRun | null,
  events: [] as StoredEvent[],
}));
const resumeIfStalled = vi.hoisted(() => vi.fn(async () => {}));
const loadOwnEventsAfter = vi.hoisted(() => vi.fn(async () => state.events));

vi.mock("@/lib/auth/session", () => ({ signedInSession: async () => (state.signedIn ? {} : null) }));
vi.mock("@/lib/runs/resume", () => ({ resumeIfStalled }));
vi.mock("@/lib/runs/store", () => ({
  EVENTS_PAGE_SIZE: 2,
  loadOwnRun: async () => state.run,
  loadOwnEventsAfter,
}));

beforeEach(() => {
  state.signedIn = true;
  state.run = {
    id: RUN_ID,
    recipe_id: "create-site",
    status: "running",
    plan: [],
    cursor: { stageIndex: 0, round: 1 },
    result: null,
    duration_ms: null,
  };
  state.events = [{ seq: 3, event: { type: "step-text", stepId: "brief", text: "Plano" } }];
});

afterEach(() => {
  vi.clearAllMocks();
});

function get(id = RUN_ID, after = "2"): Promise<Response> {
  return GET(new Request(`http://localhost/api/runs/${id}/events?after=${after}`), {
    params: Promise.resolve({ id }),
  });
}

describe("rota GET /api/runs/[id]/events (novidades da narração)", () => {
  it("devolve as novidades depois da posição pedida e o status da execução", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "running", events: state.events, more: false });
    expect(loadOwnEventsAfter).toHaveBeenCalledWith(expect.anything(), RUN_ID, 2);
  });

  it("avisa quando há mais eventos esperando (replay comprido)", async () => {
    state.events = [
      { seq: 1, event: { type: "stage-started", stageId: "brief", round: 1 } },
      { seq: 2, event: { type: "step-started", stepId: "brief", provider: "claude" } },
    ];
    expect((await (await get()).json()).more).toBe(true);
  });

  it("execução em andamento: confere se parou no meio; execução que acabou, não", async () => {
    await get();
    expect(resumeIfStalled).toHaveBeenCalledWith(RUN_ID);

    resumeIfStalled.mockClear();
    state.run = { ...state.run!, status: "finished" };
    await get();
    expect(resumeIfStalled).not.toHaveBeenCalled();
  });

  it("sem login, recusa (401)", async () => {
    state.signedIn = false;
    expect((await get()).status).toBe(401);
  });

  it("execução de outra pessoa (o banco não devolve) ou id estranho: não encontrada (404)", async () => {
    state.run = null;
    expect((await get()).status).toBe(404);
    expect(loadOwnEventsAfter).not.toHaveBeenCalled();

    expect((await get("run-123")).status).toBe(404);
  });

  it("posição estranha vira o começo (replay inteiro)", async () => {
    await get(RUN_ID, "abc");
    expect(loadOwnEventsAfter).toHaveBeenCalledWith(expect.anything(), RUN_ID, 0);
  });
});

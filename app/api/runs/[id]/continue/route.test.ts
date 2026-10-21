import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveTeam } from "@/lib/engine/run";
import type { ProviderId } from "@/lib/providers/types";
import { getRecipe } from "@/lib/recipes/catalog";
import { SAMPLE_FINAL_SITE } from "@/lib/recipes/create-site.samples";
import type { PublicRunEvent } from "@/lib/runs/public-events";
import type { SnapshotPatch, StepRow } from "@/lib/runs/store";
import { POST } from "./route";

// Nada de rede: a IA simulada responde na hora, e o banco e o disparo são dublês em memória.

vi.mock("@/lib/providers/registry", async () => {
  const { createMockProvider } = await import("@/lib/providers/mock");
  const getProvider = (id: ProviderId) => createMockProvider({ id, chunkDelayMs: 0 });
  return { getProvider, createGetProvider: () => getProvider };
});

// Banco em memória: guarda o estado da execução e os eventos/etapas que a rota anexa.
const db = vi.hoisted(() => ({
  row: null as unknown as {
    id: string;
    recipe_id: string;
    request: string;
    team: Record<string, string>;
    cursor: { stageIndex: number; round: number };
    outputs: Record<string, string>;
    results: unknown[];
    status: string;
    result: string | null;
  },
  events: [] as PublicRunEvent[],
  steps: [] as StepRow[],
  finished: false,
  deletedSecret: false,
}));

const claimRun = vi.hoisted(() => vi.fn(async () => (db.finished ? null : { ...db.row })));
const triggerContinue = vi.hoisted(() => vi.fn());

vi.mock("@/lib/runs/store", () => ({
  claimRun,
  getSecret: async () => null,
  appendEvents: async (_id: string, events: PublicRunEvent[]) => {
    db.events.push(...events);
  },
  appendSteps: async (_id: string, rows: StepRow[]) => {
    db.steps.push(...rows);
  },
  saveSnapshot: async (_id: string, patch: SnapshotPatch) => {
    if (patch.outputs) db.row.outputs = patch.outputs;
    if (patch.results) db.row.results = patch.results;
    if (patch.team) db.row.team = patch.team as Record<string, string>;
    if (patch.cursor) db.row.cursor = patch.cursor;
  },
  setStatus: async (_id: string, status: string, extra: SnapshotPatch = {}) => {
    db.row.status = status;
    if (extra.result !== undefined) db.row.result = extra.result;
    if (status === "finished" || status === "failed" || status === "cancelled") db.finished = true;
  },
  deleteSecret: async () => {
    db.deletedSecret = true;
  },
  loadRun: async () => ({ ...db.row }),
}));

vi.mock("@/lib/runs/trigger", () => ({
  triggerContinue,
  originFromRequest: () => undefined,
}));

const SECRET = "test-internal-secret";
const RUN_ID = "run-abc";

beforeEach(() => {
  process.env.INTERNAL_RUN_SECRET = SECRET;
  const recipe = getRecipe("create-site")!;
  db.row = {
    id: RUN_ID,
    recipe_id: "create-site",
    request: "Quero um site para minha confeitaria.",
    team: resolveTeam(recipe),
    cursor: { stageIndex: 0, round: 1 },
    outputs: {},
    results: [],
    status: "running",
    result: null,
  };
  db.events = [];
  db.steps = [];
  db.finished = false;
  db.deletedSecret = false;
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.INTERNAL_RUN_SECRET;
});

/** Chama a rota interna uma vez, já com o segredo e o id na posição. */
function callContinue(secret = SECRET): Promise<Response> {
  const request = new Request(`http://localhost/api/runs/${RUN_ID}/continue`, {
    method: "POST",
    headers: { "x-internal-secret": secret },
  });
  return POST(request, { params: Promise.resolve({ id: RUN_ID }) });
}

/** Roda a corrente inteira: um segmento por chamada, até a execução terminar. */
async function runToEnd(): Promise<void> {
  let guard = 0;
  while (!db.finished && guard++ < 20) {
    const response = await callContinue();
    expect(response.status).toBe(200);
  }
}

describe("rota interna POST /api/runs/[id]/continue", () => {
  it("sem o segredo interno, recusa (401)", async () => {
    const response = await callContinue("errado");
    expect(response.status).toBe(401);
    expect(claimRun).not.toHaveBeenCalled();
  });

  it("quando não dá para reivindicar, não faz nada (200)", async () => {
    db.finished = true; // claimRun devolve null
    const response = await callContinue();
    expect(response.status).toBe(200);
    expect(db.events).toHaveLength(0);
  });

  it("roda a execução inteira em segmentos encadeados, persistindo eventos e terminando no site final", async () => {
    await runToEnd();

    // Começa com run-started e termina com o site final.
    expect(db.events[0]).toMatchObject({ type: "run-started" });
    expect(db.events.at(-1)).toEqual({
      type: "run-finished",
      result: SAMPLE_FINAL_SITE,
      durationMs: expect.any(Number),
    });

    // As etapas terminaram na ordem esperada.
    const finished = db.events.filter((event) => event.type === "step-finished");
    expect(finished.map((event) => event.stepId)).toEqual([
      "brief",
      "front",
      "back",
      "research",
      "review",
      "consolidate",
    ]);

    // Encadeou um disparo por segmento que não era o último (brief, build, review): 3 disparos.
    expect(triggerContinue).toHaveBeenCalledTimes(3);
    // Ao terminar, apagou as chaves e marcou o resultado final.
    expect(db.deletedSecret).toBe(true);
    expect(db.row.status).toBe("finished");
    expect(db.row.result).toBe(SAMPLE_FINAL_SITE);
  });

  it("o histórico interno de etapas guarda modelo e tokens, que NÃO aparecem nos eventos públicos", async () => {
    await runToEnd();

    expect(db.steps.length).toBe(6);
    for (const step of db.steps) {
      expect(typeof step.model).toBe("string");
      expect(typeof step.input_tokens).toBe("number");
      expect(step.status).toBe("done");
    }
    // Nada interno vaza para a narração pública.
    expect(JSON.stringify(db.events)).not.toMatch(/"(model|usage|inputTokens|outputTokens|errorMessage)"/);
  });
});

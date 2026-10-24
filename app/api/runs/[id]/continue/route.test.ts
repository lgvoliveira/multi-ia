import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveTeam } from "@/lib/engine/run";
import type { ProviderId } from "@/lib/providers/types";
import { getRecipe } from "@/lib/recipes/catalog";
import { SAMPLE_FINAL_SITE } from "@/lib/recipes/create-site.samples";
import { INTERNAL_SECRET_HEADER, internalRunSecret } from "@/lib/runs/internal-secret";
import type { PublicRunEvent } from "@/lib/runs/public-events";
import type { AiCallRow, RunStatus, SnapshotPatch } from "@/lib/runs/store";
import { POST } from "./route";

// Nada de rede: a IA simulada responde (na hora, ou devagar nos testes de cancelamento), e o banco e o disparo são
// dublês em memória.

const providerDelay = vi.hoisted(() => ({ ms: 0 }));

vi.mock("@/lib/providers/registry", async () => {
  const { createMockProvider } = await import("@/lib/providers/mock");
  return {
    getProvider: (id: ProviderId) => createMockProvider({ id, chunkDelayMs: providerDelay.ms }),
  };
});

// Banco em memória: guarda o estado da execução, a narração e as chamadas às IAs que a rota grava.
const db = vi.hoisted(() => ({
  row: null as unknown as {
    id: string;
    company_id: string;
    member_id: string;
    recipe_id: string;
    request: string;
    team: Record<string, string>;
    cursor: { stageIndex: number; round: number };
    outputs: Record<string, string>;
    results: unknown[];
    status: string;
    result: string | null;
    duration_ms: number | null;
    attempt: number;
    created_at: string;
    updated_at: string;
  },
  events: [] as PublicRunEvent[],
  eventCompanies: [] as string[],
  aiCalls: [] as AiCallRow[],
  finished: false,
}));

const claimRun = vi.hoisted(() => vi.fn(async () => (db.finished ? null : { ...db.row })));
const renewLease = vi.hoisted(() => vi.fn(async (): Promise<RunStatus | null> => "running"));
const setStatus = vi.hoisted(() =>
  vi.fn(async (_id: string, status: string, extra: SnapshotPatch = {}) => {
    db.row.status = status;
    if (extra.result !== undefined) db.row.result = extra.result;
    if (extra.duration_ms !== undefined) db.row.duration_ms = extra.duration_ms;
    if (status === "finished" || status === "failed" || status === "cancelled") db.finished = true;
  }),
);
const triggerContinue = vi.hoisted(() => vi.fn());

vi.mock("@/lib/runs/store", () => ({
  claimRun,
  renewLease,
  setStatus,
  appendEvents: async (run: { id: string; company_id: string }, events: PublicRunEvent[]) => {
    db.events.push(...events);
    db.eventCompanies.push(run.company_id);
  },
  recordAiCalls: async (rows: AiCallRow[]) => {
    db.aiCalls.push(...rows);
  },
  saveSnapshot: async (_id: string, patch: SnapshotPatch) => {
    if (patch.outputs) db.row.outputs = patch.outputs;
    if (patch.results) db.row.results = patch.results;
    if (patch.team) db.row.team = patch.team as Record<string, string>;
    if (patch.cursor) db.row.cursor = patch.cursor;
  },
  loadRun: async () => ({ ...db.row }),
}));

vi.mock("@/lib/runs/trigger", () => ({ triggerContinue }));

const RUN_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const COMPANY_ID = "c0000000-0000-4000-8000-000000000000";
const MEMBER_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  process.env.SUPABASE_SECRET_KEY = "sb_secret_de_teste";
  providerDelay.ms = 0;
  const recipe = getRecipe("create-site")!;
  db.row = {
    id: RUN_ID,
    company_id: COMPANY_ID,
    member_id: MEMBER_ID,
    recipe_id: "create-site",
    request: "Quero um site para minha confeitaria.",
    team: resolveTeam(recipe),
    cursor: { stageIndex: 0, round: 1 },
    outputs: {},
    results: [],
    status: "running",
    result: null,
    duration_ms: null,
    attempt: 1,
    // Pediu há 30 segundos; o banco marca a reivindicação (updated_at) agora.
    created_at: new Date(Date.now() - 30_000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  db.events = [];
  db.eventCompanies = [];
  db.aiCalls = [];
  db.finished = false;
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  delete process.env.SUPABASE_SECRET_KEY;
});

/** Chama a rota interna uma vez, já com o segredo e o id na posição. */
function callContinue(secret = internalRunSecret() ?? ""): Promise<Response> {
  const request = new Request(`http://localhost/api/runs/${RUN_ID}/continue`, {
    method: "POST",
    headers: { [INTERNAL_SECRET_HEADER]: secret },
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

/** O texto que a narração deixou para uma etapa (os pedaços, juntos). */
function narratedText(stepId: string): string {
  return db.events
    .filter((event): event is Extract<PublicRunEvent, { type: "step-text" }> => event.type === "step-text")
    .filter((event) => event.stepId === stepId)
    .map((event) => event.text)
    .join("");
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

  it("roda a execução inteira em segmentos encadeados, gravando a narração e terminando no site final", async () => {
    await runToEnd();

    // Começa com run-started e termina com o site final.
    expect(db.events[0]).toMatchObject({ type: "run-started" });
    expect(db.events.at(-1)).toEqual({
      type: "run-finished",
      result: SAMPLE_FINAL_SITE,
      durationMs: expect.any(Number),
    });
    // A narração vai com a empresa da execução.
    expect(new Set(db.eventCompanies)).toEqual(new Set([COMPANY_ID]));

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
    // O texto juntado na narração é o que a IA escreveu.
    expect(narratedText("consolidate")).toBe(SAMPLE_FINAL_SITE);

    // Encadeou um disparo por segmento que não era o último (brief, build, review): 3 disparos.
    expect(triggerContinue).toHaveBeenCalledTimes(3);
    expect(db.row.status).toBe("finished");
    expect(db.row.result).toBe(SAMPLE_FINAL_SITE);
  });

  it("o tempo do fim é o que a pessoa esperou desde que pediu, não só o da última fase", async () => {
    await runToEnd();

    const end = db.events.at(-1) as Extract<PublicRunEvent, { type: "run-finished" }>;
    expect(end.durationMs).toBeGreaterThanOrEqual(30_000);
    expect(db.row.duration_ms).toBe(end.durationMs);
  });

  it("cada etapa concluída vira uma chamada interna (modelo e tokens), que NÃO aparece na narração", async () => {
    await runToEnd();

    expect(db.aiCalls.map((call) => call.step_id)).toEqual([
      "brief",
      "front",
      "back",
      "research",
      "review",
      "consolidate",
    ]);
    for (const call of db.aiCalls) {
      expect(call).toMatchObject({ company_id: COMPANY_ID, member_id: MEMBER_ID, run_id: RUN_ID, status: "ok" });
      expect(call.model).toMatch(/^mock-/);
      expect(call.input_tokens).toBeGreaterThan(0);
    }
    // Nada interno vaza para a narração pública.
    expect(JSON.stringify(db.events)).not.toMatch(/"(model|usage|inputTokens|outputTokens|errorMessage)"/);
  });

  it("grava a narração aos poucos, enquanto a fase ainda roda (F35)", async () => {
    vi.useFakeTimers();
    providerDelay.ms = 200;

    const response = callContinue();
    await vi.advanceTimersByTimeAsync(1500);
    // A fase do chefe ainda não acabou, mas o texto dela já está no banco.
    expect(db.events.some((event) => event.type === "step-finished")).toBe(false);
    expect(narratedText("brief").length).toBeGreaterThan(0);

    await vi.runAllTimersAsync();
    expect((await response).status).toBe(200);
  });

  it("se a pessoa cancelou no meio da fase, para a IA, narra o cancelamento e não encadeia mais nada", async () => {
    vi.useFakeTimers();
    providerDelay.ms = 200;
    renewLease.mockResolvedValue("cancelled");

    const response = callContinue();
    await vi.advanceTimersByTimeAsync(10_000);
    expect((await response).status).toBe(200);

    expect(db.events.at(-1)).toEqual({ type: "run-cancelled", stepId: "brief" });
    expect(db.events.some((event) => event.type === "step-finished")).toBe(false);
    expect(db.row.status).toBe("cancelled");
    expect(triggerContinue).not.toHaveBeenCalled();
  });

  it("se outro servidor pegou a execução no meio, não grava mais nada deste segmento", async () => {
    vi.useFakeTimers();
    providerDelay.ms = 200;
    renewLease.mockResolvedValue(null);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = callContinue();
    await vi.advanceTimersByTimeAsync(10_000);
    expect((await response).status).toBe(500);

    expect(db.events.some((event) => event.type === "run-cancelled")).toBe(false);
    expect(setStatus).not.toHaveBeenCalled();
    expect(triggerContinue).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

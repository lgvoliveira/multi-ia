import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentMember } from "@/lib/auth/member";
import type { Viewer } from "@/lib/auth/viewer";
import { resolveTeam } from "@/lib/engine/run";
import { getRecipe } from "@/lib/recipes/catalog";
import { estimateCents, stepCosts } from "@/lib/runs/estimate";
import type { OwnRun } from "@/lib/runs/store";
import type { WalletRefusalReason } from "@/lib/runs/wallet";
import { POST } from "./route";

// Quem está logado, o banco, a carteira e o disparo são dublês: conferimos quem pode continuar, o que é reservado e a
// ordem das coisas (fechar a reserva antiga, reservar o que falta, narrar, voltar para a fila, disparar).

const RUN_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const ANA: CurrentMember = {
  id: "11111111-1111-4111-8111-111111111111",
  companyId: "c0000000-0000-4000-8000-000000000000",
  companyName: "Doce Encanto",
  name: "Ana Lima",
  email: "ana@example.com",
  role: "employee",
  mustChangePassword: false,
};
const recipe = getRecipe("create-site")!;
// Pausou depois do plano do Chefe: falta da 2ª fase em diante.
const CURSOR = { stageIndex: 1, round: 1 };
const NEEDED = estimateCents(stepCosts(recipe, CURSOR), resolveTeam(recipe));

const state = vi.hoisted(() => ({
  viewer: { status: "signed-out" } as Viewer,
  run: null as OwnRun | null,
  /** Se outro clique em "Continuar" já segura a execução. */
  locked: false,
  /** Se a pessoa cancelou enquanto a reserva era feita. */
  cancelledMeanwhile: false,
}));
const calls = vi.hoisted(() => [] as string[]);
// A linha que ele devolve depende da receita (o time recomendado): montada no beforeEach.
const lockPausedRun = vi.hoisted(() => vi.fn());
const unlockPausedRun = vi.hoisted(() => vi.fn(async () => void calls.push("unlock")));
const requeuePausedRun = vi.hoisted(() =>
  vi.fn(async () => {
    calls.push("requeue");
    return !state.cancelledMeanwhile;
  }),
);
const appendEvents = vi.hoisted(() => vi.fn(async () => void calls.push("narrate")));
const closeRunHolds = vi.hoisted(() => vi.fn(async () => void calls.push("close")));
const reserveForRun = vi.hoisted(() =>
  vi.fn(async (memberId: string, runId: string, amountCents: number) => {
    void memberId;
    void runId;
    void amountCents;
    calls.push("reserve");
    return "hold-2";
  }),
);
const triggerContinue = vi.hoisted(() => vi.fn(() => void calls.push("trigger")));

vi.mock("@/lib/auth/viewer", () => ({ getViewer: async () => state.viewer }));
vi.mock("@/lib/auth/session", () => ({ createSessionClient: async () => ({}) }));
vi.mock("@/lib/runs/store", () => ({
  loadOwnRun: async () => state.run,
  lockPausedRun,
  unlockPausedRun,
  requeuePausedRun,
  appendEvents,
}));
vi.mock("@/lib/runs/wallet", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/runs/wallet")>()),
  closeRunHolds,
  reserveForRun,
}));
vi.mock("@/lib/runs/trigger", () => ({ triggerContinue }));

beforeEach(() => {
  state.viewer = { status: "member", member: ANA };
  state.run = {
    id: RUN_ID,
    recipe_id: "create-site",
    request: "Um site para a confeitaria.",
    status: "paused",
    plan: [],
    cursor: CURSOR,
    result: null,
    duration_ms: null,
    estimate_cents: 531,
  };
  state.locked = false;
  state.cancelledMeanwhile = false;
  calls.length = 0;
  // Só o que a rota usa da linha: o cursor e o time (o recomendado).
  lockPausedRun.mockImplementation(async (id: string) => {
    calls.push("lock");
    if (state.locked) return null;
    return { id, company_id: ANA.companyId, cursor: CURSOR, team: resolveTeam(recipe) };
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

function post(body: unknown = { pageMemberId: ANA.id }, contentType = "application/json"): Promise<Response> {
  return POST(
    new Request(`http://localhost/api/runs/${RUN_ID}/resume`, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: RUN_ID }) },
  );
}

async function refuseNextReserve(reason: WalletRefusalReason): Promise<void> {
  const { WalletRefusedError } = await import("@/lib/runs/wallet");
  reserveForRun.mockImplementationOnce(async () => {
    calls.push("reserve");
    throw new WalletRefusedError(reason);
  });
}

describe("rota POST /api/runs/[id]/resume (Continuar depois da pausa)", () => {
  it("fecha a reserva antiga, reserva o máximo do que falta, narra a volta e põe o time para trabalhar", async () => {
    const response = await post();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "queued" });

    expect(reserveForRun).toHaveBeenCalledWith(ANA.id, RUN_ID, NEEDED);
    expect(appendEvents).toHaveBeenCalledWith(expect.objectContaining({ id: RUN_ID }), [{ type: "run-resumed" }]);
    expect(triggerContinue).toHaveBeenCalledWith(RUN_ID);
    // A narração vai antes de a execução voltar para a fila (a tela confia nessa ordem).
    expect(calls).toEqual(["lock", "close", "reserve", "narrate", "requeue", "trigger"]);
  });

  it("sem saldo para o que falta: continua pausada e diz o que fazer (402)", async () => {
    await refuseNextReserve("insufficient_balance");
    const response = await post();

    expect(response.status).toBe(402);
    expect((await response.json()).problems[0]).toContain("Peça ao dono da empresa para colocar crédito.");
    expect(calls).toEqual(["lock", "close", "reserve", "unlock"]);
    expect(triggerContinue).not.toHaveBeenCalled();
  });

  it("passando do teto do mês: continua pausada e diz para pedir ao dono que aumente o teto (402)", async () => {
    await refuseNextReserve("monthly_budget_exceeded");
    const response = await post();
    expect(response.status).toBe(402);
    expect((await response.json()).problems[0]).toContain("aumentar o seu teto");
    expect(unlockPausedRun).toHaveBeenCalled();
  });

  it("dois cliques ao mesmo tempo: só um reserva", async () => {
    state.locked = true;
    const response = await post();
    expect(await response.json()).toEqual({ status: "paused" });
    expect(reserveForRun).not.toHaveBeenCalled();
  });

  it("se a pessoa cancelou enquanto a reserva era feita, a reserva nova volta ao saldo e nada roda", async () => {
    state.cancelledMeanwhile = true;
    const response = await post();
    expect(await response.json()).toEqual({ status: "cancelled" });
    expect(calls).toEqual(["lock", "close", "reserve", "narrate", "requeue", "close"]);
    expect(triggerContinue).not.toHaveBeenCalled();
  });

  it("execução que não está pausada: devolve o status, sem mexer em nada", async () => {
    state.run = { ...state.run!, status: "running" };
    expect(await (await post()).json()).toEqual({ status: "running" });
    expect(lockPausedRun).not.toHaveBeenCalled();
  });

  it("de outra pessoa (o banco não devolve), com o login trocado (409), sem login (401) ou sem JSON: nada muda", async () => {
    const paused = state.run;
    state.run = null;
    expect((await post()).status).toBe(404);

    state.run = paused;
    state.viewer = { status: "member", member: { ...ANA, id: "22222222-2222-4222-8222-222222222222", name: "Bruno" } };
    const other = await post();
    expect(other.status).toBe(409);
    expect((await other.json()).problems[0]).toContain("quem está conectado agora é Bruno");

    state.viewer = { status: "signed-out" };
    expect((await post()).status).toBe(401);

    state.viewer = { status: "member", member: ANA };
    expect((await post({ pageMemberId: ANA.id }, "text/plain")).status).toBe(415);
    expect(reserveForRun).not.toHaveBeenCalled();
  });
});

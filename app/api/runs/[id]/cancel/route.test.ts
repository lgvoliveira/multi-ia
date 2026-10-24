import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentMember } from "@/lib/auth/member";
import type { Viewer } from "@/lib/auth/viewer";
import type { OwnRun } from "@/lib/runs/store";
import { POST } from "./route";

// Quem está logado e o banco são dublês: conferimos quem pode cancelar e o que a rota grava.

const RUN_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const ANA: CurrentMember = {
  id: "11111111-1111-4111-8111-111111111111",
  companyId: "c0000000-0000-4000-8000-000000000000",
  companyName: "Doce Encanto",
  name: "Ana Lima",
  email: "ana@example.com",
  role: "employee",
};

const state = vi.hoisted(() => ({
  viewer: { status: "signed-out" } as Viewer,
  run: null as OwnRun | null,
  cancelled: true,
}));
const appendEvents = vi.hoisted(() => vi.fn(async () => {}));
const cancelRun = vi.hoisted(() => vi.fn(async () => state.cancelled));

vi.mock("@/lib/auth/viewer", () => ({ getViewer: async () => state.viewer }));
vi.mock("@/lib/auth/session", () => ({ createSessionClient: async () => ({}) }));
vi.mock("@/lib/runs/store", () => ({
  FINAL_STATUSES: ["finished", "failed", "cancelled"],
  loadOwnRun: async () => state.run,
  cancelRun,
  appendEvents,
}));

beforeEach(() => {
  state.viewer = { status: "member", member: ANA };
  state.run = {
    id: RUN_ID,
    recipe_id: "create-site",
    status: "running",
    plan: [],
    cursor: { stageIndex: 1, round: 1 },
    result: null,
    duration_ms: null,
  };
  state.cancelled = true;
});

afterEach(() => {
  vi.clearAllMocks();
});

function post(body: unknown = { pageMemberId: ANA.id }, contentType = "application/json"): Promise<Response> {
  return POST(
    new Request(`http://localhost/api/runs/${RUN_ID}/cancel`, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: RUN_ID }) },
  );
}

describe("rota POST /api/runs/[id]/cancel", () => {
  it("quem começou cancela: marca cancelada e narra o cancelamento na etapa em que estava", async () => {
    const response = await post();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "cancelled" });
    expect(cancelRun).toHaveBeenCalledWith(RUN_ID);
    // A fase 2 da receita (build) começa pelo Front-end.
    expect(appendEvents).toHaveBeenCalledWith({ id: RUN_ID, company_id: ANA.companyId }, [
      { type: "run-cancelled", stepId: "front" },
    ]);
  });

  it("execução de outra pessoa (o banco não devolve pela sessão): não encontrada, nada muda", async () => {
    state.run = null;
    expect((await post()).status).toBe(404);
    expect(cancelRun).not.toHaveBeenCalled();
  });

  it("execução que já acabou: devolve o status, sem mexer em nada", async () => {
    state.run = { ...state.run!, status: "finished" };
    const response = await post();
    expect(await response.json()).toEqual({ status: "finished" });
    expect(cancelRun).not.toHaveBeenCalled();
  });

  it("se ela acabou bem na hora, não narra um cancelamento que não houve", async () => {
    state.cancelled = false;
    await post();
    expect(appendEvents).not.toHaveBeenCalled();
  });

  it("com o login trocado em outra aba (409) ou sem login (401), não cancela e explica", async () => {
    state.viewer = { status: "member", member: { ...ANA, id: "22222222-2222-4222-8222-222222222222", name: "Bruno" } };
    const other = await post();
    expect(other.status).toBe(409);
    expect((await other.json()).problems[0]).toContain("quem está conectado agora é Bruno");

    state.viewer = { status: "signed-out" };
    expect((await post()).status).toBe(401);
    expect(cancelRun).not.toHaveBeenCalled();
  });

  it("só aceita JSON", async () => {
    expect((await post({ pageMemberId: ANA.id }, "text/plain")).status).toBe(415);
    expect(cancelRun).not.toHaveBeenCalled();
  });
});

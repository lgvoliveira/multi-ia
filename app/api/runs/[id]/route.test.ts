import { describe, expect, it, vi } from "vitest";
import type { OwnRun } from "@/lib/runs/store";
import { GET } from "./route";

// O resumo da execução, lido com a sessão de quem está logado (dublê).

const RUN_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const state = vi.hoisted(() => ({ signedIn: true, run: null as OwnRun | null }));

vi.mock("@/lib/auth/session", () => ({ signedInSession: async () => (state.signedIn ? {} : null) }));
vi.mock("@/lib/runs/store", () => ({ loadOwnRun: async () => state.run }));

function get(id = RUN_ID): Promise<Response> {
  return GET(new Request(`http://localhost/api/runs/${id}`), { params: Promise.resolve({ id }) });
}

describe("rota GET /api/runs/[id] (resumo da execução)", () => {
  it("devolve só o que a pessoa pode ver: status, plano, resultado e tempo", async () => {
    state.signedIn = true;
    state.run = {
      id: RUN_ID,
      recipe_id: "create-site",
      status: "finished",
      plan: [],
      cursor: { stageIndex: 4, round: 1 },
      result: "<html></html>",
      duration_ms: 26_000,
    };
    const response = await get();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "finished", plan: [], result: "<html></html>", durationMs: 26_000 });
  });

  it("sem login, 401; de outra pessoa ou com id estranho, 404", async () => {
    state.signedIn = false;
    expect((await get()).status).toBe(401);

    state.signedIn = true;
    state.run = null;
    expect((await get()).status).toBe(404);
    expect((await get("nao-e-um-id")).status).toBe(404);
  });
});

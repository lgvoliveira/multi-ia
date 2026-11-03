import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentMember } from "@/lib/auth/member";
import type { Viewer } from "@/lib/auth/viewer";
import type { QuickTaskRequest, QuickTaskResult } from "@/lib/ock/run-task";
import { POST } from "./route";

// A rota do chat confere quem pede e o que veio, e passa a mensagem adiante (lib/ock/run-task.ts, testado à parte).

const state = vi.hoisted(() => ({
  viewer: { status: "signed-out" } as Viewer,
  outcome: null as QuickTaskResult | null,
  calls: [] as { me: CurrentMember; request: QuickTaskRequest }[],
}));

vi.mock("@/lib/auth/viewer", () => ({ getViewer: async () => state.viewer }));
vi.mock("@/lib/auth/session", () => ({ signedInSession: async () => ({}) }));
vi.mock("@/lib/ock/run-task", () => ({
  runQuickTask: async (me: CurrentMember, _session: unknown, request: QuickTaskRequest) => {
    state.calls.push({ me, request });
    if (!state.outcome) throw new Error("banco fora do ar");
    return state.outcome;
  },
}));

const CARLA: CurrentMember = {
  id: "11111111-1111-4111-8111-111111111111",
  companyId: "c0000000-0000-4000-8000-000000000000",
  companyName: "Doce Encanto",
  name: "Carla Dias",
  email: "carla@example.com",
  role: "employee",
  mustChangePassword: false,
};

function post(body: unknown, contentType = "application/json"): Promise<Response> {
  return POST(
    new Request("http://localhost/api/ock", {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

async function problem(response: Response): Promise<string> {
  return ((await response.json()) as { problem: string }).problem;
}

beforeEach(() => {
  state.viewer = { status: "member", member: CARLA };
  state.outcome = { ok: false, status: 402, problem: "sem saldo" };
  state.calls = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rota POST /api/ock (mensagem do chat)", () => {
  it("passa a mensagem em nome de quem está logado e devolve a resposta", async () => {
    const result = { conversation: { id: "c1" }, task: { id: "t1" }, month: { spentCents: 1, budgetCents: null } };
    state.outcome = { ok: true, result: result as never };
    const response = await post({ message: " Oi ", pageMemberId: CARLA.id, memberId: "outra-pessoa" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    // Quem pede vem do login: um memberId no corpo é ignorado.
    expect(state.calls).toEqual([{ me: CARLA, request: { message: "Oi", conversationId: null, fileIds: [] } }]);
  });

  it("a recusa da carteira volta com o status e a mensagem", async () => {
    const response = await post({ message: "Oi", pageMemberId: CARLA.id });
    expect(response.status).toBe(402);
    expect(await problem(response)).toBe("sem saldo");
  });

  it("sem login, 401; desativado, 403; e nada é feito", async () => {
    state.viewer = { status: "signed-out" };
    expect((await post({ message: "Oi", pageMemberId: CARLA.id })).status).toBe(401);
    state.viewer = { status: "disabled" };
    expect((await post({ message: "Oi", pageMemberId: CARLA.id })).status).toBe(403);
    expect(state.calls).toEqual([]);
  });

  it("com outra conta conectada em outra aba (ou sem dizer quem abriu a página), 409 e nada é feito (F34)", async () => {
    state.viewer = { status: "member", member: { ...CARLA, id: "22222222-2222-4222-8222-222222222222", name: "Bruno" } };
    const response = await post({ message: "Oi", pageMemberId: CARLA.id });
    expect(response.status).toBe(409);
    expect(await problem(response)).toContain("quem está conectado agora é Bruno");

    state.viewer = { status: "member", member: CARLA };
    expect((await post({ message: "Oi" })).status).toBe(409);
    expect(state.calls).toEqual([]);
  });

  it("só aceita JSON, de até 64 KB, e confere a mensagem", async () => {
    expect((await post("message=Oi", "application/x-www-form-urlencoded")).status).toBe(415);
    expect((await post("{quebrado", "application/json")).status).toBe(400);
    expect((await post("x".repeat(70_000))).status).toBe(413);
    const long = await post({ message: "a".repeat(4001), pageMemberId: CARLA.id });
    expect(long.status).toBe(400);
    expect(await problem(long)).toContain("4.000 caracteres");
    expect(state.calls).toEqual([]);
  });

  it("erro inesperado vira 500, sem detalhes técnicos", async () => {
    state.outcome = null;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await post({ message: "Oi", pageMemberId: CARLA.id });
    expect(response.status).toBe(500);
    expect(await problem(response)).not.toContain("banco");
  });
});

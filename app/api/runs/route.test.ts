import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentMember } from "@/lib/auth/member";
import type { Viewer } from "@/lib/auth/viewer";
import { POST } from "./route";

// A rota de criação não roda nada nem fala com a rede: só cria a execução e dispara o 1º segmento.
// Trocamos quem está logado, o store (banco) e o disparo por dublês, e conferimos o que a rota pede a cada um.

const createRun = vi.hoisted(() =>
  vi.fn((run: Record<string, unknown>): Promise<string> => {
    void run;
    return Promise.resolve("run-generated");
  }),
);
const triggerContinue = vi.hoisted(() => vi.fn());
const viewer = vi.hoisted(() => ({ current: { status: "signed-out" } as Viewer }));

vi.mock("@/lib/runs/store", () => ({ createRun }));
vi.mock("@/lib/runs/trigger", () => ({ triggerContinue }));
vi.mock("@/lib/auth/viewer", () => ({ getViewer: async () => viewer.current }));

const ANA: CurrentMember = {
  id: "11111111-1111-4111-8111-111111111111",
  companyId: "c0000000-0000-4000-8000-000000000000",
  companyName: "Doce Encanto",
  name: "Ana Lima",
  email: "ana@example.com",
  role: "employee",
};

beforeEach(() => {
  viewer.current = { status: "member", member: ANA };
});

afterEach(() => {
  vi.clearAllMocks();
});

const BODY = { recipeId: "create-site", request: "Quero um site para minha confeitaria.", pageMemberId: ANA.id };

function post(body: string, contentType = "application/json"): Promise<Response> {
  return POST(
    new Request("http://localhost/api/runs", {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
    }),
  );
}

describe("rota POST /api/runs (cria a execução persistida)", () => {
  it("cria a execução na fila, em nome da empresa e da pessoa logada, e devolve o id (201)", async () => {
    const response = await post(JSON.stringify({ ...BODY, team: { frontend: "claude" } }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ runId: "run-generated" });

    expect(createRun).toHaveBeenCalledTimes(1);
    expect(createRun).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: ANA.companyId,
        member_id: ANA.id,
        recipe_id: "create-site",
        request: "Quero um site para minha confeitaria.",
        team: expect.objectContaining({ frontend: "claude" }),
      }),
    );
    // O plano tem as 4 fases da receita, cada etapa com a IA decidida.
    const { plan } = createRun.mock.calls[0][0] as { plan: { stageId: string }[] };
    expect(plan.map((stage) => stage.stageId)).toEqual(["brief", "build", "review", "final"]);

    // Dispara o 1º segmento.
    expect(triggerContinue).toHaveBeenCalledWith("run-generated");
  });

  it("a empresa e a pessoa vêm do login, nunca do pedido", async () => {
    await post(JSON.stringify({ ...BODY, company_id: "outra-empresa", member_id: "outra-pessoa" }));
    expect(createRun).toHaveBeenCalledWith(expect.objectContaining({ company_id: ANA.companyId, member_id: ANA.id }));
  });

  it("sem ninguém conectado, recusa (401) e não cria nada", async () => {
    viewer.current = { status: "signed-out" };
    const response = await post(JSON.stringify(BODY));
    expect(response.status).toBe(401);
    expect((await response.json()).problems[0]).toContain("não está mais conectada");
    expect(createRun).not.toHaveBeenCalled();
  });

  it("quem foi desativado não começa execução (403)", async () => {
    viewer.current = { status: "disabled" };
    const response = await post(JSON.stringify(BODY));
    expect(response.status).toBe(403);
    expect(createRun).not.toHaveBeenCalled();
  });

  it("com o login trocado em outra aba, não faz nada e diz quem está conectado agora (409)", async () => {
    viewer.current = {
      status: "member",
      member: { ...ANA, id: "22222222-2222-4222-8222-222222222222", name: "Bruno Teste" },
    };
    const response = await post(JSON.stringify(BODY));
    expect(response.status).toBe(409);
    expect((await response.json()).problems[0]).toContain("quem está conectado agora é Bruno Teste");
    expect(createRun).not.toHaveBeenCalled();
    expect(triggerContinue).not.toHaveBeenCalled();
  });

  it("recusa pedido inválido na hora, com a mensagem em português", async () => {
    const response = await post(JSON.stringify({ ...BODY, request: "   " }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ problems: ["Escreva o que você quer que o time faça."] });
    expect(createRun).not.toHaveBeenCalled();
  });

  it("recusa o pedido grande demais", async () => {
    const response = await post(JSON.stringify({ ...BODY, request: "a".repeat(4001) }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      problems: ["O pedido passou do limite de 4.000 caracteres (tem 4.001)."],
    });
  });

  it("recusa o que não chega como JSON", async () => {
    const notJson = await post(JSON.stringify(BODY), "text/plain");
    expect(notJson.status).toBe(415);
    expect(await notJson.json()).toEqual({ problems: ["Formato de pedido não aceito."] });

    const broken = await post("{ isto não é JSON");
    expect(broken.status).toBe(400);
    expect(await broken.json()).toEqual({ problems: ["Não entendemos o pedido enviado."] });
  });

  it("recusa corpo grande demais", async () => {
    const response = await post(JSON.stringify({ ...BODY, request: "a".repeat(70_000) }));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ problems: ["O pedido é grande demais."] });
  });

  it("se o banco falhar ao criar, responde um erro simples (500) e não dispara nada", async () => {
    createRun.mockRejectedValueOnce(new Error("sem conexão"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await post(JSON.stringify(BODY));
    expect(response.status).toBe(500);
    expect(triggerContinue).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

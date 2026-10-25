import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentMember } from "@/lib/auth/member";
import type { Viewer } from "@/lib/auth/viewer";
import { resolveTeam } from "@/lib/engine/run";
import { getRecipe } from "@/lib/recipes/catalog";
import { estimateCents, stepCosts } from "@/lib/runs/estimate";
import type { WalletRefusalReason } from "@/lib/runs/wallet";
import { POST } from "./route";

// A rota de criação não roda nada nem fala com a rede: reserva a estimativa, cria a execução e dispara o 1º segmento.
// Trocamos quem está logado, o store (banco), a carteira e o disparo por dublês, e conferimos o que a rota pede a cada um.

const createRun = vi.hoisted(() =>
  vi.fn((run: { id: string }): Promise<string> => Promise.resolve(run.id)),
);
const reserveForRun = vi.hoisted(() =>
  vi.fn(async (memberId: string, runId: string, amountCents: number): Promise<string> => {
    void memberId;
    void runId;
    void amountCents;
    return "hold-1";
  }),
);
const closeRunHolds = vi.hoisted(() => vi.fn(async (runId: string) => void runId));
const triggerContinue = vi.hoisted(() => vi.fn());
const viewer = vi.hoisted(() => ({ current: { status: "signed-out" } as Viewer }));

vi.mock("@/lib/runs/store", () => ({ createRun }));
vi.mock("@/lib/runs/trigger", () => ({ triggerContinue }));
vi.mock("@/lib/auth/viewer", () => ({ getViewer: async () => viewer.current }));
vi.mock("@/lib/runs/wallet", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/runs/wallet")>()),
  reserveForRun,
  closeRunHolds,
}));

/** A carteira recusa a próxima reserva, como o banco faria. */
async function refuseNextReserve(reason: WalletRefusalReason): Promise<void> {
  const { WalletRefusedError } = await import("@/lib/runs/wallet");
  reserveForRun.mockRejectedValueOnce(new WalletRefusedError(reason));
}

const recipe = getRecipe("create-site")!;

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
  it("reserva a estimativa, cria a execução na fila em nome de quem está logado e devolve o id (201)", async () => {
    const response = await post(JSON.stringify({ ...BODY, team: { frontend: "claude" } }));

    expect(response.status).toBe(201);
    const { runId } = (await response.json()) as { runId: string };
    expect(runId).toMatch(/^[0-9a-f-]{36}$/);

    // A estimativa é calculada no servidor, com o time escolhido, e reservada ANTES de criar a execução, já com o id.
    const estimate = estimateCents(stepCosts(recipe), resolveTeam(recipe, { frontend: "claude" }));
    expect(reserveForRun).toHaveBeenCalledWith(ANA.id, runId, estimate);
    expect(reserveForRun.mock.invocationCallOrder[0]).toBeLessThan(createRun.mock.invocationCallOrder[0]);

    expect(createRun).toHaveBeenCalledTimes(1);
    expect(createRun).toHaveBeenCalledWith(
      expect.objectContaining({
        id: runId,
        company_id: ANA.companyId,
        member_id: ANA.id,
        recipe_id: "create-site",
        request: "Quero um site para minha confeitaria.",
        team: expect.objectContaining({ frontend: "claude" }),
        estimate_cents: estimate,
      }),
    );
    // O plano tem as 4 fases da receita, cada etapa com a IA decidida.
    const { plan } = createRun.mock.calls[0][0] as unknown as { plan: { stageId: string }[] };
    expect(plan.map((stage) => stage.stageId)).toEqual(["brief", "build", "review", "final"]);

    // Dispara o 1º segmento.
    expect(triggerContinue).toHaveBeenCalledWith(runId);
  });

  it("um número de estimativa vindo do navegador é ignorado", async () => {
    await post(JSON.stringify({ ...BODY, estimateCents: 1, estimate_cents: 1 }));
    const estimate = estimateCents(stepCosts(recipe), resolveTeam(recipe));
    expect(reserveForRun).toHaveBeenCalledWith(ANA.id, expect.any(String), estimate);
  });

  it("sem saldo na empresa, não começa e diz ao funcionário para pedir crédito ao dono (402)", async () => {
    await refuseNextReserve("insufficient_balance");
    const response = await post(JSON.stringify(BODY));

    expect(response.status).toBe(402);
    const [problem] = ((await response.json()) as { problems: string[] }).problems;
    expect(problem).toContain("A empresa não tem saldo para reservar R$");
    expect(problem).toContain("Peça ao dono da empresa para colocar crédito.");
    expect(createRun).not.toHaveBeenCalled();
    expect(triggerContinue).not.toHaveBeenCalled();
  });

  it("sem saldo, o dono lê que deve falar com a nossa equipe", async () => {
    viewer.current = { status: "member", member: { ...ANA, role: "owner" } };
    await refuseNextReserve("insufficient_balance");
    const response = await post(JSON.stringify(BODY));
    expect(((await response.json()) as { problems: string[] }).problems[0]).toContain("fale com a nossa equipe");
  });

  it("passando do teto do mês, não começa e diz para pedir ao dono que aumente o teto (402)", async () => {
    await refuseNextReserve("monthly_budget_exceeded");
    const response = await post(JSON.stringify(BODY));

    expect(response.status).toBe(402);
    expect(((await response.json()) as { problems: string[] }).problems[0]).toContain(
      "passaria do seu teto do mês. Peça ao dono da empresa para aumentar o seu teto.",
    );
    expect(createRun).not.toHaveBeenCalled();
  });

  it("se a execução não pôde ser criada, a reserva volta ao saldo", async () => {
    createRun.mockRejectedValueOnce(new Error("sem conexão"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await post(JSON.stringify(BODY));
    expect(response.status).toBe(500);
    const [[, runId]] = reserveForRun.mock.calls;
    expect(closeRunHolds).toHaveBeenCalledWith(runId);
    expect(triggerContinue).not.toHaveBeenCalled();
    error.mockRestore();
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
    expect(reserveForRun).not.toHaveBeenCalled();
    expect(createRun).not.toHaveBeenCalled();
    expect(triggerContinue).not.toHaveBeenCalled();
  });

  it("recusa pedido inválido na hora, com a mensagem em português", async () => {
    const response = await post(JSON.stringify({ ...BODY, request: "   " }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ problems: ["Escreva o que você quer que o time faça."] });
    expect(reserveForRun).not.toHaveBeenCalled();
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

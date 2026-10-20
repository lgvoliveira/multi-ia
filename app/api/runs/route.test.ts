import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// A rota de criação não roda nada nem fala com a rede: só cria a execução e dispara o 1º segmento.
// Trocamos o store (banco) e o disparo por dublês, e conferimos o que a rota pede a cada um.

const createRun = vi.hoisted(() => vi.fn((run: Record<string, unknown>): Promise<string> => {
  void run;
  return Promise.resolve("run-generated");
}));
const saveSecret = vi.hoisted(() => vi.fn((id: string, blob: string): Promise<void> => {
  void id;
  void blob;
  return Promise.resolve();
}));
const triggerContinue = vi.hoisted(() => vi.fn());

vi.mock("@/lib/runs/store", () => ({ createRun, saveSecret }));
vi.mock("@/lib/runs/trigger", () => ({ triggerContinue, originFromRequest: () => undefined }));

beforeEach(() => {
  // encryptKeys precisa de uma chave secreta válida (hex de 32 bytes). Valor só de teste.
  process.env.RUN_KEY_SECRET = "1".repeat(64);
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.RUN_KEY_SECRET;
});

const BODY = { recipeId: "create-site", request: "Quero um site para minha confeitaria.", ownerToken: "token-dono" };

function post(body: string, contentType = "application/json"): Promise<Response> {
  return POST(
    new Request("http://localhost/api/runs", {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
    }),
  );
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("rota POST /api/runs (cria a execução persistida)", () => {
  it("cria a execução na fila, com o time e o plano, e devolve o id (201)", async () => {
    const response = await post(JSON.stringify({ ...BODY, team: { frontend: "claude" } }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ runId: "run-generated" });

    expect(createRun).toHaveBeenCalledTimes(1);
    expect(createRun).toHaveBeenCalledWith(
      expect.objectContaining({
        recipe_id: "create-site",
        request: "Quero um site para minha confeitaria.",
        owner_token: sha256("token-dono"),
        team: expect.objectContaining({ frontend: "claude" }),
      }),
    );
    // O plano tem as 4 fases da receita, cada etapa com a IA decidida.
    const { plan } = createRun.mock.calls[0][0] as { plan: { stageId: string }[] };
    expect(plan.map((stage) => stage.stageId)).toEqual(["brief", "build", "review", "final"]);

    // Dispara o 1º segmento.
    expect(triggerContinue).toHaveBeenCalledWith("run-generated", undefined);
  });

  it("guarda as chaves do usuário (criptografadas) quando ele conectou alguma", async () => {
    await post(JSON.stringify({ ...BODY, keys: { claude: "sk-ant-abc" } }));

    expect(saveSecret).toHaveBeenCalledTimes(1);
    const [id, blob] = saveSecret.mock.calls[0];
    expect(id).toBe("run-generated");
    expect(typeof blob).toBe("string");
    // O blob guardado não deixa a chave à mostra.
    expect(blob).not.toContain("sk-ant-abc");
  });

  it("sem chaves conectadas, não guarda segredo nenhum", async () => {
    await post(JSON.stringify(BODY));
    expect(saveSecret).not.toHaveBeenCalled();
    expect(createRun).toHaveBeenCalledTimes(1);
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

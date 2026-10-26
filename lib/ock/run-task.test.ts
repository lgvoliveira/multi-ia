import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentMember } from "@/lib/auth/member";
import { createMockProvider } from "@/lib/providers/mock";
import { createGetProvider } from "@/lib/providers/registry";
import type { AiProvider, GenerateRequest, ProviderId } from "@/lib/providers/types";
import type { AiCallRow } from "@/lib/runs/store";
import type { WalletRefusalReason } from "@/lib/runs/wallet";
import type { ChatConversation } from "./chat";
import type { FileRow } from "./files";
import { AI_FAILED, IMAGE_UNAVAILABLE } from "./quick-task";
import { runQuickTask, type QuickTaskOptions } from "./run-task";
import type { TaskRow } from "./task-store";

// Uma mensagem do chat do começo ao fim, com o banco, a pasta de arquivos e a carteira trocados por dublês, e a IA
// simulada respondendo na hora. Conferimos o que acontece com o dinheiro, com as tabelas e com o registro interno.

const db = vi.hoisted(() => ({
  holds: [] as { id: string; amountCents: number; taskId: string }[],
  closed: [] as string[],
  charges: [] as { holdId: string; taskId: string; amountCents: number; description: string; provider: string }[],
  /** A próxima reserva: recusada com este motivo, ou aceita (null ou fila vazia). */
  refusals: [] as (WalletRefusalReason | null)[],
  aiCalls: [] as AiCallRow[],
  conversations: [] as { id: string; title: string; updated_at: string }[],
  createdConversations: [] as string[],
  tasks: [] as Record<string, unknown>[],
  finished: [] as { id: string; status: string; answer: string }[],
  history: [] as TaskRow[],
  uploads: [] as FileRow[],
  linked: [] as { ids: readonly string[]; taskId: string }[],
  stored: [] as { kind: string; name: string; mime: string; taskId?: string | null; bytes: Uint8Array }[],
  contents: new Map<string, Uint8Array>(),
  failCreateTask: false,
}));

vi.mock("@/lib/runs/wallet", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/runs/wallet")>();
  return {
    ...original,
    reserveForTask: async (_memberId: string, taskId: string, amountCents: number) => {
      const reason = db.refusals.shift();
      if (reason) throw new original.WalletRefusedError(reason);
      const id = `hold-${db.holds.length + 1}`;
      db.holds.push({ id, amountCents, taskId });
      return id;
    },
    chargeTask: async (holdId: string, taskId: string, charge: { amountCents: number; description: string; provider: string }) => {
      db.charges.push({ holdId, taskId, ...charge });
      return 0;
    },
    closeHold: async (holdId: string) => void db.closed.push(holdId),
  };
});
vi.mock("@/lib/runs/store", () => ({ recordAiCalls: async (rows: AiCallRow[]) => void db.aiCalls.push(...rows) }));
vi.mock("@/lib/ock/spending", () => ({
  loadMonth: async () => ({ spentCents: 42, budgetCents: 5000 }),
}));
vi.mock("@/lib/ock/task-store", () => ({
  loadOwnConversation: async (_session: unknown, id: string) => db.conversations.find((c) => c.id === id) && {
    id,
    title: db.conversations.find((c) => c.id === id)!.title,
    updatedAt: "2026-10-25T10:00:00Z",
  },
  createOwnConversation: async (_session: unknown, title: string): Promise<ChatConversation> => {
    db.createdConversations.push(title);
    return { id: "conversa-nova", title, updatedAt: "2026-10-25T12:00:00Z" };
  },
  loadOwnTasks: async () => db.history,
  createTask: async (task: Record<string, unknown>) => {
    if (db.failCreateTask) throw new Error("banco fora do ar");
    db.tasks.push(task);
  },
  finishTask: async (id: string, status: string, answer: string) => void db.finished.push({ id, status, answer }),
  touchConversation: async () => {},
}));
vi.mock("@/lib/ock/files", () => ({
  loadOwnUploads: async (_session: unknown, _memberId: string, ids: readonly string[]) =>
    db.uploads.filter((file) => ids.includes(file.id)),
  linkUploadsToTask: async (ids: readonly string[], taskId: string) => void db.linked.push({ ids, taskId }),
  readStoredFile: async (path: string) => db.contents.get(path) ?? new Uint8Array(),
  storeFile: async (file: { kind: string; name: string; mime: string; taskId?: string | null; bytes: Uint8Array }) => {
    db.stored.push(file);
    return { id: `arquivo-${db.stored.length}`, name: file.name };
  },
}));

const CARLA: CurrentMember = {
  id: "11111111-1111-4111-8111-111111111111",
  companyId: "c0000000-0000-4000-8000-000000000000",
  companyName: "Doce Encanto",
  name: "Carla Dias",
  email: "carla@example.com",
  role: "employee",
};
const SESSION = {} as SupabaseClient;

/** As IAs simuladas, respondendo na hora, com o que cada uma recebeu anotado. */
function simulated(failures: Partial<Record<ProviderId, number>> = {}) {
  const requests: { provider: ProviderId; request: GenerateRequest }[] = [];
  const options: QuickTaskOptions = {
    getProvider: (id): AiProvider => {
      const provider = createMockProvider({ id, chunkDelayMs: 0, failFirstCalls: failures[id] ?? 0, failAfterChunks: 2 });
      return {
        id,
        generate: (request) => {
          requests.push({ provider: id, request });
          return provider.generate(request);
        },
      };
    },
    wait: async () => {},
  };
  return { options, requests };
}

function send(message: string, extra: { conversationId?: string; fileIds?: string[] } = {}, failures = {}) {
  const ai = simulated(failures);
  const result = runQuickTask(
    CARLA,
    SESSION,
    { message, conversationId: extra.conversationId ?? null, fileIds: extra.fileIds ?? [] },
    ai.options,
  );
  return { result, requests: ai.requests };
}

function upload(id: string, name: string, content: string | Uint8Array): FileRow {
  const path = `${CARLA.companyId}/${CARLA.id}/${id}-${name}`;
  db.contents.set(path, typeof content === "string" ? new TextEncoder().encode(content) : content);
  return {
    id,
    member_id: CARLA.id,
    kind: "upload",
    name,
    storage_path: path,
    mime_type: null,
    size_bytes: 10,
    task_id: null,
    created_at: "2026-10-25T10:00:00Z",
  };
}

beforeEach(() => {
  db.holds = [];
  db.closed = [];
  db.charges = [];
  db.refusals = [];
  db.aiCalls = [];
  db.conversations = [];
  db.createdConversations = [];
  db.tasks = [];
  db.finished = [];
  db.history = [];
  db.uploads = [];
  db.linked = [];
  db.stored = [];
  db.contents = new Map();
  db.failCreateTask = false;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("uma mensagem do chat", () => {
  it("o Chefe decide, a IA responde e a mensagem vira uma linha de gasto só, pelo consumo real", async () => {
    const { result, requests } = send("Oi, tudo bem?");
    const outcome = await result;
    if (!outcome.ok) throw new Error(outcome.problem);
    const { task, conversation, month } = outcome.result;

    // Duas reservas: o máximo do Chefe e, depois que ele decidiu, o da resposta. As duas fecham no fim.
    expect(db.holds).toHaveLength(2);
    expect(db.holds.every((hold) => hold.taskId === task.id)).toBe(true);
    expect(db.closed).toEqual(expect.arrayContaining(["hold-1", "hold-2"]));

    // O Chefe (GPT econômico) e depois a IA que ele escolheu.
    expect(requests.map((item) => item.provider)).toEqual(["gpt", "claude"]);
    expect(requests[0].request.tier).toBe("economico");

    expect(db.charges).toEqual([
      {
        holdId: "hold-2",
        taskId: task.id,
        amountCents: task.costCents,
        description: "Tarefa rápida · Resposta",
        provider: "claude",
      },
    ]);
    expect(task.costCents).toBeGreaterThanOrEqual(1);
    expect(task.costCents).toBeLessThanOrEqual(db.holds[1].amountCents);

    // A conversa nova, a mensagem com o que foi recomendado e escolhido (iguais por enquanto) e a resposta.
    expect(db.createdConversations).toEqual(["Oi, tudo bem?"]);
    expect(conversation.id).toBe("conversa-nova");
    expect(db.tasks[0]).toMatchObject({
      id: task.id,
      company_id: CARLA.companyId,
      member_id: CARLA.id,
      conversation_id: "conversa-nova",
      prompt: "Oi, tudo bem?",
      action: "responder",
      recommended_provider: "claude",
      chosen_provider: "claude",
      recommended_tier: task.tier,
      chosen_tier: task.tier,
    });
    expect(db.finished).toEqual([{ id: task.id, status: "finished", answer: task.answer }]);
    expect(task).toMatchObject({ status: "finished", action: "responder", provider: "claude", notice: null });
    expect(task.answer).toContain("resposta simulada");
    expect(month).toEqual({ spentCents: 42, budgetCents: 5000 });

    // O registro interno tem as duas chamadas, cobradas, e nada do pedido.
    expect(db.aiCalls.map((row) => [row.step_id, row.provider, row.charged, row.task_id])).toEqual([
      ["chief", "gpt", true, task.id],
      ["answer", "claude", true, task.id],
    ]);
  });

  it("sem saldo, nenhuma IA trabalha e nada é guardado", async () => {
    db.refusals = ["insufficient_balance"];
    const { result, requests } = send("Oi");
    expect(await result).toEqual({
      ok: false,
      status: 402,
      problem: "A empresa está sem saldo. Peça ao dono da empresa para colocar crédito. Nada foi cobrado.",
    });
    expect(requests).toEqual([]);
    expect(db.createdConversations).toEqual([]);
    expect(db.tasks).toEqual([]);
    expect(db.aiCalls).toEqual([]);
  });

  it("passando do teto do mês com a resposta, avisa quanto seria reservado e não cobra nada", async () => {
    // A 1ª reserva (o Chefe) passa; a 2ª (a resposta) é recusada.
    db.refusals = [null, "monthly_budget_exceeded"];
    const ai = simulated();
    const outcome = await runQuickTask(CARLA, SESSION, { message: "Oi", conversationId: null, fileIds: [] }, ai.options);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.status).toBe(402);
    expect(outcome.problem).toMatch(
      /^Reservar R\$ \d+,\d{2}, o máximo que esta resposta pode custar, passaria do seu teto do mês\. Peça ao dono da empresa para aumentar o seu teto\. Nada foi cobrado\.$/,
    );
    expect(ai.requests.map((item) => item.provider)).toEqual(["gpt"]);
    expect(db.charges).toEqual([]);
    expect(db.createdConversations).toEqual([]);
    expect(db.tasks).toEqual([]);
    expect(db.closed).toEqual(expect.arrayContaining(["hold-1"]));
    expect(db.aiCalls.map((row) => [row.step_id, row.charged])).toEqual([["chief", false]]);
  });

  it("se a IA falhar 3 vezes, a mensagem fica com o aviso e nada é cobrado (F26: as tentativas ficam registradas)", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = send("Oi", {}, { claude: Infinity });
    const outcome = await result;
    if (!outcome.ok) throw new Error(outcome.problem);
    expect(outcome.result.task).toMatchObject({ status: "failed", answer: AI_FAILED, costCents: 0, notice: null });
    expect(db.charges).toEqual([]);
    expect(db.finished[0]).toMatchObject({ status: "failed", answer: AI_FAILED });
    expect(db.closed).toEqual(expect.arrayContaining(["hold-1", "hold-2"]));
    expect(db.aiCalls.map((row) => [row.step_id, row.status, row.charged])).toEqual([
      ["chief", "ok", false],
      ["answer", "error", false],
      ["answer", "error", false],
      ["answer", "error", false],
    ]);
    expect(log).toHaveBeenCalled();
  });

  it("com as IAs de verdade ligadas e sem nenhuma chave, a mensagem falha sem cobrar e sem cair na simulada (F42)", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const outcome = await runQuickTask(
      CARLA,
      SESSION,
      { message: "Me dê 3 ideias de nome para uma padaria", conversationId: null, fileIds: [] },
      { getProvider: createGetProvider({}), wait: async () => {} },
    );
    if (!outcome.ok) throw new Error(outcome.problem);
    expect(outcome.result.task).toMatchObject({ status: "failed", answer: AI_FAILED, costCents: 0 });
    expect(db.charges).toEqual([]);
    // O Chefe (GPT) falhou e valeu a regra simples; a IA escolhida também falhou, numa tentativa só (não adianta
    // repetir), e o registro interno guarda o motivo, com o nome da variável que falta.
    expect(db.aiCalls.map((row) => [row.step_id, row.status, row.charged])).toEqual([
      ["chief", "error", false],
      ["answer", "error", false],
    ]);
    expect(db.aiCalls[0].error_message).toContain("OCK_GPT_KEY");
    expect(log).toHaveBeenCalled();
  });

  it("se o Chefe falhar, vale a regra simples, sem esperar novas tentativas", async () => {
    const { result, requests } = send("Gere um PDF com o resumo da reunião", {}, { gpt: Infinity });
    const outcome = await result;
    if (!outcome.ok) throw new Error(outcome.problem);
    expect(outcome.result.task.action).toBe("documento");
    expect(requests.filter((item) => item.provider === "gpt")).toHaveLength(1);
    // O Chefe que falhou não entra na conta.
    expect(db.aiCalls[0]).toMatchObject({ step_id: "chief", status: "error", charged: false });
  });

  it("pedido de documento: a IA escreve o conteúdo e a OCK guarda o PDF como entrega da mensagem", async () => {
    const { result } = send("Gere um PDF com o resumo da reunião");
    const outcome = await result;
    if (!outcome.ok) throw new Error(outcome.problem);
    const { task } = outcome.result;
    expect(db.stored).toHaveLength(1);
    expect(db.stored[0]).toMatchObject({ kind: "delivery", mime: "application/pdf", taskId: task.id });
    // O nome vem do que a IA escreveu (a primeira linha), nunca do pedido: o dono vê as entregas (F49).
    expect(db.stored[0].name).toBe("Resumo.pdf");
    expect(new TextDecoder().decode(db.stored[0].bytes.slice(0, 5))).toBe("%PDF-");
    expect(task.deliveries).toEqual([{ id: "arquivo-1", name: db.stored[0].name }]);
    expect(task.answer).toContain(`Gerei o arquivo ${db.stored[0].name}`);
    expect(db.charges[0].description).toBe("Tarefa rápida · Documento");
  });

  it("pedido de gráfico: a OCK desenha o gráfico, guarda para baixar e manda para mostrar na conversa", async () => {
    const { result } = send("Faça um gráfico de barras das vendas");
    const outcome = await result;
    if (!outcome.ok) throw new Error(outcome.problem);
    const { task } = outcome.result;
    expect(task.answer).toBe("Gráfico pronto: Vendas por mês (exemplo)");
    expect(db.stored[0]).toMatchObject({ kind: "delivery", name: "grafico.svg", mime: "image/svg+xml" });
    expect(task.chart).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it("pedido de projeto: os arquivos vão num .zip", async () => {
    const { result } = send("Monte um projeto de site com os arquivos para baixar em zip");
    const outcome = await result;
    if (!outcome.ok) throw new Error(outcome.problem);
    expect(outcome.result.task.action).toBe("projeto");
    expect(db.stored[0]).toMatchObject({ name: "projeto.zip", mime: "application/zip" });
    expect(outcome.result.task.answer).toContain("index.html, estilo.css");
  });

  it("pedido de imagem: responde que chega em breve, sem chamar outra IA e sem cobrar", async () => {
    const { result, requests } = send("Crie uma imagem de um bolo de chocolate");
    const outcome = await result;
    if (!outcome.ok) throw new Error(outcome.problem);
    expect(outcome.result.task).toMatchObject({ action: "imagem", status: "finished", answer: IMAGE_UNAVAILABLE, costCents: 0 });
    expect(requests.map((item) => item.provider)).toEqual(["gpt"]);
    expect(db.holds).toHaveLength(1);
    expect(db.charges).toEqual([]);
    expect(db.tasks[0]).toMatchObject({ action: "imagem", status: "finished", answer: IMAGE_UNAVAILABLE });
    expect(db.aiCalls.map((row) => row.charged)).toEqual([false]);
  });

  it("pesquisa vem com o aviso de que a internet ainda não está ligada (F45)", async () => {
    const { result } = send("Pesquise as notícias de hoje sobre o dólar");
    const outcome = await result;
    if (!outcome.ok) throw new Error(outcome.problem);
    expect(outcome.result.task.action).toBe("pesquisa");
    expect(outcome.result.task.notice).toContain("pesquisa na internet ainda não está ligada");
  });

  it("numa conversa que já existe, a IA recebe as trocas respondidas (as que falharam ficam de fora)", async () => {
    db.conversations = [{ id: "conversa-1", title: "Orçamento", updated_at: "2026-10-25T10:00:00Z" }];
    const row = (id: string, status: TaskRow["status"], prompt: string, answer: string): TaskRow => ({
      id,
      prompt,
      answer,
      status,
      action: "responder",
      chosen_provider: "claude",
      chosen_tier: "economico",
      chosen_effort: "low",
      created_at: "2026-10-25T10:00:00Z",
    });
    db.history = [row("t1", "finished", "Qual o prazo?", "Dez dias."), row("t2", "failed", "E o preço?", AI_FAILED)];
    const { result, requests } = send("E o frete?", { conversationId: "conversa-1" });
    const outcome = await result;
    if (!outcome.ok) throw new Error(outcome.problem);
    expect(db.createdConversations).toEqual([]);
    expect(outcome.result.conversation.id).toBe("conversa-1");
    const answer = requests.find((item) => item.provider !== "gpt")!;
    expect(answer.request.input).toContain("Funcionário: Qual o prazo?\nVocê: Dez dias.");
    expect(answer.request.input).not.toContain("E o preço?");
    // O Chefe também recebe o contexto, para entender pedidos de continuação.
    expect(requests[0].request.input).toContain("Qual o prazo?");
  });

  it("conversa de outra pessoa (ou que não existe) não recebe a mensagem, e nada é reservado", async () => {
    const { result } = send("Oi", { conversationId: "conversa-de-outra-pessoa" });
    expect(await result).toMatchObject({ ok: false, status: 404 });
    expect(db.holds).toEqual([]);
  });

  it("anexo de outra pessoa (ou que não existe) também não", async () => {
    const { result } = send("Leia", { fileIds: ["arquivo-de-outra-pessoa"] });
    expect(await result).toMatchObject({ ok: false, status: 404 });
    expect(db.holds).toEqual([]);
  });

  it("anexos: o texto e as imagens chegam à IA, e os anexos ficam ligados à mensagem", async () => {
    db.uploads = [upload("f1", "ata.txt", "Reunião de segunda: aprovar o orçamento."), upload("f2", "foto.png", new Uint8Array([1, 2, 3]))];
    const { result, requests } = send("", { fileIds: ["f1", "f2"] });
    const outcome = await result;
    if (!outcome.ok) throw new Error(outcome.problem);
    const { task } = outcome.result;
    expect(task.prompt).toBe("(ver arquivo anexado)");
    expect(task.attachments).toEqual([
      { id: "f1", name: "ata.txt" },
      { id: "f2", name: "foto.png" },
    ]);
    expect(task.attachmentsCut).toBe(false);
    const answer = requests[1].request;
    expect(answer.input).toContain("--- Arquivo anexado: ata.txt ---\nReunião de segunda");
    expect(answer.images).toEqual([{ mime: "image/png", base64: "AQID" }]);
    expect(db.linked).toEqual([{ ids: ["f1", "f2"], taskId: task.id }]);
    expect(db.createdConversations).toEqual(["Arquivo: ata.txt, foto.png"]);
  });

  it("anexo grande: só o começo vai para a IA, e a resposta avisa (F44)", async () => {
    db.uploads = [upload("f1", "livro.txt", "x".repeat(40_000))];
    const { result } = send("Resuma", { fileIds: ["f1"] });
    const outcome = await result;
    if (!outcome.ok) throw new Error(outcome.problem);
    expect(outcome.result.task.attachmentsCut).toBe(true);
  });

  it("erro inesperado no meio: as reservas fecham e as chamadas ficam registradas, e o erro sobe", async () => {
    db.failCreateTask = true;
    const { result } = send("Oi");
    await expect(result).rejects.toThrow("banco fora do ar");
    expect(db.closed).toEqual(expect.arrayContaining(["hold-1", "hold-2"]));
    expect(db.charges).toEqual([]);
    expect(db.aiCalls.map((row) => [row.step_id, row.charged])).toEqual([["chief", false]]);
  });
});

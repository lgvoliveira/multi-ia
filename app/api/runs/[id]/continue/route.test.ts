import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveTeam } from "@/lib/engine/run";
import type { StepResult } from "@/lib/engine/types";
import { USD_TO_BRL } from "@/lib/ock/pricing";
import type { ProviderId } from "@/lib/providers/types";
import { getRecipe } from "@/lib/recipes/catalog";
import { SAMPLE_PROPOSAL_FINAL } from "@/lib/recipes/commercial-proposal.samples";
import { SAMPLE_FINAL_SITE } from "@/lib/recipes/create-site.samples";
import { stepChargeCents } from "@/lib/runs/billing";
import { estimateCents, stepCosts } from "@/lib/runs/estimate";
import { INTERNAL_SECRET_HEADER, internalRunSecret } from "@/lib/runs/internal-secret";
import type { PublicRunEvent } from "@/lib/runs/public-events";
import type { AiCallRow, RunStatus, SnapshotPatch } from "@/lib/runs/store";
import type { StepCharge } from "@/lib/runs/wallet";
import { POST } from "./route";

// Nada de rede: a IA simulada responde (na hora, ou devagar nos testes de cancelamento), e o banco, a carteira e o
// disparo são dublês em memória.

const mockAi = vi.hoisted(() => ({
  delayMs: 0,
  /** Quantas chamadas de cada etapa falham, por IA (como MOCK_AI_FAILURES). */
  failures: {} as Partial<Record<string, number>>,
  /** IAs que gastam além do previsto (como MOCK_AI_OVERSPEND). */
  overspend: new Set<string>(),
}));

vi.mock("@/lib/providers/registry", async () => {
  const { createMockProvider } = await import("@/lib/providers/mock");
  return {
    getProvider: (id: ProviderId) =>
      createMockProvider({
        id,
        chunkDelayMs: mockAi.delayMs,
        failFirstCalls: mockAi.failures[id] ?? 0,
        failAfterChunks: 1,
        overspend: mockAi.overspend.has(id),
      }),
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
  /** Faz a pessoa "cancelar" logo antes de a execução voltar para a fila, entre duas fases. */
  cancelBeforeRelease: false,
}));

// A carteira em memória: as reservas da execução e as linhas de gasto.
const wallet = vi.hoisted(() => ({
  holds: [] as { id: string; amountCents: number; chargedCents: number; open: boolean; expiresAt: string }[],
  charges: [] as ({ holdId: string } & StepCharge)[],
}));

const claimRun = vi.hoisted(() =>
  vi.fn(async () => {
    if (db.finished || db.row.status === "paused") return null;
    db.row.status = "running";
    db.row.attempt += 1;
    return { ...db.row };
  }),
);
const renewLease = vi.hoisted(() => vi.fn(async (): Promise<RunStatus | null> => "running"));
const setStatus = vi.hoisted(() =>
  vi.fn(async (_id: string, status: string, extra: SnapshotPatch = {}) => {
    db.row.status = status;
    if (extra.result !== undefined) db.row.result = extra.result;
    if (extra.duration_ms !== undefined) db.row.duration_ms = extra.duration_ms;
    if (status === "finished" || status === "failed" || status === "cancelled") db.finished = true;
  }),
);
const releaseRun = vi.hoisted(() =>
  vi.fn(async (_id: string, _attempt: number, status: "queued" | "paused") => {
    if (db.cancelBeforeRelease) db.row.status = "cancelled";
    if (db.row.status !== "running") return false;
    db.row.status = status;
    return true;
  }),
);
const triggerContinue = vi.hoisted(() => vi.fn());
// O resultado pronto vai para as entregas da pessoa (F47); aqui só se anota o que seria guardado.
const saveRunDelivery = vi.hoisted(() =>
  vi.fn<(run: { id: string }, delivery: { name: string; mime: string; bytes: Uint8Array }) => Promise<void>>(
    async () => {},
  ),
);

vi.mock("@/lib/runs/store", () => ({
  claimRun,
  renewLease,
  setStatus,
  releaseRun,
  appendEvents: async (run: { id: string; company_id: string }, events: PublicRunEvent[]) => {
    db.events.push(...events);
    db.eventCompanies.push(run.company_id);
  },
  recordAiCalls: async (rows: AiCallRow[]) => {
    db.aiCalls.push(...rows);
  },
  saveSnapshot: async (_id: string, _attempt: number, patch: SnapshotPatch) => {
    if (patch.outputs) db.row.outputs = patch.outputs;
    if (patch.results) db.row.results = patch.results;
    if (patch.team) db.row.team = patch.team as Record<string, string>;
    if (patch.cursor) db.row.cursor = patch.cursor;
    return true;
  },
}));

vi.mock("@/lib/runs/wallet", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/runs/wallet")>();
  const view = (hold: (typeof wallet.holds)[number]) => ({
    id: hold.id,
    amountCents: hold.amountCents,
    chargedCents: hold.chargedCents,
    expiresAt: hold.expiresAt,
  });
  return {
    ...actual,
    findOpenRunHold: async () => {
      const hold = [...wallet.holds].reverse().find((candidate) => candidate.open);
      return hold ? view(hold) : null;
    },
    closeRunHolds: async () => {
      for (const hold of wallet.holds) hold.open = false;
    },
    chargeStep: async (holdId: string, _runId: string, charge: StepCharge) => {
      const hold = wallet.holds.find((candidate) => candidate.id === holdId);
      if (!hold?.open) return null;
      hold.chargedCents += charge.amountCents;
      wallet.charges.push({ holdId, ...charge });
      return hold.amountCents - hold.chargedCents;
    },
    countRunCharges: async () => wallet.charges.length,
  };
});

vi.mock("@/lib/runs/trigger", () => ({ triggerContinue }));

vi.mock("@/lib/runs/delivery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/runs/delivery")>()),
  saveRunDelivery,
}));

/** O site que foi para as entregas na chamada `call` (contando de 0). */
function deliveredSite(call: number): string {
  return new TextDecoder().decode(saveRunDelivery.mock.calls[call][1].bytes);
}

const RUN_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const COMPANY_ID = "c0000000-0000-4000-8000-000000000000";
const MEMBER_ID = "11111111-1111-4111-8111-111111111111";
const recipe = getRecipe("create-site")!;
const ESTIMATE = estimateCents(stepCosts(recipe), resolveTeam(recipe));
const IN_AN_HOUR = () => new Date(Date.now() + 3_600_000).toISOString();

beforeEach(() => {
  process.env.SUPABASE_SECRET_KEY = "sb_secret_de_teste";
  mockAi.delayMs = 0;
  mockAi.failures = {};
  mockAi.overspend = new Set();
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
    status: "queued",
    result: null,
    duration_ms: null,
    attempt: 0,
    // Pediu há 30 segundos; o banco marca a reivindicação (updated_at) agora.
    created_at: new Date(Date.now() - 30_000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  db.events = [];
  db.eventCompanies = [];
  db.aiCalls = [];
  db.finished = false;
  db.cancelBeforeRelease = false;
  // Ao começar, a rota de criação reservou a estimativa.
  wallet.holds = [{ id: "hold-1", amountCents: ESTIMATE, chargedCents: 0, open: true, expiresAt: IN_AN_HOUR() }];
  wallet.charges = [];
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

/** Roda a corrente: um segmento por chamada, até a execução terminar ou pausar. */
async function runToEnd(): Promise<void> {
  let guard = 0;
  while (!db.finished && db.row.status !== "paused" && guard++ < 20) {
    const response = await callContinue();
    expect(response.status).toBe(200);
  }
}

/** O que a rota de continuar depois da pausa faz: fecha a reserva antiga, reserva o que falta e volta para a fila. */
function resumeWith(amountCents: number): void {
  for (const hold of wallet.holds) hold.open = false;
  wallet.holds.push({ id: `hold-${wallet.holds.length + 1}`, amountCents, chargedCents: 0, open: true, expiresAt: IN_AN_HOUR() });
  db.events.push({ type: "run-resumed" });
  db.row.status = "queued";
}

/** O texto que a narração deixou para uma etapa (os pedaços, juntos). */
function narratedText(stepId: string): string {
  return db.events
    .filter((event): event is Extract<PublicRunEvent, { type: "step-text" }> => event.type === "step-text")
    .filter((event) => event.stepId === stepId)
    .map((event) => event.text)
    .join("");
}

const pauses = () => db.events.filter((event) => event.type === "run-paused");

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
    expect(pauses()).toHaveLength(0);
  });

  it("o site pronto vai para as entregas de quem pediu, uma vez, antes de a execução aparecer como terminada (F47)", async () => {
    let statusWhenSaved = "";
    saveRunDelivery.mockImplementationOnce(async () => {
      statusWhenSaved = db.row.status;
    });
    await runToEnd();

    expect(statusWhenSaved).toBe("running");

    expect(saveRunDelivery).toHaveBeenCalledTimes(1);
    expect(saveRunDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ id: RUN_ID, company_id: COMPANY_ID, member_id: MEMBER_ID }),
      expect.objectContaining({ name: "doce-encanto-confeitaria.html", mime: "text/html" }),
    );
    expect(deliveredSite(0)).toBe(SAMPLE_FINAL_SITE);
  });

  it("uma receita que termina num texto (a proposta comercial) vai do começo ao fim e guarda o Word nas entregas", async () => {
    const proposal = getRecipe("commercial-proposal")!;
    const estimate = estimateCents(stepCosts(proposal), resolveTeam(proposal));
    db.row = { ...db.row, recipe_id: proposal.id, request: "Uma proposta para a Clínica Sorriso.", team: resolveTeam(proposal) };
    wallet.holds = [{ id: "hold-1", amountCents: estimate, chargedCents: 0, open: true, expiresAt: IN_AN_HOUR() }];
    await runToEnd();

    expect(db.row.status).toBe("finished");
    expect(db.row.result).toBe(SAMPLE_PROPOSAL_FINAL);
    // Uma cobrança por etapa: roteiro, proposta, crítica e versão final.
    expect(wallet.charges).toHaveLength(4);
    expect(wallet.holds[0].open).toBe(false);
    expect(saveRunDelivery).toHaveBeenCalledTimes(1);
    expect(saveRunDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ id: RUN_ID }),
      expect.objectContaining({
        name: "Proposta-comercial.docx",
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );
  });

  it("se não der para guardar o site nas entregas, a execução termina assim mesmo", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    saveRunDelivery.mockRejectedValueOnce(new Error("pasta fora do ar"));
    await runToEnd();

    expect(db.row.status).toBe("finished");
    expect(db.row.result).toBe(SAMPLE_FINAL_SITE);
    expect(wallet.holds[0].open).toBe(false);
  });

  it("o tempo do fim é o que a pessoa esperou desde que pediu, não só o da última fase", async () => {
    await runToEnd();

    const end = db.events.at(-1) as Extract<PublicRunEvent, { type: "run-finished" }>;
    expect(end.durationMs).toBeGreaterThanOrEqual(30_000);
    expect(db.row.duration_ms).toBe(end.durationMs);
  });

  it("cobra cada etapa concluída uma vez, pelo consumo real, e no fim fecha a reserva", async () => {
    await runToEnd();

    // Uma linha de gasto por etapa, com a receita e a etapa (nunca o pedido) e a IA que fez.
    expect(wallet.charges.map((charge) => charge.description)).toEqual([
      "Criar um site · Chefe",
      "Criar um site · Front-end",
      "Criar um site · Back-end",
      "Criar um site · Pesquisador",
      "Criar um site · Revisão do chefe",
      "Criar um site · Montagem final",
    ]);
    expect(wallet.charges.map((charge) => charge.provider)).toEqual(["claude", "gpt", "claude", "gemini", "claude", "gpt"]);
    const results = db.row.results as StepResult[];
    expect(wallet.charges.map((charge) => charge.amountCents)).toEqual(results.map(stepChargeCents));

    // Gastou menos que o máximo reservado, e a reserva fechou: a sobra volta ao saldo.
    const spent = wallet.charges.reduce((sum, charge) => sum + charge.amountCents, 0);
    expect(spent).toBeGreaterThan(0);
    expect(spent).toBeLessThan(ESTIMATE);
    expect(wallet.holds[0].open).toBe(false);
  });

  it("cada chamada às IAs vai para o registro interno, com o custo em dólar, e nada disso aparece na narração", async () => {
    await runToEnd();

    // Na fase em paralelo, na ordem em que as IAs terminaram.
    expect(db.aiCalls.map((call) => call.step_id).sort()).toEqual(
      ["back", "brief", "consolidate", "front", "research", "review"],
    );
    for (const call of db.aiCalls) {
      expect(call).toMatchObject({
        company_id: COMPANY_ID,
        member_id: MEMBER_ID,
        run_id: RUN_ID,
        status: "ok",
        attempt: 1,
        tier: "padrao",
        usd_brl: USD_TO_BRL,
        charged: true,
        error_message: null,
      });
      expect(call.model).toMatch(/^mock-/);
      expect(call.input_tokens).toBeGreaterThan(0);
      expect(call.cost_usd).toBeGreaterThan(0);
    }
    // Nada interno vaza para a narração pública.
    expect(JSON.stringify(db.events)).not.toMatch(/"(model|usage|inputTokens|outputTokens|errorMessage|cost)/);
  });

  it("as tentativas que falharam ficam no registro interno, sem cobrança; a etapa é cobrada uma vez", async () => {
    // O GPT (Front-end e Montagem final) falha nas 2 primeiras tentativas de cada etapa e acerta na 3ª.
    mockAi.failures = { gpt: 2 };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // As novas tentativas esperam 1 s e 2 s: o relógio de mentira pula essas esperas.
    vi.useFakeTimers();
    const done = runToEnd();
    await vi.advanceTimersByTimeAsync(30_000);
    await done;
    warn.mockRestore();

    const front = db.aiCalls.filter((call) => call.step_id === "front");
    expect(front.map((call) => [call.attempt, call.status, call.charged])).toEqual([
      [1, "error", false],
      [2, "error", false],
      [3, "ok", true],
    ]);
    expect(front[0].error_message).toContain("falhou de propósito");
    expect(front[0].model).toBe("mock-gpt");
    // A falha também custou à plataforma (ela escreveu um pouco antes de cair).
    expect(front[0].cost_usd).toBeGreaterThan(0);

    // No extrato, uma linha por etapa: as tentativas que falharam não são cobradas.
    expect(wallet.charges).toHaveLength(6);
  });

  it("se a pessoa cancelou no meio da fase, para a IA, não cobra a etapa interrompida e fecha a reserva", async () => {
    vi.useFakeTimers();
    mockAi.delayMs = 200;
    renewLease.mockResolvedValue("cancelled");

    const response = callContinue();
    await vi.advanceTimersByTimeAsync(10_000);
    expect((await response).status).toBe(200);

    expect(db.events.at(-1)).toEqual({ type: "run-cancelled", stepId: "brief" });
    expect(db.events.some((event) => event.type === "step-finished")).toBe(false);
    expect(db.row.status).toBe("cancelled");
    expect(triggerContinue).not.toHaveBeenCalled();

    // A etapa interrompida custou à plataforma, mas não vira gasto da empresa (decisão 2 do Luis, 25/10).
    expect(db.aiCalls).toEqual([
      expect.objectContaining({ step_id: "brief", status: "error", charged: false, error_message: "Cancelada no meio." }),
    ]);
    expect(wallet.charges).toHaveLength(0);
    expect(wallet.holds[0].open).toBe(false);
    // Sem site pronto, nada vai para as entregas.
    expect(saveRunDelivery).not.toHaveBeenCalled();
  });

  it("se a pessoa cancelou entre duas fases, cobra a fase que terminou, não encadeia e fecha a reserva", async () => {
    db.cancelBeforeRelease = true;
    expect((await callContinue()).status).toBe(200);

    expect(wallet.charges.map((charge) => charge.description)).toEqual(["Criar um site · Chefe"]);
    expect(wallet.holds[0].open).toBe(false);
    expect(triggerContinue).not.toHaveBeenCalled();
  });

  it("sem reserva aberta, não chama IA nenhuma: pausa e diz quanto é preciso reservar", async () => {
    wallet.holds = [];
    expect((await callContinue()).status).toBe(200);

    expect(db.events).toEqual([{ type: "run-paused", neededCents: ESTIMATE }]);
    expect(db.row.status).toBe("paused");
    expect(db.aiCalls).toHaveLength(0);
    expect(triggerContinue).not.toHaveBeenCalled();
  });

  it("reserva vencida (parada há mais de uma hora) não vale: pausa para reservar de novo", async () => {
    wallet.holds[0].expiresAt = new Date(Date.now() - 1000).toISOString();
    await callContinue();
    expect(db.row.status).toBe("paused");
    expect(db.aiCalls).toHaveLength(0);
  });

  it("quando o gasto passa do previsto, pausa antes da próxima fase; continuando, vai até o fim", async () => {
    // O Claude "gasta demais": o plano do Chefe custa mais que o máximo previsto para ele.
    mockAi.overspend = new Set(["claude"]);
    await runToEnd();

    // Pausou depois da 1ª fase, pedindo o máximo do que falta.
    expect(db.row.status).toBe("paused");
    const needed = estimateCents(stepCosts(recipe, { stageIndex: 1, round: 1 }), resolveTeam(recipe));
    expect(db.events.at(-1)).toEqual({ type: "run-paused", neededCents: needed });
    expect(wallet.charges.map((charge) => charge.description)).toEqual(["Criar um site · Chefe"]);
    expect(wallet.charges[0].amountCents).toBeGreaterThan(wallet.holds[0].amountCents - needed);

    // A pessoa manda continuar: reserva o que falta e o time termina, sem pausar de novo.
    resumeWith(needed);
    await runToEnd();
    expect(db.row.status).toBe("finished");
    expect(pauses()).toHaveLength(1);
    expect(wallet.charges).toHaveLength(6);
    expect(wallet.holds.every((hold) => !hold.open)).toBe(true);
  });

  it("se o servidor caiu entre gravar uma fase e cobrar, a próxima chamada cobra o que faltou, sem cobrar duas vezes", async () => {
    // A 1ª fase (o plano) já está gravada, mas não foi cobrada.
    await callContinue();
    const briefCharge = wallet.charges.pop()!;
    wallet.holds[0].chargedCents = 0;

    await callContinue();
    expect(wallet.charges.map((charge) => charge.description)).toEqual([
      "Criar um site · Chefe",
      "Criar um site · Front-end",
      "Criar um site · Back-end",
      "Criar um site · Pesquisador",
    ]);
    expect(wallet.charges[0].amountCents).toBe(briefCharge.amountCents);
  });

  it("se o servidor caiu depois de gravar a última fase, a próxima chamada cobra o que faltou e só encerra", async () => {
    await runToEnd();
    // Volta no tempo: tudo gravado, mas sem a cobrança da montagem final e sem o encerramento.
    wallet.charges.pop();
    wallet.holds[0].open = true;
    db.finished = false;
    db.row.status = "running";
    const calls = db.aiCalls.length;

    expect((await callContinue()).status).toBe(200);
    expect(db.row.status).toBe("finished");
    expect(db.row.result).toBe(SAMPLE_FINAL_SITE);
    expect(wallet.charges).toHaveLength(6);
    expect(wallet.holds[0].open).toBe(false);
    // Nenhuma IA foi chamada de novo.
    expect(db.aiCalls).toHaveLength(calls);
    // O site vai para as entregas também por aqui (quem guarda confere se já não estava lá).
    expect(saveRunDelivery).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: RUN_ID }),
      expect.objectContaining({ mime: "text/html" }),
    );
    expect(deliveredSite(saveRunDelivery.mock.calls.length - 1)).toBe(SAMPLE_FINAL_SITE);
  });

  it("grava a narração aos poucos, enquanto a fase ainda roda (F35)", async () => {
    vi.useFakeTimers();
    mockAi.delayMs = 200;

    const response = callContinue();
    await vi.advanceTimersByTimeAsync(1500);
    // A fase do chefe ainda não acabou, mas o texto dela já está no banco.
    expect(db.events.some((event) => event.type === "step-finished")).toBe(false);
    expect(narratedText("brief").length).toBeGreaterThan(0);

    await vi.runAllTimersAsync();
    expect((await response).status).toBe(200);
  });

  it("se outro servidor pegou a execução no meio, não grava nem cobra nada deste segmento", async () => {
    vi.useFakeTimers();
    mockAi.delayMs = 200;
    renewLease.mockResolvedValue(null);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = callContinue();
    await vi.advanceTimersByTimeAsync(10_000);
    expect((await response).status).toBe(500);

    expect(db.events.some((event) => event.type === "run-cancelled")).toBe(false);
    expect(setStatus).not.toHaveBeenCalled();
    expect(triggerContinue).not.toHaveBeenCalled();
    expect(wallet.charges).toHaveLength(0);
    expect(db.aiCalls).toHaveLength(0);
    error.mockRestore();
  });
});

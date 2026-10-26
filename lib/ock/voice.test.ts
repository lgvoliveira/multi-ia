import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentMember } from "@/lib/auth/member";
import { transcriptionCostInUsd, usdToCents } from "@/lib/ock/pricing";
import { createMockTranscriber, type Transcriber } from "@/lib/providers/transcribe";
import { ProviderError } from "@/lib/providers/types";
import type { AiCallRow } from "@/lib/runs/store";
import type { WalletRefusalReason } from "@/lib/runs/wallet";
import { MAX_VOICE_SECONDS } from "./chat";
import { audioFileName, transcribeVoice, VOICE_DESCRIPTION, VOICE_EMPTY, VOICE_FAILED, voiceHoldCents } from "./voice";

// Um ditado do começo ao fim, com a carteira, o registro interno e o gasto do mês trocados por dublês.

const db = vi.hoisted(() => ({
  holds: [] as { id: string; amountCents: number }[],
  closed: [] as string[],
  charges: [] as { holdId: string; amountCents: number; description: string; provider: string }[],
  refusal: null as WalletRefusalReason | null,
  aiCalls: [] as AiCallRow[],
}));

vi.mock("@/lib/runs/wallet", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/runs/wallet")>();
  return {
    ...original,
    reserveForVoice: async (_memberId: string, amountCents: number) => {
      if (db.refusal) throw new original.WalletRefusedError(db.refusal);
      const id = `hold-${db.holds.length + 1}`;
      db.holds.push({ id, amountCents });
      return id;
    },
    chargeVoice: async (holdId: string, charge: { amountCents: number; description: string; provider: string }) => {
      db.charges.push({ holdId, ...charge });
      return 0;
    },
    closeHold: async (holdId: string) => void db.closed.push(holdId),
  };
});
vi.mock("@/lib/runs/store", () => ({ recordAiCalls: async (rows: AiCallRow[]) => void db.aiCalls.push(...rows) }));
vi.mock("@/lib/ock/spending", () => ({ loadMonth: async () => ({ spentCents: 42, budgetCents: null }) }));

const CARLA: CurrentMember = {
  id: "11111111-1111-4111-8111-111111111111",
  companyId: "c0000000-0000-4000-8000-000000000000",
  companyName: "Doce Encanto",
  name: "Carla Dias",
  email: "carla@example.com",
  role: "employee",
};
const SESSION = {} as SupabaseClient;
const AUDIO = new Blob(["áudio"], { type: "audio/webm" });

function transcriber(result: { text: string; seconds: number | null } | Error): () => Transcriber {
  return () => ({
    transcribe: async () => {
      if (result instanceof Error) throw result;
      return { ...result, model: "gpt-transcribe" };
    },
  });
}

beforeEach(() => {
  db.holds = [];
  db.closed = [];
  db.charges = [];
  db.refusal = null;
  db.aiCalls = [];
});

describe("um ditado no chat", () => {
  it("reserva o máximo de 2 minutos, cobra os segundos de verdade numa linha 'Voz · Transcrição' e devolve o texto", async () => {
    const outcome = await transcribeVoice(CARLA, SESSION, AUDIO, "ditado.webm", {
      getTranscriber: transcriber({ text: "Orçamento para amanhã", seconds: 30 }),
    });

    if (!outcome.ok) throw new Error(outcome.problem);
    const cost = Math.max(1, usdToCents(transcriptionCostInUsd(30)));
    expect(outcome.result).toEqual({ text: "Orçamento para amanhã", costCents: cost, month: { spentCents: 42, budgetCents: null } });
    expect(db.holds).toEqual([{ id: "hold-1", amountCents: voiceHoldCents() }]);
    expect(db.charges).toEqual([{ holdId: "hold-1", amountCents: cost, description: VOICE_DESCRIPTION, provider: "gpt" }]);
    expect(db.closed).toEqual(["hold-1"]);
    expect(db.aiCalls).toEqual([
      expect.objectContaining({ step_id: "voice", model: "gpt-transcribe", charged: true, status: "ok", run_id: null, task_id: null }),
    ]);
  });

  it("a reserva cobre 2 minutos (uns 5 centavos) e o ditado mais longo cabe nela", () => {
    expect(voiceHoldCents()).toBe(usdToCents(transcriptionCostInUsd(MAX_VOICE_SECONDS)));
    expect(voiceHoldCents()).toBeLessThanOrEqual(5);
  });

  it("sem os segundos no consumo, cobra o máximo (nunca menos do que a plataforma pagou)", async () => {
    const outcome = await transcribeVoice(CARLA, SESSION, AUDIO, "ditado.webm", {
      getTranscriber: transcriber({ text: "Oi", seconds: null }),
    });
    expect(outcome.ok).toBe(true);
    expect(db.charges[0].amountCents).toBe(voiceHoldCents());
  });

  it("sem saldo (ou teto): não chama a IA e avisa, sem cobrar", async () => {
    db.refusal = "insufficient_balance";
    const spy = vi.fn();
    const outcome = await transcribeVoice(CARLA, SESSION, AUDIO, "ditado.webm", {
      getTranscriber: () => ({ transcribe: spy }),
    });
    expect(outcome).toMatchObject({ ok: false, status: 402 });
    expect(spy).not.toHaveBeenCalled();
    expect(db.charges).toEqual([]);
    expect(db.aiCalls).toEqual([]);
  });

  it("a transcrição que falhou não é cobrada, e a reserva fecha; o motivo fica no registro interno", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const outcome = await transcribeVoice(CARLA, SESSION, AUDIO, "ditado.webm", {
      getTranscriber: transcriber(new ProviderError("A chave do GPT não está configurada (OCK_GPT_KEY).", { retryable: false })),
    });
    expect(outcome).toEqual({ ok: false, status: 502, problem: VOICE_FAILED });
    expect(db.charges).toEqual([]);
    expect(db.closed).toEqual(["hold-1"]);
    expect(db.aiCalls[0]).toMatchObject({ status: "error", charged: false, cost_usd: 0 });
    expect(db.aiCalls[0].error_message).toContain("OCK_GPT_KEY");
    log.mockRestore();
  });

  it("áudio sem fala (texto vazio) não é cobrado da empresa, mas o custo fica no registro interno", async () => {
    const outcome = await transcribeVoice(CARLA, SESSION, AUDIO, "ditado.webm", {
      getTranscriber: transcriber({ text: "", seconds: 4 }),
    });
    expect(outcome).toEqual({ ok: false, status: 502, problem: VOICE_EMPTY });
    expect(db.charges).toEqual([]);
    expect(db.aiCalls[0]).toMatchObject({ status: "error", charged: false });
    expect(db.aiCalls[0].cost_usd).toBeGreaterThan(0);
  });

  it("com a transcrição simulada, devolve o texto de exemplo", async () => {
    const outcome = await transcribeVoice(CARLA, SESSION, AUDIO, "ditado.webm", { getTranscriber: createMockTranscriber });
    expect(outcome).toMatchObject({ ok: true, result: { text: "Texto ditado (transcrição simulada)." } });
  });
});

describe("o nome do arquivo de áudio", () => {
  it("tem a extensão do formato que o navegador gravou", () => {
    expect(audioFileName("audio/webm;codecs=opus")).toBe("ditado.webm");
    expect(audioFileName("audio/ogg")).toBe("ditado.ogg");
    expect(audioFileName("audio/mp4")).toBe("ditado.m4a");
    expect(audioFileName("audio/mpeg")).toBe("ditado.mp3");
    expect(audioFileName("")).toBe("ditado.webm");
  });
});

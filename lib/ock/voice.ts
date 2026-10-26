// A voz do chat: a pessoa dita, a IA transcreve e o texto volta para a caixa de escrever, para ela revisar e enviar. SÓ
// do servidor. O dinheiro segue as regras do chat (AGENTS.md, seção 5): antes de qualquer IA, reserva o máximo (o banco
// confere saldo, teto e se a pessoa está ativa); cobra o que a OpenAI informou, numa linha "Voz · Transcrição"; a
// transcrição que falhou (ou que não entendeu nada) não é cobrada, mas fica no registro interno (F26). O áudio não é
// guardado.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentMember } from "@/lib/auth/member";
import { transcriptionCostInUsd, usdToCents, USD_TO_BRL } from "@/lib/ock/pricing";
import { getTranscriber } from "@/lib/providers/registry";
import type { Transcriber, Transcript } from "@/lib/providers/transcribe";
import { ProviderError } from "@/lib/providers/types";
import { recordAiCalls, type AiCallRow } from "@/lib/runs/store";
import {
  chargeVoice,
  closeHold,
  reserveForVoice,
  taskRefusalMessage,
  WalletRefusedError,
} from "@/lib/runs/wallet";
import { MAX_VOICE_SECONDS, type MonthSpending } from "./chat";
import { loadMonth } from "./spending";

/** A linha do extrato: o que foi, nunca o que foi dito. */
export const VOICE_DESCRIPTION = "Voz · Transcrição";

export const VOICE_FAILED = "Não consegui transcrever o áudio agora. Nada foi cobrado. Tente de novo ou escreva.";
export const VOICE_EMPTY = "Não entendi nada no áudio. Nada foi cobrado. Fale de novo, mais perto do microfone.";

export type VoiceResult =
  | { ok: true; result: { text: string; costCents: number; month: MonthSpending } }
  | { ok: false; status: 402 | 502; problem: string };

export interface VoiceOptions {
  /** Os testes trocam quem transcreve. */
  getTranscriber?: () => Transcriber;
}

/** Um nome com a extensão certa, que a OpenAI usa para reconhecer o formato do áudio. */
export function audioFileName(mime: string): string {
  const type = mime.toLowerCase();
  if (type.includes("ogg")) return "ditado.ogg";
  if (type.includes("mp4") || type.includes("m4a") || type.includes("aac")) return "ditado.m4a";
  if (type.includes("mpeg") || type.includes("mp3")) return "ditado.mp3";
  if (type.includes("wav")) return "ditado.wav";
  return "ditado.webm";
}

/** O máximo que um ditado pode custar, em centavos: a reserva antes de chamar a IA. */
export function voiceHoldCents(): number {
  return usdToCents(transcriptionCostInUsd(MAX_VOICE_SECONDS));
}

/** Transcreve o ditado de quem está logado (`me`), cobrando da carteira da empresa. */
export async function transcribeVoice(
  me: CurrentMember,
  session: SupabaseClient,
  audio: Blob,
  fileName: string,
  options: VoiceOptions = {},
): Promise<VoiceResult> {
  let holdId: string;
  try {
    holdId = await reserveForVoice(me.id, voiceHoldCents());
  } catch (error) {
    if (error instanceof WalletRefusedError) {
      return { ok: false, status: 402, problem: taskRefusalMessage(error.reason, me.role === "owner", null) };
    }
    throw error;
  }

  const startedAt = Date.now();
  let transcript: Transcript | null = null;
  let failure: unknown = null;
  let charged = false;
  let costCents = 0;
  try {
    try {
      transcript = await (options.getTranscriber ?? getTranscriber)().transcribe(audio, fileName);
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      failure = error;
      console.error(`[chat] Não consegui transcrever o ditado de ${me.id}:`, error.message);
      return { ok: false, status: 502, problem: VOICE_FAILED };
    }
    if (!transcript.text) return { ok: false, status: 502, problem: VOICE_EMPTY };

    costCents = Math.max(1, usdToCents(transcriptCostUsd(transcript)));
    const remaining = await chargeVoice(holdId, { amountCents: costCents, description: VOICE_DESCRIPTION, provider: "gpt" });
    charged = remaining !== null;
    const month = await loadMonth(session, me.id);
    return { ok: true, result: { text: transcript.text, costCents: charged ? costCents : 0, month } };
  } finally {
    await settle(me, holdId, { transcript, failure, charged, durationMs: Date.now() - startedAt });
  }
}

/** O custo do ditado em dólar: pelos segundos que a OpenAI cobrou ou, sem eles, pelo máximo (nunca menos). */
function transcriptCostUsd(transcript: Transcript): number {
  return transcriptionCostInUsd(transcript.seconds ?? MAX_VOICE_SECONDS);
}

/** Fecha a reserva (a sobra volta) e registra a chamada à IA. Nunca derruba a resposta. */
async function settle(
  me: CurrentMember,
  holdId: string,
  call: { transcript: Transcript | null; failure: unknown; charged: boolean; durationMs: number },
): Promise<void> {
  try {
    await closeHold(holdId);
  } catch (error) {
    console.error(`[chat] Não consegui fechar a reserva ${holdId}:`, error);
  }
  const { transcript, failure } = call;
  if (!transcript && !failure) return;
  const row: AiCallRow = {
    company_id: me.companyId,
    member_id: me.id,
    run_id: null,
    task_id: null,
    step_id: "voice",
    attempt: 1,
    provider: "gpt",
    model: transcript?.model ?? (failure instanceof ProviderError ? failure.model : undefined) ?? "desconhecido",
    tier: "padrao",
    input_tokens: 0,
    output_tokens: 0,
    // A coluna guarda 6 casas depois da vírgula. A transcrição que falhou não é cobrada pela OpenAI.
    cost_usd: transcript ? Number(transcriptCostUsd(transcript).toFixed(6)) : 0,
    usd_brl: USD_TO_BRL,
    charged: call.charged,
    status: transcript?.text ? "ok" : "error",
    error_message: transcript
      ? transcript.text
        ? null
        : "A transcrição veio vazia."
      : (failure instanceof Error ? failure.message : String(failure)).slice(0, 2000),
    duration_ms: Math.max(0, Math.round(call.durationMs)),
  };
  try {
    await recordAiCalls([row]);
  } catch (error) {
    console.error(`[chat] Não consegui registrar a transcrição de ${me.id}:`, error);
  }
}

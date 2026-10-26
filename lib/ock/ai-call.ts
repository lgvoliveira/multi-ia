// Chamar uma IA na tarefa rápida: junta a resposta inteira, tenta de novo quando o erro é passageiro (como nas
// receitas: até 2 vezes, depois de 1 s e de 2 s) e avisa cada tentativa, terminada ou não, para o registro interno do
// custo (F26). Erro que não adianta repetir (ex.: a IA recusou) e defeito no nosso código param na hora. SÓ do servidor.

import { RETRY_DELAYS_MS } from "@/lib/engine/run";
import type { AiCallReport } from "@/lib/engine/types";
import { estimateTokens } from "@/lib/providers/mock";
import { DEFAULT_TIER, ProviderError, type AiProvider, type GenerateRequest, type Usage } from "@/lib/providers/types";

/** A resposta inteira de uma IA. */
export interface AiAnswer {
  text: string;
  usage: Usage;
  model: string;
  /** true quando a resposta foi cortada por atingir o limite. */
  truncated: boolean;
}

export interface CallOptions {
  /** O nome da chamada no registro interno: "chief" (o Chefe decidindo) ou "answer" (a IA respondendo). */
  stepId: string;
  /** Avisado no fim de cada tentativa, tenha dado certo ou não. */
  onCall: (report: AiCallReport) => void;
  /** As esperas antes de cada nova tentativa. Sem novas tentativas: []. */
  retryDelaysMs?: readonly number[];
  /** Os testes trocam a espera e o relógio. */
  wait?: (ms: number) => Promise<void>;
  now?: () => number;
}

/** Chama a IA até dar certo ou acabarem as tentativas. Na última falha, repassa o erro. */
export async function callAi(provider: AiProvider, request: GenerateRequest, options: CallOptions): Promise<AiAnswer> {
  const delays = options.retryDelaysMs ?? RETRY_DELAYS_MS;
  const wait = options.wait ?? sleep;
  for (let attempt = 1; ; attempt++) {
    try {
      return await attemptOnce(provider, request, attempt, options);
    } catch (error) {
      const delayMs = delays[attempt - 1];
      const retryable = error instanceof ProviderError && error.retryable;
      if (!retryable || delayMs === undefined) throw error;
      await wait(delayMs);
    }
  }
}

async function attemptOnce(
  provider: AiProvider,
  request: GenerateRequest,
  attempt: number,
  options: CallOptions,
): Promise<AiAnswer> {
  const now = options.now ?? Date.now;
  const startedAt = now();
  let text = "";
  let answer: AiAnswer | null = null;
  let failure: unknown = undefined;

  try {
    for await (const chunk of provider.generate(request)) {
      if (chunk.type === "text") {
        text += chunk.text;
        continue;
      }
      answer = { text, usage: chunk.usage, model: chunk.model, truncated: chunk.truncated };
      return answer;
    }
    // A IA parou de mandar pedaços sem avisar que terminou: a resposta pode estar pela metade.
    throw new ProviderError("A IA parou de responder antes de terminar.", { retryable: true });
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    options.onCall({
      stepId: options.stepId,
      provider: provider.id,
      model: answer?.model ?? (failure instanceof ProviderError ? failure.model : undefined) ?? null,
      tier: request.tier ?? DEFAULT_TIER,
      // Sem a conta da IA (ela não terminou e não informou o consumo), conta pelo tamanho do que foi enviado e do que
      // ela escreveu.
      usage: answer?.usage ?? (failure instanceof ProviderError ? failure.usage : undefined) ?? {
        inputTokens: estimateTokens(request.systemPrompt + request.input),
        outputTokens: estimateTokens(text),
      },
      ok: answer !== null,
      ...(answer ? {} : { errorMessage: failure instanceof Error ? failure.message : String(failure) }),
      attempt,
      durationMs: now() - startedAt,
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

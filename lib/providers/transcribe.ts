// Transcrever a voz (ditar a mensagem do chat): o gpt-transcribe, da OpenAI, e a transcrição simulada. SÓ do servidor.
// A chave vem por parâmetro e nunca é gravada nem registrada em log. O áudio só passa por aqui: não é guardado.

import { TRANSCRIBE_MODEL } from "./models";
import { ProviderError } from "./types";

export interface Transcript {
  text: string;
  /** Quantos segundos de áudio a OpenAI cobrou, ou null se ela não informou. */
  seconds: number | null;
  /** Modelo exato usado (vai para o histórico interno). */
  model: string;
}

/** Quem transcreve: recebe o áudio e devolve o texto. Falha com ProviderError, como as IAs. */
export interface Transcriber {
  transcribe(audio: Blob, fileName: string, signal?: AbortSignal): Promise<Transcript>;
}

/** Os testes trocam o fetch por respostas gravadas, sem chamar a internet. */
export interface TranscriberOptions {
  fetch?: typeof fetch;
}

/** O gpt-transcribe da OpenAI, em português. US$ 0,0045 por minuto de áudio. */
export function createOpenAiTranscriber(apiKey: string, options: TranscriberOptions = {}): Transcriber {
  const fetchImpl = options.fetch ?? fetch;
  return {
    async transcribe(audio, fileName, signal) {
      const form = new FormData();
      form.append("file", audio, fileName);
      form.append("model", TRANSCRIBE_MODEL.id);
      form.append("language", "pt");
      form.append("response_format", "json");

      let response: Response;
      try {
        response = await fetchImpl("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
          signal,
        });
      } catch (error) {
        if (signal?.aborted) throw error;
        throw new ProviderError("Não deu para falar com a IA agora.", { retryable: true, model: TRANSCRIBE_MODEL.id });
      }

      if (!response.ok) {
        let detail = "";
        try {
          detail = (await response.text()).slice(0, 300);
        } catch {
          // sem corpo de erro
        }
        throw new ProviderError(`A IA respondeu com erro (${response.status}).${detail ? ` ${detail}` : ""}`, {
          retryable: response.status === 429 || response.status >= 500,
          model: TRANSCRIBE_MODEL.id,
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: any = await response.json().catch(() => null);
      if (typeof body?.text !== "string") {
        throw new ProviderError("A IA não devolveu o texto.", { retryable: true, model: TRANSCRIBE_MODEL.id });
      }
      const seconds = body.usage?.type === "duration" && typeof body.usage.seconds === "number" ? body.usage.seconds : null;
      return { text: body.text.trim(), seconds, model: TRANSCRIBE_MODEL.id };
    },
  };
}

/** O texto que a transcrição simulada devolve. */
export const MOCK_TRANSCRIPT = "Texto ditado (transcrição simulada).";

/** A transcrição simulada: não chama ninguém e "custa" o mesmo que 5 segundos de áudio de verdade. */
export function createMockTranscriber(): Transcriber {
  return {
    async transcribe(_audio, _fileName, signal) {
      signal?.throwIfAborted();
      return { text: MOCK_TRANSCRIPT, seconds: 5, model: "mock-gpt-transcribe" };
    },
  };
}

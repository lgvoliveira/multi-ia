// O gpt-transcribe com respostas gravadas no formato da OpenAI (nenhuma chamada sai para a internet) e a simulada.

import { describe, expect, it, vi } from "vitest";
import { createMockTranscriber, createOpenAiTranscriber, MOCK_TRANSCRIPT } from "./transcribe";
import { ProviderError } from "./types";

const KEY = "sk-chave-de-teste-123";

function setup(response: Response) {
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    void url;
    void init;
    return response;
  });
  const transcriber = createOpenAiTranscriber(KEY, { fetch: fetchMock as unknown as typeof fetch });
  return { transcriber, fetchMock };
}

const audio = new Blob(["áudio de mentira"], { type: "audio/webm" });

describe("gpt-transcribe", () => {
  it("manda o áudio com o modelo conferido, em português, e devolve o texto e os segundos cobrados", async () => {
    const { transcriber, fetchMock } = setup(
      Response.json({ text: " Preciso de um orçamento para amanhã. ", usage: { type: "duration", seconds: 7.4 } }),
    );

    const transcript = await transcriber.transcribe(audio, "ditado.webm");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    const form = init?.body as FormData;
    expect(form.get("model")).toBe("gpt-transcribe");
    expect(form.get("language")).toBe("pt");
    expect((form.get("file") as File).name).toBe("ditado.webm");
    expect(transcript).toEqual({ text: "Preciso de um orçamento para amanhã.", seconds: 7.4, model: "gpt-transcribe" });
  });

  it("sem os segundos no consumo, devolve null (quem chama cobra o máximo)", async () => {
    const { transcriber } = setup(Response.json({ text: "Oi", usage: { type: "tokens", input_tokens: 10, output_tokens: 2 } }));
    expect((await transcriber.transcribe(audio, "ditado.webm")).seconds).toBeNull();
  });

  it("limite de uso e falha do servidor valem nova tentativa; chave errada, não; a chave nunca aparece no erro", async () => {
    for (const [status, retryable] of [
      [429, true],
      [500, true],
      [401, false],
      [400, false],
    ] as const) {
      const { transcriber } = setup(new Response("{}", { status }));
      const error = await transcriber.transcribe(audio, "ditado.webm").catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(ProviderError);
      expect(error).toMatchObject({ retryable, model: "gpt-transcribe" });
      expect((error as Error).message).not.toContain(KEY);
    }
  });

  it("resposta sem o texto vale tentar de novo", async () => {
    const { transcriber } = setup(Response.json({ usage: { type: "duration", seconds: 3 } }));
    await expect(transcriber.transcribe(audio, "ditado.webm")).rejects.toMatchObject({ retryable: true });
  });
});

describe("transcrição simulada", () => {
  it("devolve um texto de exemplo e 5 segundos, sem chamar ninguém", async () => {
    expect(await createMockTranscriber().transcribe(audio, "ditado.webm")).toEqual({
      text: MOCK_TRANSCRIPT,
      seconds: 5,
      model: "mock-gpt-transcribe",
    });
  });
});

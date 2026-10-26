// O GPT Image com respostas gravadas no formato da OpenAI (nenhuma chamada sai para a internet) e a imagem simulada.

import { afterEach, describe, expect, it, vi } from "vitest";
import { imageCostInUsd } from "@/lib/ock/pricing";
import { createMockImageGenerator, createOpenAiImageGenerator, maxImageUsage } from "./images";
import { maxInputTokens } from "./limits";
import { IMAGE_MODEL } from "./models";
import { ProviderError } from "./types";

const KEY = "sk-chave-de-teste-123";
const JPEG_BASE64 = Buffer.from("imagem de mentira").toString("base64");

function setup(response: Response) {
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    void url;
    void init;
    return response;
  });
  const generator = createOpenAiImageGenerator(KEY, { fetch: fetchMock as unknown as typeof fetch });
  const sent = () => {
    const [url, init] = fetchMock.mock.calls[0];
    return { url: String(url), headers: (init?.headers ?? {}) as Record<string, string>, body: JSON.parse(String(init?.body)) };
  };
  return { generator, sent };
}

const ok = (usage?: unknown) =>
  new Response(JSON.stringify({ created: 1, data: [{ b64_json: JPEG_BASE64 }], ...(usage ? { usage } : {}) }), { status: 200 });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GPT Image", () => {
  it("pede uma imagem quadrada, de qualidade média, em JPEG, com o modelo conferido", async () => {
    const { generator, sent } = setup(ok({ input_tokens: 30, output_tokens: 1770, input_tokens_details: { text_tokens: 30, image_tokens: 0 } }));

    await generator.generate("Um banner para uma padaria");

    const { url, headers, body } = sent();
    expect(url).toBe("https://api.openai.com/v1/images/generations");
    expect(headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(body).toEqual({
      model: "gpt-image-2",
      prompt: "Um banner para uma padaria",
      n: 1,
      size: "1024x1024",
      quality: "medium",
      output_format: "jpeg",
      output_compression: 85,
    });
  });

  it("devolve a imagem e o consumo informado pela OpenAI", async () => {
    const { generator } = setup(ok({ input_tokens: 42, output_tokens: 1790, input_tokens_details: { text_tokens: 40, image_tokens: 2 } }));

    const image = await generator.generate("Um logo");

    expect(Buffer.from(image.bytes).toString()).toBe("imagem de mentira");
    expect(image).toMatchObject({
      mime: "image/jpeg",
      model: "gpt-image-2",
      usage: { textInputTokens: 40, imageInputTokens: 2, outputTokens: 1790 },
    });
  });

  it("sem o consumo (não deveria acontecer), conta o máximo da imagem, nunca menos", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { generator } = setup(ok());
    expect((await generator.generate("Um logo")).usage).toEqual(maxImageUsage("Um logo"));
    expect(warn).toHaveBeenCalledOnce();
  });

  it("pedido barrado pelas regras de conteúdo não adianta repetir; sobrecarga e limite de uso, sim", async () => {
    const blocked = new Response(
      JSON.stringify({ error: { type: "image_generation_user_error", code: "moderation_blocked", message: "Blocked" } }),
      { status: 400 },
    );
    const cases: [Response, boolean][] = [
      [blocked, false],
      [new Response("{}", { status: 401 }), false],
      [new Response("{}", { status: 429 }), true],
      [new Response("{}", { status: 503 }), true],
    ];
    for (const [response, retryable] of cases) {
      const { generator } = setup(response);
      const error = await generator.generate("x").catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(ProviderError);
      expect(error).toMatchObject({ retryable, model: "gpt-image-2" });
      expect((error as Error).message).not.toContain(KEY);
    }
  });

  it("resposta sem a imagem vale tentar de novo", async () => {
    const { generator } = setup(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await expect(generator.generate("x")).rejects.toMatchObject({ retryable: true });
  });
});

describe("preço e reserva da imagem", () => {
  it("uma imagem média custa uns US$ 0,053, como na tabela da OpenAI", () => {
    const usage = { textInputTokens: 0, imageInputTokens: 0, outputTokens: IMAGE_MODEL.typicalOutputTokens };
    expect(imageCostInUsd(usage)).toBeCloseTo(0.053, 3);
  });

  it("o texto do pedido e as imagens de referência têm preços próprios", () => {
    expect(imageCostInUsd({ textInputTokens: 1_000_000, imageInputTokens: 0, outputTokens: 0 })).toBe(5);
    expect(imageCostInUsd({ textInputTokens: 0, imageInputTokens: 1_000_000, outputTokens: 0 })).toBe(8);
  });

  it("o máximo de uma imagem cobre o pedido inteiro e a folga de saída", () => {
    expect(maxImageUsage("a".repeat(300))).toEqual({
      textInputTokens: maxInputTokens("a".repeat(300)),
      imageInputTokens: 0,
      outputTokens: IMAGE_MODEL.maxOutputTokens,
    });
    expect(IMAGE_MODEL.maxOutputTokens).toBeGreaterThan(IMAGE_MODEL.typicalOutputTokens);
  });
});

describe("imagem simulada", () => {
  it("devolve um PNG pequeno, sem chamar ninguém, com o consumo típico de uma imagem de verdade", async () => {
    const image = await createMockImageGenerator().generate("Um logo");
    expect([...image.bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(image).toMatchObject({ mime: "image/png", model: "mock-gpt-image" });
    expect(image.usage.outputTokens).toBe(IMAGE_MODEL.typicalOutputTokens);
  });
});

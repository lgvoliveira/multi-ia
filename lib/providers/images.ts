// Criar imagens: o GPT Image, da OpenAI, e a imagem simulada. Fica à parte dos conectores de texto (real.ts), porque a
// imagem chega inteira, numa resposta só, e tem preço próprio. A chave vem por parâmetro e nunca é gravada nem
// registrada em log.

import { IMAGE_MODEL } from "./models";
import { maxInputTokens } from "./limits";
import { ProviderError } from "./types";

/** O consumo de uma imagem, em tokens: o texto do pedido, as imagens de referência (não usamos) e a imagem criada. */
export interface ImageUsage {
  textInputTokens: number;
  imageInputTokens: number;
  outputTokens: number;
}

export interface GeneratedImage {
  bytes: Uint8Array;
  mime: "image/jpeg" | "image/png";
  usage: ImageUsage;
  /** Modelo exato usado (vai para o histórico interno). */
  model: string;
}

/** Quem cria as imagens: recebe o pedido e devolve a imagem pronta. Falha com ProviderError, como as IAs de texto. */
export interface ImageGenerator {
  generate(prompt: string, signal?: AbortSignal): Promise<GeneratedImage>;
}

/** O maior consumo possível de uma imagem com este pedido, para a reserva. */
export function maxImageUsage(prompt: string): ImageUsage {
  return { textInputTokens: maxInputTokens(prompt), imageInputTokens: 0, outputTokens: IMAGE_MODEL.maxOutputTokens };
}

/** Os testes trocam o fetch por respostas gravadas, sem chamar a internet. */
export interface ImageGeneratorOptions {
  fetch?: typeof fetch;
}

/**
 * O GPT Image da OpenAI. Uma imagem quadrada (1024 × 1024), de qualidade média, em JPEG: uns US$ 0,053 (tabela da
 * OpenAI, conferida em 26/10/2026). A OpenAI barra pedidos fora das regras de conteúdo dela ("moderation_blocked"):
 * não adianta repetir.
 */
export function createOpenAiImageGenerator(apiKey: string, options: ImageGeneratorOptions = {}): ImageGenerator {
  const fetchImpl = options.fetch ?? fetch;
  return {
    async generate(prompt, signal) {
      let response: Response;
      try {
        response = await fetchImpl("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({
            model: IMAGE_MODEL.id,
            prompt,
            n: 1,
            size: IMAGE_MODEL.size,
            quality: IMAGE_MODEL.quality,
            output_format: "jpeg",
            output_compression: 85,
          }),
          signal,
        });
      } catch (error) {
        if (signal?.aborted) throw error;
        throw new ProviderError("Não deu para falar com a IA agora.", { retryable: true, model: IMAGE_MODEL.id });
      }

      if (!response.ok) {
        let detail = "";
        try {
          detail = (await response.text()).slice(0, 300);
        } catch {
          // sem corpo de erro
        }
        const retryable = !detail.includes("moderation_blocked") && (response.status === 429 || response.status >= 500);
        throw new ProviderError(`A IA respondeu com erro (${response.status}).${detail ? ` ${detail}` : ""}`, {
          retryable,
          model: IMAGE_MODEL.id,
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: any = await response.json().catch(() => null);
      const base64 = body?.data?.[0]?.b64_json;
      if (typeof base64 !== "string" || !base64) {
        throw new ProviderError("A IA não devolveu a imagem.", { retryable: true, model: IMAGE_MODEL.id });
      }
      return { bytes: Buffer.from(base64, "base64"), mime: "image/jpeg", usage: imageUsage(body.usage, prompt), model: IMAGE_MODEL.id };
    },
  };
}

/**
 * O consumo informado pela OpenAI. Se não vier (não deveria acontecer), conta o máximo, para a plataforma nunca cobrar
 * menos do que pagou.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function imageUsage(usage: any, prompt: string): ImageUsage {
  if (typeof usage?.output_tokens !== "number") {
    console.warn(`[ias] O modelo ${IMAGE_MODEL.id} não informou o consumo; foi contado o máximo da imagem.`);
    return maxImageUsage(prompt);
  }
  const details = usage.input_tokens_details ?? {};
  const imageInput = Number(details.image_tokens ?? 0);
  const textInput = Number(details.text_tokens ?? Math.max(0, Number(usage.input_tokens ?? 0) - imageInput));
  return { textInputTokens: textInput, imageInputTokens: imageInput, outputTokens: usage.output_tokens };
}

/** Um quadriculado azul de 64 × 64, a "imagem" da IA simulada. */
const MOCK_IMAGE_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAbUlEQVR42u3XMQ0AIAxFQfRgAR1YwC8OkIKBMnWBcAljB256+aW2Gb4+Vvhuuy8AAAAAACnAKx893QMAAAAA5ABKDAAAAGAPKDEAAACAPaDEAAAAAPaAEgMAAADYA0oMAAAAYA8oMQAAAMA3gA17CYlLpYgTEwAAAABJRU5ErkJggg==";

/** A imagem simulada: não chama ninguém e "custa" o mesmo que uma imagem de verdade, para testar a cobrança. */
export function createMockImageGenerator(): ImageGenerator {
  return {
    async generate(prompt, signal) {
      signal?.throwIfAborted();
      return {
        bytes: Buffer.from(MOCK_IMAGE_PNG, "base64"),
        mime: "image/png",
        usage: { textInputTokens: maxInputTokens(prompt), imageInputTokens: 0, outputTokens: IMAGE_MODEL.typicalOutputTokens },
        model: "mock-gpt-image",
      };
    },
  };
}

// Geração de imagem: usa a API de imagem da OpenAI (chave do GPT da pessoa). Devolve a imagem em base64.
// Só o servidor usa. Sem chave real, quem chama trata o erro e mostra um aviso.

import { ProviderError } from "@/lib/providers/types";

export interface GeneratedImage {
  mime: string;
  base64: string;
}

/** Gera uma imagem a partir de um texto, com a chave do GPT. Devolve o conteúdo em base64. */
export async function generateImage(apiKey: string, prompt: string): Promise<GeneratedImage> {
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-1", prompt, n: 1, size: "1024x1024" }),
    });
  } catch {
    throw new ProviderError("Não deu para falar com o gerador de imagem.", { retryable: true });
  }
  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    throw new ProviderError(`O gerador de imagem respondeu com erro (${response.status}).`, { retryable });
  }
  const data = (await response.json()) as { data?: { b64_json?: string; url?: string }[] };
  const item = data.data?.[0];
  if (item?.b64_json) return { mime: "image/png", base64: item.b64_json };
  // Alguns modelos devolvem URL em vez de base64: baixa e converte.
  if (item?.url) {
    const img = await fetch(item.url);
    const bytes = new Uint8Array(await img.arrayBuffer());
    return { mime: img.headers.get("content-type") ?? "image/png", base64: Buffer.from(bytes).toString("base64") };
  }
  throw new ProviderError("O gerador de imagem não devolveu uma imagem.", { retryable: true });
}

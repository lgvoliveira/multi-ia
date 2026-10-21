// Busca na web: liga a ferramenta "google_search" do Gemini (chave do Gemini da empresa). A própria IA
// pesquisa no Google e responde com as FONTES. Não é um buscador à parte — é a IA conectada fazendo a busca.
// Só o servidor usa.

import { estimateTokens } from "@/lib/providers/mock";
import { ProviderError } from "@/lib/providers/types";

const MODEL = "gemini-flash-latest";

export interface SearchResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/** Pede ao Gemini para pesquisar na web (Google) e responder com fontes. */
export async function searchWithGemini(apiKey: string, prompt: string): Promise<SearchResult> {
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
        }),
      },
    );
  } catch {
    throw new ProviderError("Não deu para falar com a busca.", { retryable: true });
  }
  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    throw new ProviderError(`A busca respondeu com erro (${response.status}).`, { retryable });
  }

  const data = (await response.json()) as {
    candidates?: {
      content?: { parts?: { text?: string }[] };
      groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] };
    }[];
  };
  const candidate = data.candidates?.[0];
  const body = (candidate?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!body) throw new ProviderError("A busca não devolveu resposta.", { retryable: true });

  // Junta as fontes que a IA usou.
  const chunks = candidate?.groundingMetadata?.groundingChunks ?? [];
  const sources = chunks
    .map((c) => c.web)
    .filter((w): w is { uri?: string; title?: string } => Boolean(w))
    .map((w) => `- ${w.title ?? w.uri} (${w.uri ?? ""})`)
    .join("\n");

  const text = sources ? `${body}\n\nFontes:\n${sources}` : body;
  return { text, inputTokens: estimateTokens(prompt), outputTokens: estimateTokens(text) };
}

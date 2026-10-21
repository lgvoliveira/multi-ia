// Execução de código: usa a ferramenta "code_execution" do Gemini. O código roda no AMBIENTE SEGURO do
// Google (sandbox), NÃO no nosso servidor — por isso é seguro. Montamos a resposta juntando o texto,
// o código que a IA escreveu e o resultado da execução. Só o servidor usa (chave do Gemini da pessoa).

import { estimateTokens } from "@/lib/providers/mock";
import { ProviderError } from "@/lib/providers/types";

const MODEL = "gemini-flash-latest";

export interface CodeResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/** Pede ao Gemini para resolver a tarefa escrevendo E rodando código no sandbox dele. */
export async function runCodeWithGemini(apiKey: string, prompt: string): Promise<CodeResult> {
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          tools: [{ code_execution: {} }],
        }),
      },
    );
  } catch {
    throw new ProviderError("Não deu para falar com o ambiente de código.", { retryable: true });
  }
  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    throw new ProviderError(`O ambiente de código respondeu com erro (${response.status}).`, { retryable });
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: CodePart[] } }[];
  };
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map(renderPart).filter(Boolean).join("\n\n").trim();
  if (!text) throw new ProviderError("O ambiente de código não devolveu resposta.", { retryable: true });

  return { text, inputTokens: estimateTokens(prompt), outputTokens: estimateTokens(text) };
}

interface CodePart {
  text?: string;
  executableCode?: { language?: string; code?: string };
  codeExecutionResult?: { outcome?: string; output?: string };
}

/** Transforma cada pedaço da resposta em texto legível: explicação, o código, e o resultado da execução. */
function renderPart(part: CodePart): string {
  if (part.text) return part.text;
  if (part.executableCode?.code) {
    const lang = (part.executableCode.language ?? "python").toLowerCase();
    return `\`\`\`${lang}\n${part.executableCode.code}\n\`\`\``;
  }
  if (part.codeExecutionResult?.output != null) {
    return `Resultado da execução:\n\`\`\`\n${part.codeExecutionResult.output}\n\`\`\``;
  }
  return "";
}

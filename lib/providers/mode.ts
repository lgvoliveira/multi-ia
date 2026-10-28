// Qual IA a plataforma usa: a simulada ou a de verdade (F42). A IA simulada nunca entra no lugar da de verdade sem
// alguém ter pedido: com as IAs de verdade ligadas, uma IA sem chave falha (e a troca de IA entra), em vez de devolver
// uma resposta de mentira cobrada como se fosse de verdade.

import { hasAnyDemoKey } from "@/lib/keys/demo-keys";

export type AiMode = "simulada" | "real";

/**
 * Lê o interruptor OCK_AI_MODE (veja .env.example):
 * - "real": as IAs de verdade, com as chaves da plataforma.
 * - "simulada": todas simuladas (respostas de mentira, cobradas como as de verdade, para testar a carteira).
 * - vazio: simulada no computador de desenvolvimento (`npm run dev` e os testes) e real em qualquer outro lugar (o site
 *   no ar), para o site publicado nunca cair na simulada por esquecimento.
 * Outro valor é erro, para ninguém achar que ligou uma coisa e estar com outra.
 */
export function aiMode(env: Record<string, string | undefined> = process.env): AiMode {
  const value = env.OCK_AI_MODE?.trim().toLowerCase() ?? "";
  if (value === "real" || value === "simulada") return value;
  if (value) throw new Error(`OCK_AI_MODE: não entendi "${value}". Use "real" ou "simulada".`);
  // Na visão raio-x, conectar uma chave pela tela já liga a IA real (sem precisar mexer no OCK_AI_MODE).
  if (hasAnyDemoKey()) return "real";
  return env.NODE_ENV === "development" || env.NODE_ENV === "test" ? "simulada" : "real";
}

/** As ferramentas que dá para ligar, com o nome que vai no interruptor OCK_AI_TOOLS. */
export type ToolSwitch = "pesquisa" | "codigo" | "imagem" | "voz";
const TOOL_SWITCHES: readonly ToolSwitch[] = ["pesquisa", "codigo", "imagem", "voz"];

/**
 * Lê o interruptor OCK_AI_TOOLS (veja .env.example): quais ferramentas estão ligadas, separadas por vírgula
 * ("pesquisa,codigo,imagem,voz"). Vazio: nenhuma (o padrão, até o Luis decidir ligar). Com a IA simulada, as
 * ferramentas ligadas são fingidas (uma fonte de exemplo, um programa "rodado", um quadriculado no lugar da imagem, um
 * texto de exemplo no lugar do ditado), para testar a tela sem gastar. Nome que não dá para
 * entender é erro, como nos outros interruptores.
 */
export function aiTools(env: Record<string, string | undefined> = process.env): Set<ToolSwitch> {
  const tools = new Set<ToolSwitch>();
  for (const entry of (env.OCK_AI_TOOLS ?? "").split(",").map((part) => part.trim().toLowerCase())) {
    if (!entry) continue;
    const tool = TOOL_SWITCHES.find((name) => name === entry);
    if (!tool) throw new Error(`OCK_AI_TOOLS: não entendi "${entry}". Use, por exemplo, "pesquisa,codigo".`);
    tools.add(tool);
  }
  return tools;
}

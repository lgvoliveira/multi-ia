// Qual IA a plataforma usa: a simulada ou a de verdade (F42). A IA simulada nunca entra no lugar da de verdade sem
// alguém ter pedido: com as IAs de verdade ligadas, uma IA sem chave falha (e a troca de IA entra), em vez de devolver
// uma resposta de mentira cobrada como se fosse de verdade.

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
  return env.NODE_ENV === "development" || env.NODE_ENV === "test" ? "simulada" : "real";
}

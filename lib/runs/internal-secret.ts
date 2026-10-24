// O segredo da chamada interna /api/runs/<id>/continue, que o servidor faz em si mesmo para seguir a execução.
// SÓ do servidor. Ele é tirado da chave secreta do Supabase (SUPABASE_SECRET_KEY), que já fica no .env.local e na
// hospedagem: não há uma configuração a mais para lembrar. O valor tirado dela não revela a chave.

import { createHmac, timingSafeEqual } from "node:crypto";

/** O cabeçalho em que o segredo viaja. */
export const INTERNAL_SECRET_HEADER = "x-internal-secret";

/** O segredo da chamada interna. Sem a chave secreta do Supabase, não há segredo, e a chamada é sempre recusada. */
export function internalRunSecret(): string | null {
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!key) return null;
  return createHmac("sha256", key).update("multi-ia/runs/continue").digest("hex");
}

/** Confere se o pedido veio do próprio servidor (com o segredo certo no cabeçalho). */
export function isInternalCall(request: Request): boolean {
  const expected = internalRunSecret();
  const received = request.headers.get(INTERNAL_SECRET_HEADER);
  if (!expected || !received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  // Comparação em tempo constante: o tempo da resposta não revela quantos caracteres bateram.
  return a.length === b.length && timingSafeEqual(a, b);
}

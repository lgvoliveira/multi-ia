// As chaves-mãe da PLATAFORMA (OCK), lidas SÓ do servidor (env do Vercel / cofre).
// Toda empresa usa estas chaves; a OCK mede e trava por empresa e por funcionário no nosso banco.
// A empresa nunca conecta nem vê chave nenhuma. Nunca expor estes valores ao cliente nem em log.
//
// Variáveis de ambiente (defina no Vercel): OCK_CLAUDE_KEY, OCK_GPT_KEY, OCK_GEMINI_KEY.
// Sem uma delas, aquela IA cai no modo simulado (dá para testar o fluxo sem gastar).

import type { ProviderKeys } from "@/lib/providers/registry";

export function serverKeys(): ProviderKeys {
  const keys: ProviderKeys = {};
  const claude = process.env.OCK_CLAUDE_KEY?.trim();
  const gpt = process.env.OCK_GPT_KEY?.trim();
  const gemini = process.env.OCK_GEMINI_KEY?.trim();
  if (claude) keys.claude = claude;
  if (gpt) keys.gpt = gpt;
  if (gemini) keys.gemini = gemini;
  return keys;
}

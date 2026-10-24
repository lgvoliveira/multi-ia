// Cliente do Supabase com a chave secreta (SUPABASE_SECRET_KEY): SÓ do servidor.
// A chave secreta passa por cima das regras de acesso (RLS), então NUNCA pode ir para o navegador.
// É por aqui que o servidor faz o que a sessão de quem está logado não pode: criar a empresa e as pessoas, gravar
// execuções, tarefas e arquivos e mexer no dinheiro (só pelas funções da carteira).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/** Devolve o cliente de serviço, criado uma vez e reaproveitado. Sem sessão: cada chamada é do próprio servidor. */
export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SECRET_KEY no ambiente.");
  }

  cached = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

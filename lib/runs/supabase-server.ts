// Cliente do Supabase com a chave de serviço (service-role): SÓ do servidor.
// A chave de serviço passa por cima das regras de linha (RLS), então NUNCA pode ir para o navegador.
// É por aqui que o servidor lê e grava as tabelas de execução (runs, run_events, run_steps, run_secrets).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/** Devolve o cliente de serviço, criado uma vez e reaproveitado. Sem sessão: cada chamada é do próprio servidor. */
export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  }

  cached = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

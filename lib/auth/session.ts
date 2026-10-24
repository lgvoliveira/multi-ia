// O Supabase visto com a sessão de quem está logado (o "crachá"): SÓ do servidor. Tudo o que passa por aqui obedece às
// regras de acesso do banco, então uma consulta que esquecer de filtrar pela empresa continua vendo só o que pode.
// Um cliente novo a cada pedido, nunca reaproveitado entre pessoas.

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";

/**
 * O cliente com a sessão, só se há alguém logado (login conferido pela assinatura). Para rotas que só leem: as regras
 * do banco decidem o que a pessoa vê, sem precisar ler o cadastro dela antes.
 */
export async function signedInSession(): Promise<SupabaseClient | null> {
  const supabase = await createSessionClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ? supabase : null;
}

/** Cria o cliente com o cookie do login. Devolve null se o login não estiver configurado neste computador. */
export async function createSessionClient(): Promise<SupabaseClient | null> {
  // Lê os cookies antes de tudo: assim a página é sempre montada na hora do pedido, mesmo sem configuração,
  // e nunca fica guardada pronta (com o topo de "ninguém logado") desde o build.
  const cookieStore = await cookies();
  const config = supabaseConfig();
  if (!config) return null;

  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Dentro de uma página não dá para gravar cookie. Sem problema: o proxy.ts renova o login a cada página.
        }
      },
    },
  });
}

// Endereço do Supabase e chave pública (publishable). Os dois podem ir para o navegador: quem protege os dados são as
// regras de acesso do banco (RLS), não o segredo da chave. A chave secreta fica em lib/runs/supabase-server.ts.

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

/** Devolve a configuração, ou null se faltar alguma variável no .env.local (o login fica indisponível). */
export function supabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

/** Mensagem para a tela quando o login não está configurado neste computador. */
export const LOGIN_NOT_CONFIGURED =
  "O login ainda não está configurado neste computador (faltam as chaves do Supabase no .env.local).";

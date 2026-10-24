// Renova o login a cada página, antes de ela ser montada (chamado pelo proxy.ts). O login do Supabase vence em 1 hora;
// aqui ele é trocado por um novo e o cookie atualizado volta para o navegador. Não decide quem pode ver o quê: isso
// é conferido em cada página e em cada rota (lib/auth/viewer.ts), perto dos dados.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "./config";

export async function refreshSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const config = supabaseConfig();
  if (!config) return response;

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // O login novo vai para a página que está sendo montada (pedido) e para o navegador (resposta).
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // Cabeçalhos que impedem um intermediário de guardar a resposta com o login de alguém.
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Nada entre criar o cliente e esta linha: é ela que confere o login e, se ele estiver vencendo, o renova.
  await supabase.auth.getClaims();
  return response;
}

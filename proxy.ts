// Roda antes de cada página (no Next.js 16, o antigo "middleware" se chama "proxy"). Só renova o login;
// quem pode ver o quê é conferido em cada página e rota.

import type { NextRequest } from "next/server";
import { refreshSession } from "@/lib/auth/refresh-session";

export function proxy(request: NextRequest) {
  return refreshSession(request);
}

export const config = {
  // Tudo, menos os arquivos fixos do site (scripts, estilos, imagens), que não dependem de login.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

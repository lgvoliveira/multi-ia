// GET /confirmar?code=...: para onde volta o link do e-mail de confirmação do cadastro. O Supabase confirma o e-mail
// antes de mandar a pessoa para cá; aqui o código vira o login (só funciona no mesmo navegador do cadastro) e, no
// primeiro acesso, a empresa nasce. Qualquer outro caso (outro navegador, link vencido ou já usado) vai para "Entrar"
// com um aviso: se o e-mail já foi confirmado, basta entrar com a senha.

import { NextResponse, type NextRequest } from "next/server";
import { ensureOwnerCompany } from "@/lib/auth/company-signup";
import { createSessionClient } from "@/lib/auth/session";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");

  if (code) {
    const supabase = await createSessionClient();
    const result = supabase ? await supabase.auth.exchangeCodeForSession(code) : null;
    if (result?.data.user) {
      await ensureOwnerCompany(result.data.user);
      return NextResponse.redirect(new URL("/", request.url));
    }
    if (result?.error) console.error("[confirmar] Código não aceito:", result.error.code);
  }

  const notice = params.get("error_code") === "otp_expired" ? "link-vencido" : "confirme";
  return NextResponse.redirect(new URL(`/entrar?aviso=${notice}`, request.url));
}

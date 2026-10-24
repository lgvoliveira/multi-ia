"use server";

// Entrar e sair. Uma entrada só para o dono e o funcionário: depois de entrar, a página inicial leva cada um para o
// seu lugar, pelo papel.

import { redirect } from "next/navigation";
import { LOGIN_NOT_CONFIGURED } from "@/lib/auth/config";
import { ensureOwnerCompany } from "@/lib/auth/company-signup";
import { parseSignIn, type SignInState } from "@/lib/auth/forms";
import { signInErrorMessage } from "@/lib/auth/messages";
import { createSessionClient } from "@/lib/auth/session";

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = parseSignIn(formData);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: parsed.values };

  const { email, password } = parsed.values;
  const supabase = await createSessionClient();
  if (!supabase) return { status: "error", message: LOGIN_NOT_CONFIGURED, values: { email } };

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Senha errada é o caso comum; só os outros erros vão para o registro do servidor.
    if (error.code !== "invalid_credentials") {
      console.error("[entrar] O Supabase recusou a entrada:", error.code, error.status);
    }
    return { status: "error", message: signInErrorMessage(error.code), values: { email } };
  }

  // Primeiro acesso do dono que confirmou o e-mail em outro aparelho: a empresa nasce agora.
  await ensureOwnerCompany(data.user);
  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createSessionClient();
  // "local": sai só deste navegador; os outros aparelhos da pessoa continuam logados.
  if (supabase) await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}

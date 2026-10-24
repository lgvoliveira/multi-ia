"use server";

// Cadastro da empresa: cria o login do dono no Supabase Auth e manda o e-mail de confirmação. A empresa só nasce no
// banco no primeiro acesso, com o e-mail confirmado (lib/auth/company-signup.ts).

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LOGIN_NOT_CONFIGURED } from "@/lib/auth/config";
import { ensureOwnerCompany, signupMetadata } from "@/lib/auth/company-signup";
import { parseSignUp, type SignUpState } from "@/lib/auth/forms";
import { signUpErrorMessage } from "@/lib/auth/messages";
import { createSessionClient } from "@/lib/auth/session";

/** O endereço deste site, para o link do e-mail voltar para cá (o Supabase só aceita os endereços liberados no painel). */
async function siteOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signUpCompany(_previous: SignUpState, formData: FormData): Promise<SignUpState> {
  const parsed = parseSignUp(formData);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: parsed.values };

  const { companyName, ownerName, email, password } = parsed.values;
  const keep = { companyName, ownerName, email };

  const supabase = await createSessionClient();
  if (!supabase) return { status: "error", message: LOGIN_NOT_CONFIGURED, values: keep };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await siteOrigin()}/confirmar`,
      data: signupMetadata({ companyName, ownerName }),
    },
  });
  if (error) {
    // Só o código do erro no registro: nada de e-mail nem senha.
    console.error("[cadastro] O Supabase recusou o cadastro:", error.code, error.status);
    return { status: "error", message: signUpErrorMessage(error.code), values: keep };
  }

  // Com a confirmação de e-mail desligada no painel, o login já vem pronto: cria a empresa e entra.
  if (data.session && data.user) {
    await ensureOwnerCompany(data.user);
    redirect("/");
  }

  // E-mail já cadastrado também cai aqui, de propósito: a tela não revela quem tem conta.
  return { status: "check-email", email };
}

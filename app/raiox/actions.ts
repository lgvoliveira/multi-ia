"use server";

// A ação da visão raio-x: entra como uma das contas de teste (Chefe ou Funcionário) com um clique. SÓ do servidor e
// SÓ no modo raio-x (local). Reaproveita o login de verdade (signInWithPassword), então tudo depois disso é real:
// as regras de acesso, a carteira e o chat funcionam igual.

import { notFound, redirect } from "next/navigation";
import { DEMO_ACCOUNTS, isDemoMode, isDemoView, type DemoView } from "@/lib/auth/demo";
import { homePathFor } from "@/lib/auth/member";
import { createSessionClient } from "@/lib/auth/session";

export async function entrarComoDemo(view: DemoView): Promise<void> {
  // Fora do modo raio-x (ou com um valor estranho), esta rota nem existe.
  if (!isDemoMode() || !isDemoView(view)) notFound();
  const account = DEMO_ACCOUNTS[view];

  const supabase = await createSessionClient();
  if (!supabase) notFound();

  const { error } = await supabase.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (error) {
    throw new Error(`Não deu para entrar na visão raio-x (${view}): ${error.message}`);
  }

  redirect(homePathFor(account.role));
}

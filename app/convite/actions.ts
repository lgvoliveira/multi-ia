"use server";

// Aceitar o convite: o funcionário cria a própria senha e entra. Só esta ação gasta o convite; abrir a página (ou a
// prévia do link no WhatsApp) não gasta.

import { redirect } from "next/navigation";
import { LOGIN_NOT_CONFIGURED } from "@/lib/auth/config";
import { parseNewPassword, text, type AcceptInviteState } from "@/lib/auth/forms";
import { acceptInvite } from "@/lib/auth/invites";
import { createSessionClient } from "@/lib/auth/session";

const REFUSED = {
  "not-found": "Este link venceu ou já foi usado. Peça um link novo ao dono da sua empresa.",
  disabled: "Este acesso foi desativado pelo dono da sua empresa.",
  "weak-password": "Essa senha é fácil de adivinhar. Escolha outra, com letras e números.",
} as const;

export async function acceptInviteAction(_previous: AcceptInviteState, formData: FormData): Promise<AcceptInviteState> {
  const parsed = parseNewPassword(formData);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors };

  const supabase = await createSessionClient();
  if (!supabase) return { status: "error", message: LOGIN_NOT_CONFIGURED };

  const { password } = parsed.values;
  let email: string;
  try {
    const result = await acceptInvite(text(formData, "token"), password);
    if (!result.ok) return { status: "error", message: REFUSED[result.reason] };
    email = result.email;
  } catch (error) {
    console.error("[convite] Não deu para aceitar:", error instanceof Error ? error.message : error);
    return { status: "error", message: "Não deu certo agora, por um problema do nosso lado. Tente de novo em instantes." };
  }

  // Entra com a senha nova. Se alguém estava logado neste navegador (ex.: o dono testando o link), sai dessa conta.
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("[convite] A senha foi gravada, mas a entrada falhou:", error.code, error.status);
    return {
      status: "error",
      message: "A sua senha foi criada, mas não deu para entrar agora. Vá em Entrar e use o seu e-mail e a senha nova.",
    };
  }
  // Senha nova derruba os outros aparelhos que estavam com a conta (ex.: quem soubesse a senha antiga).
  const { error: othersError } = await supabase.auth.signOut({ scope: "others" });
  if (othersError) console.error("[convite] Não deu para sair dos outros aparelhos:", othersError.code);

  redirect("/");
}

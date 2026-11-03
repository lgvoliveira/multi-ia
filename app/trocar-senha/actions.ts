"use server";

// O funcionário entrou com a senha temporária que o dono criou: aqui ele cria a própria senha e tira a marca
// "precisa trocar a senha". Só funciona para quem está logado e ainda está marcado; senão, volta para o lugar dele.

import { redirect } from "next/navigation";
import { LOGIN_NOT_CONFIGURED } from "@/lib/auth/config";
import { parseNewPassword, type AcceptInviteState } from "@/lib/auth/forms";
import { homePathFor } from "@/lib/auth/member";
import { createSessionClient } from "@/lib/auth/session";
import { getViewer } from "@/lib/auth/viewer";
import { supabaseAdmin } from "@/lib/runs/supabase-server";

const GENERIC = "Não deu certo agora, por um problema do nosso lado. Tente de novo em instantes.";

export async function changePasswordAction(
  _previous: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const viewer = await getViewer();
  if (viewer.status !== "member") redirect("/entrar");
  const me = viewer.member;
  // Quem já tem a própria senha não precisa (e não deve) trocar por aqui.
  if (!me.mustChangePassword) redirect(homePathFor(me.role));

  const parsed = parseNewPassword(formData);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors };

  const supabase = await createSessionClient();
  if (!supabase) return { status: "error", message: LOGIN_NOT_CONFIGURED };

  // Grava a senha nova pela sessão da própria pessoa.
  const { error } = await supabase.auth.updateUser({ password: parsed.values.password });
  if (error) {
    if (error.code === "same_password") {
      return { status: "invalid", errors: { password: "Escolha uma senha diferente da temporária." } };
    }
    if (error.code === "weak_password") {
      return { status: "invalid", errors: { password: "Essa senha é fácil de adivinhar. Escolha outra, com letras e números." } };
    }
    console.error("[trocar-senha] Não deu para gravar a senha:", error.code, error.status);
    return { status: "error", message: GENERIC };
  }

  // Tira a marca pela chave-mestra (a sessão não pode mexer na própria linha de membro). A empresa sai do login.
  try {
    const { error: markError } = await supabaseAdmin()
      .from("members")
      .update({ must_change_password: false })
      .eq("id", me.id);
    if (markError) throw new Error(markError.message);
  } catch (markError) {
    console.error("[trocar-senha] A senha trocou, mas a marca ficou:", markError instanceof Error ? markError.message : markError);
    // A senha já é a nova; seguir é melhor do que travar a pessoa. A marca some no próximo acesso de qualquer jeito.
  }

  // Senha nova derruba os outros aparelhos que ainda tivessem a senha temporária.
  const { error: othersError } = await supabase.auth.signOut({ scope: "others" });
  if (othersError) console.error("[trocar-senha] Não deu para sair dos outros aparelhos:", othersError.code);

  redirect(homePathFor(me.role));
}

// Primeiro acesso do funcionário: ele entrou com a senha temporária que o dono criou e aqui cria a própria.
// Quem chega marcado (must_change_password) vê o formulário; quem já tem a própria senha vai direto para o seu lugar.
// Usa getViewer (não requireMember), senão a própria regra de "precisa trocar a senha" mandaria de volta para cá, em laço.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { homePathFor } from "@/lib/auth/member";
import { getViewer } from "@/lib/auth/viewer";

export const metadata: Metadata = { title: "Crie a sua senha" };

export default async function TrocarSenhaPage() {
  const viewer = await getViewer();
  if (viewer.status === "signed-out") redirect("/entrar");
  if (viewer.status !== "member") redirect("/");
  if (!viewer.member.mustChangePassword) redirect(homePathFor(viewer.member.role));

  return <ChangePasswordForm name={viewer.member.name} email={viewer.member.email} />;
}

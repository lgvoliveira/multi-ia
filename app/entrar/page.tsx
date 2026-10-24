import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/SignInForm";
import { homePathFor } from "@/lib/auth/member";
import { getViewer } from "@/lib/auth/viewer";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Entre com o seu e-mail e a sua senha.",
};

// Avisos que outras páginas mandam para cá (ex.: /confirmar, quando o link do e-mail não fez o login sozinho).
const NOTICES: Record<string, string> = {
  confirme: "Se você já confirmou o e-mail, é só entrar com a sua senha.",
  "link-vencido":
    "Este link de confirmação venceu ou já foi usado. Se você já confirmou o e-mail, é só entrar; se não, faça o cadastro de novo.",
};

export default async function EntrarPage(props: PageProps<"/entrar">) {
  const viewer = await getViewer();
  if (viewer.status === "member") redirect(homePathFor(viewer.member.role));

  const { aviso } = await props.searchParams;
  const notice = typeof aviso === "string" ? NOTICES[aviso] : undefined;
  return <SignInForm notice={notice} />;
}

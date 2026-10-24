import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/SignUpForm";
import { homePathFor } from "@/lib/auth/member";
import { getViewer } from "@/lib/auth/viewer";

export const metadata: Metadata = {
  title: "Criar a conta da empresa",
  description: "Crie a conta da sua empresa e convide os funcionários.",
};

export default async function CadastroPage() {
  const viewer = await getViewer();
  if (viewer.status === "member") redirect(homePathFor(viewer.member.role));
  return <SignUpForm />;
}

import type { Metadata } from "next";
import { UnderConstruction } from "@/components/UnderConstruction";
import { requireMember } from "@/lib/auth/viewer";

export const metadata: Metadata = {
  title: "Trabalhar com o time",
  description: "Peça tarefas ao time de IAs da sua empresa.",
};

// Só quem é da empresa e está ativo abre esta página. Quem é vem do login, nunca do endereço.
// O workspace (components/OckWorkspace.tsx) volta no PR 3, ligado ao banco novo.
export default async function TrabalhoPage() {
  const me = await requireMember();
  return <UnderConstruction me={me} />;
}

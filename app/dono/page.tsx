import type { Metadata } from "next";
import { OwnerHome } from "@/components/OwnerHome";
import { createSessionClient } from "@/lib/auth/session";
import { requireMember } from "@/lib/auth/viewer";
import { listTeam } from "@/lib/ock/team";

export const metadata: Metadata = {
  title: "Painel do dono",
  description: "Acompanhe a equipe da empresa.",
};

// Só o dono logado abre esta página; os outros são mandados para a entrada ou para a página deles.
export default async function DonoPage() {
  const me = await requireMember("owner");
  const supabase = await createSessionClient();
  if (!supabase) throw new Error("Login não configurado.");
  const team = await listTeam(supabase);
  return <OwnerHome me={me} team={team} />;
}

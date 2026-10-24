import { redirect } from "next/navigation";
import { AccountNotice } from "@/components/AccountNotice";
import { OckEntry } from "@/components/OckEntry";
import { homePathFor } from "@/lib/auth/member";
import { getViewer } from "@/lib/auth/viewer";

// Página inicial. Quem é da empresa vai direto para a sua página (o dono para o painel, o funcionário para o
// trabalho); quem não entrou vê a porta de entrada.
export default async function HomePage() {
  const viewer = await getViewer();
  if (viewer.status === "member") redirect(homePathFor(viewer.member.role));
  if (viewer.status === "signed-out") return <OckEntry />;
  return <AccountNotice kind={viewer.status} />;
}

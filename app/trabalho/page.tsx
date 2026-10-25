import type { Metadata } from "next";
import { OckWorkspace } from "@/components/OckWorkspace";
import { firstName } from "@/lib/auth/member";
import { signedInSession } from "@/lib/auth/session";
import { requireMember } from "@/lib/auth/viewer";
import { loadMonthSpending } from "@/lib/ock/spending";
import { listOwnConversations } from "@/lib/ock/task-store";

export const metadata: Metadata = {
  title: "Trabalhar com o time",
  description: "Peça tarefas ao time de IAs da sua empresa.",
};

// O espaço de trabalho: o chat da tarefa rápida, as entregas e os gastos. Só quem é da empresa e está ativo abre esta
// página; quem é vem do login, nunca do endereço. As conversas e o gasto do mês são lidos com a sessão da pessoa.
export default async function TrabalhoPage() {
  const me = await requireMember();
  const session = await signedInSession();
  if (!session) throw new Error("O login sumiu entre conferir a pessoa e ler as conversas.");
  const [conversations, spending] = await Promise.all([
    listOwnConversations(session),
    loadMonthSpending(session, me.id),
  ]);

  return (
    <OckWorkspace
      pageMemberId={me.id}
      firstName={firstName(me.name)}
      isOwner={me.role === "owner"}
      initialConversations={conversations}
      initialMonth={spending.month}
    />
  );
}

import type { Metadata } from "next";
import { OwnerHome } from "@/components/OwnerHome";
import { isDemoMode } from "@/lib/auth/demo";
import { createSessionClient } from "@/lib/auth/session";
import { requireMember } from "@/lib/auth/viewer";
import { listCompanyAgents } from "@/lib/ock/company-agents";
import { loadCompanyCredit, loadMemberMonths, loadMonthStatement } from "@/lib/ock/spending";
import { listTeam } from "@/lib/ock/team";

export const metadata: Metadata = {
  title: "Painel do dono",
  description: "Acompanhe o crédito da empresa e o que a equipe fez e gastou.",
};

// Só o dono logado abre esta página; os outros são mandados para a entrada ou para a página deles. Tudo é lido com a
// sessão do dono: o banco só devolve a equipe, o extrato, as reservas e as entregas da empresa dele, e as contas do mês
// são feitas lá dentro (F48).
export default async function DonoPage() {
  const me = await requireMember("owner");
  const supabase = await createSessionClient();
  if (!supabase) throw new Error("Login não configurado.");
  const [team, credit, months, statement, agents] = await Promise.all([
    listTeam(supabase),
    loadCompanyCredit(supabase),
    loadMemberMonths(supabase),
    loadMonthStatement(supabase),
    listCompanyAgents(supabase),
  ]);
  // O banco só entrega o crédito para quem é dono; se não veio, o login mudou entre conferir e ler.
  if (!credit) throw new Error("O crédito da empresa não veio para o dono.");
  return (
    <OwnerHome
      me={me}
      team={team}
      credit={credit}
      months={new Map(months.map((month) => [month.memberId, month]))}
      statement={statement}
      agents={agents}
      demo={isDemoMode()}
    />
  );
}

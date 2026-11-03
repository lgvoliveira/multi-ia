import type { Metadata } from "next";
import { OckWorkspace } from "@/components/OckWorkspace";
import { readWorkspaceView } from "@/components/workspace-view";
import { firstName } from "@/lib/auth/member";
import { signedInSession } from "@/lib/auth/session";
import { requireMember } from "@/lib/auth/viewer";
import { listCompanyAgents } from "@/lib/ock/company-agents";
import { loadMonth } from "@/lib/ock/spending";
import { listOwnConversations } from "@/lib/ock/task-store";
import { aiTools } from "@/lib/providers/mode";
import { listRecipeSummaries, RECIPES } from "@/lib/recipes/catalog";
import { recipeScreen } from "@/lib/recipes/screen";
import { stepCosts } from "@/lib/runs/estimate";

export const metadata: Metadata = {
  title: "Trabalhar com o time",
  description: "Peça tarefas ao time de IAs da sua empresa.",
};

// O espaço de trabalho: o chat da tarefa rápida, as receitas, as entregas e os gastos. Só quem é da empresa e está
// ativo abre esta página; quem é vem do login, nunca do endereço. As conversas e o gasto do mês são lidos com a sessão
// da pessoa. Do endereço vêm só a aba e a receita abertas (?aba=receitas&receita=create-site).
export default async function TrabalhoPage(props: PageProps<"/trabalho">) {
  const me = await requireMember();
  const session = await signedInSession();
  if (!session) throw new Error("O login sumiu entre conferir a pessoa e ler as conversas.");
  const [conversations, month, companyAgents, search] = await Promise.all([
    listOwnConversations(session),
    loadMonth(session, me.id),
    listCompanyAgents(session),
    props.searchParams,
  ]);

  // Para o navegador vai só o que a tela de cada receita mostra (nunca as instruções das IAs) e os números do custo
  // máximo de cada etapa com cada IA: a tela soma para o time escolhido.
  const recipes = RECIPES.map((recipe) => ({ ...recipeScreen(recipe), stepCosts: stepCosts(recipe) }));
  const view = readWorkspaceView(
    { aba: search.aba, receita: search.receita },
    recipes.map((recipe) => recipe.id),
  );

  return (
    <OckWorkspace
      pageMemberId={me.id}
      firstName={firstName(me.name)}
      isOwner={me.role === "owner"}
      initialConversations={conversations}
      initialMonth={month}
      recipeCards={listRecipeSummaries()}
      recipes={recipes}
      companyAgents={companyAgents}
      initialView={view}
      voice={aiTools().has("voz")}
    />
  );
}

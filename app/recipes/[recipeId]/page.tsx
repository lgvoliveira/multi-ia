import { notFound, redirect } from "next/navigation";
import { recipeHref } from "@/components/workspace-view";
import { getRecipe } from "@/lib/recipes/catalog";

// Endereço antigo de uma receita pronta (ex.: /recipes/create-site). As receitas agora abrem dentro do espaço de
// trabalho, na aba Receitas (issue #42): este endereço leva para lá, com a execução acompanhada (?run=), se houver.
// Assim links salvos e os guias antigos continuam funcionando. Receita que não existe ou ainda está "Em breve" mostra
// a página "não encontrada".
export default async function RecipePage(props: PageProps<"/recipes/[recipeId]">) {
  const [{ recipeId }, search] = await Promise.all([props.params, props.searchParams]);
  if (!getRecipe(recipeId)) notFound();
  const run = Array.isArray(search.run) ? search.run[0] : search.run;
  redirect(recipeHref(recipeId, run));
}

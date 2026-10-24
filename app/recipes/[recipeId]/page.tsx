import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UnderConstruction } from "@/components/UnderConstruction";
import { requireMember } from "@/lib/auth/viewer";
import { getRecipe, RECIPES } from "@/lib/recipes/catalog";

// Página de uma receita pronta (ex.: /recipes/create-site). Endereço de receita que não existe
// ou que ainda está "Em breve" mostra a página "não encontrada". Só para quem está logado.
// Enquanto as execuções não passam para o banco novo (PR 3), mostra o aviso de "em obras" no lugar da receita
// (components/RecipeFlow.tsx), que volta ligada à empresa e ao login.
export const dynamicParams = false;

export function generateStaticParams() {
  return RECIPES.map((recipe) => ({ recipeId: recipe.id }));
}

export async function generateMetadata(props: PageProps<"/recipes/[recipeId]">): Promise<Metadata> {
  const { recipeId } = await props.params;
  return { title: getRecipe(recipeId)?.name };
}

export default async function RecipePage(props: PageProps<"/recipes/[recipeId]">) {
  const { recipeId } = await props.params;
  if (!getRecipe(recipeId)) notFound();
  const me = await requireMember();
  return <UnderConstruction me={me} />;
}

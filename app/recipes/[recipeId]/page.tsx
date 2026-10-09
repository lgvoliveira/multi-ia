import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RecipeFlow } from "@/components/RecipeFlow";
import { getRecipe, RECIPES } from "@/lib/recipes/catalog";
import styles from "./page.module.css";

// Página de uma receita pronta (ex.: /recipes/create-site). Endereço de receita que não existe
// ou que ainda está "Em breve" mostra a página "não encontrada".
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
  const recipe = getRecipe(recipeId);
  if (!recipe) notFound();

  // Para o navegador vai só o que a tela mostra; as instruções das IAs ficam no servidor.
  const roles = recipe.roles.map(({ id, name, description, suggestedProvider }) => ({
    id,
    name,
    description,
    suggestedProvider,
  }));
  const steps = recipe.steps.map(({ id, roleId, name, summary, doneSummary, format }) => ({
    id,
    roleId,
    name,
    summary,
    doneSummary,
    format,
  }));

  return (
    <main className={styles.main}>
      <nav aria-label="Caminho" className={styles.breadcrumb}>
        <Link href="/" className={styles.breadcrumbLink}>
          Receitas
        </Link>
        {" / "}
        <span aria-current="page" className={styles.breadcrumbCurrent}>
          {recipe.name}
        </span>
      </nav>

      <RecipeFlow
        recipeId={recipe.id}
        recipeName={recipe.name}
        roles={roles}
        steps={steps}
        requestPlaceholder={recipe.requestPlaceholder}
      />
    </main>
  );
}

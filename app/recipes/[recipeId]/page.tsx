import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RecipeFlow } from "@/components/RecipeFlow";
import { requireMember } from "@/lib/auth/viewer";
import { getRecipe, RECIPES } from "@/lib/recipes/catalog";
import { stageSteps } from "@/lib/recipes/types";
import styles from "./page.module.css";

// Página de uma receita pronta (ex.: /recipes/create-site). Endereço de receita que não existe
// ou que ainda está "Em breve" mostra a página "não encontrada". Só para quem é da empresa e está ativo:
// cada execução fica em nome de quem está logado.
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
  const me = await requireMember();

  // Para o navegador vai só o que a tela mostra; as instruções das IAs ficam no servidor.
  const roles = recipe.roles.map(({ id, name, description, suggestedProvider }) => ({
    id,
    name,
    description,
    suggestedProvider,
  }));
  // As fases, agrupando as etapas; cada etapa leva só o que a tela mostra, nunca a instrução da IA.
  const stages = recipe.stages.map((stage) => ({
    id: stage.id,
    kind: stage.kind,
    steps: stageSteps(stage).map(({ id, roleId, name, summary, doneSummary, format }) => ({
      id,
      stageId: stage.id,
      roleId,
      name,
      summary,
      doneSummary,
      format,
    })),
  }));

  return (
    <main className={styles.main}>
      <nav aria-label="Caminho" className={styles.breadcrumb}>
        <Link href="/trabalho" className={styles.breadcrumbLink}>
          Trabalho
        </Link>
        {" / "}
        <span aria-current="page" className={styles.breadcrumbCurrent}>
          {recipe.name}
        </span>
      </nav>

      <RecipeFlow
        memberId={me.id}
        recipeId={recipe.id}
        recipeName={recipe.name}
        roles={roles}
        stages={stages}
        requestPlaceholder={recipe.requestPlaceholder}
      />
    </main>
  );
}

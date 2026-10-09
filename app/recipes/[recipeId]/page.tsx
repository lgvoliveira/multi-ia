import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TeamBuilder } from "@/components/TeamBuilder";
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

      <section className={styles.intro}>
        <h1 className={styles.title}>{recipe.name}</h1>
        <p className={styles.lead}>
          Este é o time que recomendamos. Cada IA tem um papel; troque qualquer uma se preferir.
        </p>
      </section>

      <TeamBuilder roles={roles} requestPlaceholder={recipe.requestPlaceholder} />
    </main>
  );
}

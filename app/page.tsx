import { RecipeCard } from "@/components/RecipeCard";
import { listRecipeSummaries } from "@/lib/recipes/catalog";
import type { RecipeSummary } from "@/lib/recipes/types";
import styles from "./page.module.css";

// Página inicial: as receitas prontas primeiro, depois as que ainda estão "Em breve".
export default function HomePage() {
  const recipes = listRecipeSummaries();

  return (
    <main className={styles.main}>
      <section className={styles.intro}>
        <h1 className={styles.title}>O que você quer fazer hoje?</h1>
        <p className={styles.lead}>
          Escolha uma receita e um time de IAs já montado começa a trabalhar para você. Dá para
          trocar qualquer IA antes de começar.
        </p>
      </section>

      <RecipeSection
        id="prontas"
        title="Receitas prontas"
        recipes={recipes.filter((recipe) => recipe.available)}
      />
      <RecipeSection
        id="em-breve"
        title="Em breve"
        recipes={recipes.filter((recipe) => !recipe.available)}
      />
    </main>
  );
}

function RecipeSection({ id, title, recipes }: { id: string; title: string; recipes: RecipeSummary[] }) {
  if (recipes.length === 0) return null;
  const headingId = `receitas-${id}`;

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.sectionTitle}>
        {title}
      </h2>
      <div className={styles.grid}>
        {recipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} />
        ))}
      </div>
    </section>
  );
}

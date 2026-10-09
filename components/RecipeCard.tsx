import Link from "next/link";
import { getProviderInfo } from "@/lib/providers/catalog";
import type { RecipeSummary } from "@/lib/recipes/types";
import { AiDot } from "./AiDot";
import styles from "./RecipeCard.module.css";

// Cartão de uma receita na página inicial. Receita que ainda não está pronta aparece apagada e sem botão.
export function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  return (
    <article className={recipe.available ? styles.card : `${styles.card} ${styles.comingSoon}`}>
      <h3 className={styles.title}>{recipe.name}</h3>
      <p className={styles.description}>{recipe.description}</p>

      <ul className={styles.team} aria-label="Time sugerido">
        {recipe.team.map((member) => (
          <li key={member.roleName} className={styles.member}>
            <AiDot provider={member.provider} />
            {member.roleName} · {getProviderInfo(member.provider).name}
          </li>
        ))}
      </ul>

      {recipe.available ? (
        <Link
          href={`/recipes/${recipe.id}`}
          className={styles.action}
          aria-label={`Usar receita ${recipe.name}`}
        >
          Usar receita
        </Link>
      ) : (
        <p className={styles.badge}>Em breve</p>
      )}
    </article>
  );
}

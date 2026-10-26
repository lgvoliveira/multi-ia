import { getProviderInfo } from "@/lib/providers/catalog";
import type { RecipeSummary } from "@/lib/recipes/types";
import { AiDot } from "./AiDot";
import styles from "./RecipeCard.module.css";

// Cartão de uma receita na aba Receitas do espaço de trabalho. "Usar receita" abre a receita ali mesmo (onUse).
// Receita que ainda não está pronta aparece apagada e sem botão.
export function RecipeCard({ recipe, onUse }: { recipe: RecipeSummary; onUse: () => void }) {
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
        <button type="button" className={styles.action} aria-label={`Usar receita ${recipe.name}`} onClick={onUse}>
          Usar receita
        </button>
      ) : (
        <p className={styles.badge}>Em breve</p>
      )}
    </article>
  );
}

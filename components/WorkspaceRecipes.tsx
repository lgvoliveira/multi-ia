"use client";

// A aba "Receitas" do espaço de trabalho: as receitas em cartões e, ao escolher uma, a receita ali mesmo (montar o
// time, ver o custo, começar, acompanhar ao vivo e ver o resultado), sem sair da página. "Todas as receitas" volta para
// os cartões; o time de uma receita que já começou continua trabalhando no servidor e é retomado ao abri-la de novo.

import { useEffect, useId, useRef } from "react";
import type { RecipeScreen } from "@/lib/recipes/screen";
import type { RecipeSummary } from "@/lib/recipes/types";
import type { StepCost } from "@/lib/runs/estimate";
import { RecipeCard } from "./RecipeCard";
import { RecipeFlow } from "./RecipeFlow";
import styles from "./WorkspaceRecipes.module.css";

/** Uma receita pronta, com tudo o que a tela dela precisa: os dados da tela e o custo máximo de cada etapa. */
export type WorkspaceRecipe = RecipeScreen & { stepCosts: StepCost[] };

interface WorkspaceRecipesProps {
  pageMemberId: string;
  /** Os cartões: as receitas prontas e as que estão "Em breve". */
  cards: RecipeSummary[];
  recipes: WorkspaceRecipe[];
  /** A receita aberta; null mostra os cartões. */
  openRecipeId: string | null;
  onOpen: (recipeId: string) => void;
  onClose: () => void;
  /** Avisado quando a receita aberta gasta: o espaço de trabalho atualiza o "Gasto do mês". */
  onSpendingChange: () => void;
}

export function WorkspaceRecipes({
  pageMemberId,
  cards,
  recipes,
  openRecipeId,
  onOpen,
  onClose,
  onSpendingChange,
}: WorkspaceRecipesProps) {
  const titleId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const recipeRef = useRef<HTMLDivElement>(null);
  // A receita que estava à vista. O foco só muda quando a pessoa abre ou fecha uma receita, não ao carregar a página.
  const shownRef = useRef(openRecipeId);

  useEffect(() => {
    if (shownRef.current === openRecipeId) return;
    shownRef.current = openRecipeId;
    if (openRecipeId) recipeRef.current?.focus();
    else headingRef.current?.focus();
  }, [openRecipeId]);

  const recipe = recipes.find((item) => item.id === openRecipeId);
  if (recipe) {
    return (
      <div ref={recipeRef} tabIndex={-1} role="region" aria-label={`Receita ${recipe.name}`} className={styles.recipe}>
        <button type="button" className={styles.back} onClick={onClose}>
          <span aria-hidden="true">← </span>Todas as receitas
        </button>
        {/* key: trocar de receita monta a tela do zero, com o time e o pedido da outra. */}
        <RecipeFlow
          key={recipe.id}
          memberId={pageMemberId}
          recipeId={recipe.id}
          recipeName={recipe.name}
          resultTitle={recipe.resultTitle}
          roles={recipe.roles}
          stages={recipe.stages}
          stepCosts={recipe.stepCosts}
          requestPlaceholder={recipe.requestPlaceholder}
          onSpendingChange={onSpendingChange}
        />
      </div>
    );
  }

  return (
    <section className={styles.shelf} aria-labelledby={titleId}>
      <div className={styles.intro}>
        <h2 id={titleId} ref={headingRef} tabIndex={-1} className={styles.title}>
          Receitas prontas
        </h2>
        <p className={styles.lead}>
          Para um serviço maior, um time de IAs já montado: cada uma tem um papel, e você pode trocar qualquer uma.
        </p>
      </div>
      <div className={styles.grid}>
        {cards.map((card) => (
          <RecipeCard key={card.id} recipe={card} onUse={() => onOpen(card.id)} />
        ))}
      </div>
    </section>
  );
}

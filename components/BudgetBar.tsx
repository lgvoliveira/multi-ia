import styles from "./BudgetBar.module.css";

/** A partir de quanto do teto a barra avisa que está perto (amarela). No teto ou acima, fica vermelha. */
const WARNING_SHARE = 80;

interface BudgetBarProps {
  spentCents: number;
  budgetCents: number;
  /** Para o leitor de tela: de quem é o teto (ex.: "Quanto do teto do mês a Carla já usou"). */
  label: string;
}

// A barra do gasto do mês contra o teto, no espaço de trabalho e no painel do dono. O valor sempre aparece escrito ao
// lado; a barra é o resumo visual.
export function BudgetBar({ spentCents, budgetCents, label }: BudgetBarProps) {
  const share = budgetCents > 0 ? Math.min(100, (spentCents / budgetCents) * 100) : 100;
  const level = share >= 100 ? styles.full : share >= WARNING_SHARE ? styles.near : styles.ok;
  return (
    <div
      className={`${styles.track} ${level}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(share)}
    >
      {/* A largura da barra vem da conta, não de um token. */}
      <div className={styles.fill} style={{ width: `${share}%` }} />
    </div>
  );
}

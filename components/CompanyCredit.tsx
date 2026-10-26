// O alto do painel do dono: quanto a equipe ainda pode usar, o saldo e o que está separado agora, e o gasto do mês
// dividido por IA (cada uma com a sua cor, e sempre com o nome e o valor escritos ao lado). A recarga é feita pela
// nossa equipe, por Pix (F25): o dono não coloca crédito sozinho.

import { formatBRL } from "@/lib/ock/pricing";
import { signedBRL, type CompanyCredit as Credit, type ProviderSpending } from "@/lib/ock/statement";
import { getProviderInfo } from "@/lib/providers/catalog";
import type { ProviderId } from "@/lib/providers/types";
import { AiDot } from "./AiDot";
import styles from "./CompanyCredit.module.css";

/** A cor de cada pedaço da barra, a mesma de cada IA no resto do site. */
const SEGMENT_CLASS: Record<ProviderId, string> = {
  claude: styles.claude,
  gpt: styles.gpt,
  gemini: styles.gemini,
};

type ProviderSlice = ProviderSpending & { provider: ProviderId };

function isProviderSlice(line: ProviderSpending): line is ProviderSlice {
  return line.provider !== null;
}

export function CompanyCredit({ credit }: { credit: Credit }) {
  const withoutCredit = credit.availableCents <= 0;
  const slices = credit.byProvider.filter(isProviderSlice).filter((line) => line.spentCents > 0);
  const adjustments = credit.byProvider.find((line) => line.provider === null && line.spentCents !== 0);
  const barTotal = slices.reduce((total, line) => total + line.spentCents, 0);

  return (
    <section className={styles.card} aria-labelledby="credit-title">
      <h2 id="credit-title" className={styles.title}>
        Crédito da empresa
      </h2>

      <div className={styles.figure}>
        <span className={styles.label}>Disponível para a equipe</span>
        <span className={withoutCredit ? `${styles.value} ${styles.valueEmpty}` : styles.value}>
          {formatBRL(credit.availableCents)}
        </span>
        <span className={styles.detail}>
          Saldo {formatBRL(credit.balanceCents)}
          {credit.reservedCents > 0 &&
            ` · ${formatBRL(credit.reservedCents)} separado agora para tarefas em andamento`}
        </span>
      </div>

      {withoutCredit && (
        <p className={styles.alert} role="alert">
          A empresa está sem crédito: ninguém da equipe consegue usar as IAs.
        </p>
      )}

      <div className={styles.month}>
        <p className={styles.monthTotal}>
          Gasto da empresa neste mês: <strong>{formatBRL(credit.monthSpentCents)}</strong>
        </p>
        {barTotal > 0 ? (
          <>
            {/* A barra é só o resumo visual; a lista embaixo diz o mesmo por escrito. */}
            <div className={styles.bar} aria-hidden="true">
              {slices.map((line) => (
                <span
                  key={line.provider}
                  className={`${styles.segment} ${SEGMENT_CLASS[line.provider]}`}
                  // A largura de cada pedaço vem da conta, não de um token.
                  style={{ flexGrow: line.spentCents }}
                />
              ))}
            </div>
            <ul className={styles.legend} aria-label="Gasto do mês por IA">
              {slices.map((line) => (
                <li key={line.provider} className={styles.legendItem}>
                  <AiDot provider={line.provider} size="large" />
                  <span>{getProviderInfo(line.provider).name}</span>
                  <span className={styles.legendValue}>{formatBRL(line.spentCents)}</span>
                </li>
              ))}
              {adjustments && (
                <li className={styles.legendItem}>
                  <span>Ajustes</span>
                  <span className={styles.legendValue}>{signedBRL(adjustments.spentCents)}</span>
                </li>
              )}
            </ul>
          </>
        ) : (
          <p className={styles.detail}>Ninguém da equipe gastou neste mês ainda.</p>
        )}
      </div>

      <p className={styles.note}>
        Para colocar crédito, fale com a nossa equipe: a recarga é feita por Pix e aparece no extrato do mês, mais abaixo.
      </p>
    </section>
  );
}

// O alto do painel do dono: o PAINEL DE CUSTO TOTAL da empresa (04/11/2026, pedido do Leandro). Quanto a equipe ainda
// pode usar, o saldo, o que foi colocado em créditos neste mês, o gasto do mês, quantas execuções houve, e o gasto do mês
// dividido por IA (cada uma com a sua cor, e sempre com o nome e o valor escritos ao lado). Só o dono vê isto: o card de
// cada funcionário mostra créditos, nunca o gasto por IA. A recarga é feita pela nossa equipe, por Pix (F25).

import { formatBRL, formatCredits } from "@/lib/ock/pricing";
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

interface CompanyCreditProps {
  credit: Credit;
  /** O que entrou em créditos neste mês (as recargas somadas), em centavos. */
  topupCents: number;
  /** Se o extrato do mês tinha mais linhas do que as lidas: aí a soma das recargas pode estar incompleta. */
  topupPartial: boolean;
  /** Quantas execuções a equipe fez neste mês (tarefas rápidas + receitas). */
  runs: number;
}

export function CompanyCredit({ credit, topupCents, topupPartial, runs }: CompanyCreditProps) {
  const withoutCredit = credit.availableCents <= 0;
  // O saldo pode ficar um pouco negativo (F29): aí não há nada disponível, e o saldo aparece com o sinal.
  const available = Math.max(0, credit.availableCents);
  const balance = credit.balanceCents < 0 ? signedBRL(credit.balanceCents) : formatBRL(credit.balanceCents);
  const slices = credit.byProvider.filter(isProviderSlice).filter((line) => line.spentCents > 0);
  const adjustments = credit.byProvider.find((line) => line.provider === null && line.spentCents !== 0);
  const barTotal = slices.reduce((total, line) => total + line.spentCents, 0);

  return (
    <section className={styles.card} aria-labelledby="credit-title">
      <h2 id="credit-title" className={styles.title}>
        Custo total da empresa
      </h2>

      <div className={styles.figure}>
        <span className={styles.label}>Disponível para a equipe</span>
        <span className={withoutCredit ? `${styles.value} ${styles.valueEmpty}` : styles.value}>
          {formatBRL(available)}
        </span>
        <span className={styles.detail}>
          {formatCredits(available)} · saldo {balance}
          {credit.reservedCents > 0 &&
            ` · ${formatBRL(credit.reservedCents)} separado agora para tarefas em andamento`}
        </span>
      </div>

      {withoutCredit && (
        <p className={styles.alert} role="alert">
          A empresa está sem crédito: ninguém da equipe consegue usar as IAs.
        </p>
      )}

      {/* O resumo do mês em números: o que entrou, o que saiu e quanto trabalho isso rendeu. */}
      <dl className={styles.stats} aria-label="Resumo do mês da empresa">
        <div className={styles.stat}>
          <dt className={styles.statLabel}>Colocado em créditos neste mês</dt>
          <dd className={styles.statValue}>
            {formatCredits(topupCents)}
            <span className={styles.statSub}>
              {formatBRL(topupCents)} em recargas{topupPartial && " (soma das recargas mais recentes)"}
            </span>
          </dd>
        </div>
        <div className={styles.stat}>
          <dt className={styles.statLabel}>Gasto neste mês</dt>
          <dd className={styles.statValue}>
            {formatCredits(credit.monthSpentCents)}
            <span className={styles.statSub}>{formatBRL(credit.monthSpentCents)} com as IAs</span>
          </dd>
        </div>
        <div className={styles.stat}>
          <dt className={styles.statLabel}>Execuções neste mês</dt>
          <dd className={styles.statValue}>
            {runs.toLocaleString("pt-BR")}
            <span className={styles.statSub}>tarefas rápidas e receitas da equipe</span>
          </dd>
        </div>
        <div className={styles.stat}>
          <dt className={styles.statLabel}>Saldo da empresa</dt>
          <dd className={styles.statValue}>
            {balance}
            <span className={styles.statSub}>tudo que entrou menos tudo que saiu</span>
          </dd>
        </div>
      </dl>

      <div className={styles.month}>
        <p className={styles.monthTotal}>
          Gasto do mês em cada IA: <strong>{formatBRL(credit.monthSpentCents)}</strong>
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

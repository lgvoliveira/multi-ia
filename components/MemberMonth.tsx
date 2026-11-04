"use client";

// O mês de uma pessoa no painel do dono: quanto gastou do teto, o resumo do que fez e, em "Ver o que fez", as linhas do
// mês (dia e hora, o que foi, a IA e o valor) e as entregas, para baixar. Nunca o pedido, a resposta ou a conversa:
// o servidor nem recebe isso do banco (F05). A lista vem do servidor só quando o dono abre, e de novo a cada vez.

import { useId, useRef, useState } from "react";
import { fileUrl, loadMemberMonth } from "@/lib/ock/chat-client";
import { formatBRL, formatCredits } from "@/lib/ock/pricing";
import {
  formatDateTime,
  monthActivityText,
  STATEMENT_PAGE_SIZE,
  type MemberMonth as Month,
  type MemberMonthDetails,
} from "@/lib/ock/statement";
import { BudgetBar } from "./BudgetBar";
import { StatementList } from "./StatementList";
import styles from "./MemberMonth.module.css";

interface MemberMonthProps {
  memberId: string;
  name: string;
  month: Month;
  /** O teto do mês, em centavos; null = sem teto. */
  budgetCents: number | null;
  /** O que a empresa ainda tem disponível: é o "restante" de quem não tem teto próprio. */
  companyAvailableCents: number;
}

type Details = { state: "loading" } | { state: "ready"; data: MemberMonthDetails } | { state: "error"; problem: string };

export function MemberMonth({ memberId, name, month, budgetCents, companyAvailableCents }: MemberMonthProps) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<Details>({ state: "loading" });
  // Só a resposta do último pedido vale (abrir, fechar e abrir de novo depressa).
  const lastRequest = useRef(0);

  // Os números desta pessoa no mês, em créditos (1 crédito = R$ 1): o que gastou, o que ainda pode gastar e o total que
  // a empresa pôs nela (o gasto mais o que está separado agora para tarefas em andamento). Nada por IA aqui: isso é
  // visão do dono, no painel de custo total, lá em cima.
  const spent = month.spentCents;
  const invested = month.spentCents + month.reservedCents;
  const remaining =
    budgetCents === null ? Math.max(0, companyAvailableCents) : Math.max(0, budgetCents - invested);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    const request = ++lastRequest.current;
    setDetails({ state: "loading" });
    void loadMemberMonth(memberId).then((result) => {
      if (request !== lastRequest.current) return;
      setDetails(result.ok ? { state: "ready", data: result.data } : { state: "error", problem: result.problem });
    });
  }

  return (
    <div className={styles.month}>
      <dl className={styles.credits} aria-label={`Créditos de ${name} neste mês`}>
        <div className={styles.credit}>
          <dt className={styles.creditLabel}>Créditos gastos</dt>
          <dd className={styles.creditValue}>
            {formatCredits(spent)}
            <span className={styles.creditSub}>{formatBRL(spent)} neste mês</span>
          </dd>
        </div>
        <div className={styles.credit}>
          <dt className={styles.creditLabel}>Créditos restantes</dt>
          <dd className={styles.creditValue}>
            {formatCredits(remaining)}
            <span className={styles.creditSub}>
              {budgetCents === null
                ? "do crédito da empresa (sem teto próprio)"
                : `de ${formatCredits(budgetCents)} no mês`}
            </span>
          </dd>
        </div>
        <div className={styles.credit}>
          <dt className={styles.creditLabel}>Total investido nesta pessoa</dt>
          <dd className={styles.creditValue}>
            {formatCredits(invested)}
            <span className={styles.creditSub}>
              {formatBRL(invested)} neste mês
              {month.reservedCents > 0 && ` · inclui ${formatBRL(month.reservedCents)} separado agora`}
            </span>
          </dd>
        </div>
      </dl>
      {budgetCents !== null && (
        <BudgetBar
          spentCents={invested}
          budgetCents={budgetCents}
          label={`Quanto do teto do mês ${name} já usou`}
        />
      )}
      <p className={styles.activity}>{monthActivityText(month)}</p>

      <div>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
        >
          {open ? "Esconder o que fez" : "Ver o que fez"}
        </button>
      </div>

      <div id={panelId} className={styles.panel} hidden={!open}>
        {open && <DetailsView details={details} name={name} />}
      </div>
    </div>
  );
}

function DetailsView({ details, name }: { details: Details; name: string }) {
  if (details.state === "loading") return <p className={styles.note}>Carregando…</p>;
  if (details.state === "error") {
    return (
      <p className={styles.problem} role="alert">
        {details.problem}
      </p>
    );
  }

  const { lines, more, deliveries } = details.data;
  return (
    <>
      <h3 className={styles.panelTitle}>O que fez neste mês</h3>
      {lines.length === 0 ? (
        <p className={styles.note}>Nada neste mês ainda.</p>
      ) : (
        <StatementList lines={lines} label={`O que ${name} fez neste mês`} />
      )}
      {more && <p className={styles.note}>Mostrando as {STATEMENT_PAGE_SIZE} linhas mais recentes.</p>}

      <h3 className={styles.panelTitle}>Entregas do mês</h3>
      {deliveries.length === 0 ? (
        <p className={styles.note}>Nenhuma entrega neste mês.</p>
      ) : (
        <ul className={styles.deliveries} aria-label={`Entregas de ${name} neste mês`}>
          {deliveries.map((delivery) => (
            <li key={delivery.id} className={styles.delivery}>
              <span className={styles.deliveryName}>{delivery.name}</span>
              <span className={styles.date}>{formatDateTime(delivery.createdAt)}</span>
              <a className={styles.download} href={fileUrl(delivery.id)} download={delivery.name}>
                Baixar<span className={styles.visuallyHidden}> {delivery.name}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      <p className={styles.note}>
        Você vê o que cada pessoa fez e quanto custou, e baixa as entregas. Os pedidos, as respostas e as conversas ficam
        só com ela.
      </p>
    </>
  );
}

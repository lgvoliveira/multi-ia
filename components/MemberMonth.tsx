"use client";

// O mês de uma pessoa no painel do dono: quanto gastou do teto, o resumo do que fez e, em "Ver o que fez", as linhas do
// mês (dia e hora, o que foi, a IA e o valor) e as entregas, para baixar. Nunca o pedido, a resposta ou a conversa:
// o servidor nem recebe isso do banco (F05). A lista vem do servidor só quando o dono abre, e de novo a cada vez.

import { useId, useRef, useState } from "react";
import { fileUrl, loadMemberMonth } from "@/lib/ock/chat-client";
import { formatBRL } from "@/lib/ock/pricing";
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
}

type Details = { state: "loading" } | { state: "ready"; data: MemberMonthDetails } | { state: "error"; problem: string };

export function MemberMonth({ memberId, name, month, budgetCents }: MemberMonthProps) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<Details>({ state: "loading" });
  // Só a resposta do último pedido vale (abrir, fechar e abrir de novo depressa).
  const lastRequest = useRef(0);

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
      <p className={styles.spent}>
        Gasto do mês: <strong>{formatBRL(month.spentCents)}</strong>
        {budgetCents === null ? " · sem teto" : ` de ${formatBRL(budgetCents)}`}
      </p>
      {budgetCents !== null && (
        <BudgetBar
          spentCents={month.spentCents}
          budgetCents={budgetCents}
          label={`Quanto do teto do mês ${name} já usou`}
        />
      )}
      {month.reservedCents > 0 && (
        <p className={styles.note}>
          Mais {formatBRL(month.reservedCents)} separado agora para o que está em andamento (também conta no teto).
        </p>
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

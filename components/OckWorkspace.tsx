"use client";

// O espaço de trabalho de quem é da empresa (funcionário ou dono), em três abas:
// - "Chat": a tarefa rápida (components/QuickChat.tsx). A pessoa pede, o Chefe escolhe a IA e cada resposta mostra
//   quanto custou.
// - "Entregas": os arquivos que as IAs fizeram para a pessoa (PDF, planilha, gráfico, projeto...), para baixar.
// - "Meus gastos": o gasto do mês, em reais, o teto e as linhas do extrato da própria pessoa (decisão 4 da issue #39).
// No alto, o gasto do mês e os atalhos: a receita "Criar um site" (as receitas entram no workspace na etapa 6) e, para
// o dono, o painel dele.

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { QuickChat } from "@/components/QuickChat";
import type { ChatConversation, ChatDelivery, MonthSpending, SpendingEntry } from "@/lib/ock/chat";
import { fileUrl, loadDeliveries, loadSpending } from "@/lib/ock/chat-client";
import { formatBRL } from "@/lib/ock/pricing";
import { getProviderInfo } from "@/lib/providers/catalog";
import styles from "./OckWorkspace.module.css";

interface OckWorkspaceProps {
  pageMemberId: string;
  firstName: string;
  isOwner: boolean;
  initialConversations: ChatConversation[];
  initialMonth: MonthSpending;
}

const TABS = [
  { id: "chat", label: "Chat" },
  { id: "deliveries", label: "Entregas" },
  { id: "spending", label: "Meus gastos" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function OckWorkspace({
  pageMemberId,
  firstName,
  isOwner,
  initialConversations,
  initialMonth,
}: OckWorkspaceProps) {
  const ids = useId();
  const [tab, setTab] = useState<TabId>("chat");
  const [month, setMonth] = useState(initialMonth);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Setas, Home e End trocam de aba, como o leitor de tela anuncia que funciona.
  function handleTabKey(event: KeyboardEvent<HTMLDivElement>) {
    const current = TABS.findIndex((item) => item.id === tab);
    const next = nextTabIndex(event.key, current, TABS.length);
    if (next === null) return;
    event.preventDefault();
    setTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  }

  return (
    <main className={styles.main}>
      <header className={styles.bar}>
        <div className={styles.greeting}>
          <h1 className={styles.title}>Olá, {firstName}!</h1>
          <p className={styles.lead}>Peça o que precisar: o Chefe escolhe a IA, e você vê quanto cada resposta custou.</p>
        </div>
        <div className={styles.side}>
          <p className={styles.month}>
            Gasto do mês: <strong>{formatBRL(month.spentCents)}</strong>
            {month.budgetCents === null ? " (sem teto)" : ` de ${formatBRL(month.budgetCents)}`}
          </p>
          <nav className={styles.links} aria-label="Atalhos">
            <Link href="/recipes/create-site" className={styles.link}>
              Receita &ldquo;Criar um site&rdquo;
            </Link>
            {isOwner && (
              <Link href="/dono" className={styles.link}>
                Painel do dono
              </Link>
            )}
          </nav>
        </div>
      </header>

      <div role="tablist" aria-label="Partes do espaço de trabalho" className={styles.tabs} onKeyDown={handleTabKey}>
        {TABS.map((item, index) => (
          <button
            key={item.id}
            ref={(button) => {
              tabRefs.current[index] = button;
            }}
            type="button"
            role="tab"
            id={`${ids}-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`${ids}-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            className={styles.tab}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* O chat fica montado nas outras abas: a conversa aberta e o que foi escrito continuam lá. */}
      <div role="tabpanel" id={`${ids}-panel-chat`} aria-labelledby={`${ids}-tab-chat`} hidden={tab !== "chat"}>
        <QuickChat pageMemberId={pageMemberId} initialConversations={initialConversations} onMonthChange={setMonth} />
      </div>
      <div
        role="tabpanel"
        id={`${ids}-panel-deliveries`}
        aria-labelledby={`${ids}-tab-deliveries`}
        hidden={tab !== "deliveries"}
      >
        {/* Montadas só quando abertas: cada vez que a aba abre, a lista vem atualizada. */}
        {tab === "deliveries" && <DeliveriesPanel />}
      </div>
      <div
        role="tabpanel"
        id={`${ids}-panel-spending`}
        aria-labelledby={`${ids}-tab-spending`}
        hidden={tab !== "spending"}
      >
        {tab === "spending" && <SpendingPanel onMonthChange={setMonth} />}
      </div>
    </main>
  );
}

type Loaded<T> = { state: "loading" } | { state: "ready"; data: T } | { state: "error"; problem: string };

function DeliveriesPanel() {
  const [deliveries, setDeliveries] = useState<Loaded<ChatDelivery[]>>({ state: "loading" });

  useEffect(() => {
    let ignore = false;
    void loadDeliveries().then((result) => {
      if (ignore) return;
      setDeliveries(result.ok ? { state: "ready", data: result.data } : { state: "error", problem: result.problem });
    });
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <section className={styles.panel} aria-label="Entregas">
      <p className={styles.panelLead}>
        Tudo o que as IAs fizeram para você: PDF, planilha, Word, gráfico e projeto em .zip.
      </p>
      {deliveries.state === "loading" && <p className={styles.muted}>Carregando…</p>}
      {deliveries.state === "error" && (
        <p className={styles.problem} role="alert">
          {deliveries.problem}
        </p>
      )}
      {deliveries.state === "ready" &&
        (deliveries.data.length === 0 ? (
          <p className={styles.muted}>Nenhuma entrega ainda. Peça um arquivo no chat (ex.: &ldquo;gere um PDF&rdquo;).</p>
        ) : (
          <ul className={styles.rows}>
            {deliveries.data.map((delivery) => (
              <li key={delivery.id} className={styles.row}>
                <span className={styles.rowName}>{delivery.name}</span>
                <span className={styles.rowDate}>{formatDateTime(delivery.createdAt)}</span>
                <a className={styles.rowLink} href={fileUrl(delivery.id)} download={delivery.name}>
                  Baixar<span className={styles.visuallyHidden}> {delivery.name}</span>
                </a>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}

function SpendingPanel({ onMonthChange }: { onMonthChange: (month: MonthSpending) => void }) {
  const [spending, setSpending] = useState<Loaded<{ month: MonthSpending; entries: SpendingEntry[] }>>({
    state: "loading",
  });

  useEffect(() => {
    let ignore = false;
    void loadSpending().then((result) => {
      if (ignore) return;
      if (result.ok) onMonthChange(result.data.month);
      setSpending(result.ok ? { state: "ready", data: result.data } : { state: "error", problem: result.problem });
    });
    return () => {
      ignore = true;
    };
  }, [onMonthChange]);

  if (spending.state === "loading") return <p className={`${styles.panel} ${styles.muted}`}>Carregando…</p>;
  if (spending.state === "error") {
    return (
      <p className={`${styles.panel} ${styles.problem}`} role="alert">
        {spending.problem}
      </p>
    );
  }

  const { month, entries } = spending.data;
  const share = month.budgetCents ? Math.min(100, (month.spentCents / month.budgetCents) * 100) : null;
  return (
    <section className={styles.panel} aria-label="Meus gastos">
      <div className={styles.usage}>
        <div className={styles.usageTop}>
          <div className={styles.usageItem}>
            <span className={styles.muted}>Gasto do mês</span>
            <span className={styles.usageValue}>{formatBRL(month.spentCents)}</span>
          </div>
          <div className={`${styles.usageItem} ${styles.usageRight}`}>
            <span className={styles.muted}>Seu teto do mês</span>
            <span className={styles.usageLimit}>
              {month.budgetCents === null ? "Sem teto" : formatBRL(month.budgetCents)}
            </span>
          </div>
        </div>
        {share !== null && (
          <div
            className={styles.track}
            role="progressbar"
            aria-label="Quanto do teto do mês já foi usado"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(share)}
          >
            {/* A largura da barra vem da conta, não de um token. */}
            <div className={styles.fill} style={{ width: `${share}%` }} />
          </div>
        )}
        <p className={styles.muted}>O mês conta do dia 1º, à meia-noite de Brasília. O teto é definido pelo dono da empresa.</p>
      </div>

      {entries.length === 0 ? (
        <p className={styles.muted}>Nenhum gasto neste mês.</p>
      ) : (
        <ul className={styles.rows} aria-label="Gastos do mês">
          {entries.map((entry) => (
            <li key={entry.id} className={styles.row}>
              <span className={styles.rowName}>
                {entry.description}
                {entry.provider && <span className={styles.muted}> · {getProviderInfo(entry.provider).name}</span>}
              </span>
              <span className={styles.rowDate}>{formatDateTime(entry.createdAt)}</span>
              <span className={styles.rowValue}>{formatBRL(entry.amountCents)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Dia e hora no horário de Brasília: "25/10, 14:30". */
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function nextTabIndex(key: string, current: number, count: number): number | null {
  switch (key) {
    case "ArrowRight":
      return (current + 1) % count;
    case "ArrowLeft":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

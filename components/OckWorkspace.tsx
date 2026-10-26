"use client";

// O espaço de trabalho de quem é da empresa (funcionário ou dono), em quatro abas:
// - "Chat": a tarefa rápida (components/QuickChat.tsx). A pessoa pede, o Chefe escolhe a IA e cada resposta mostra
//   quanto custou. Com o chat vazio, sugere as receitas prontas.
// - "Receitas": as receitas prontas em cartões; a escolhida abre ali mesmo (components/WorkspaceRecipes.tsx).
// - "Entregas": os arquivos que as IAs fizeram para a pessoa (PDF, planilha, gráfico, projeto...), para baixar.
// - "Meus gastos": o gasto do mês, em reais, o teto e o extrato do mês da própria pessoa, com cada receita numa linha só
//   (decisão 4 da issue #39 e decisão 2 da issue #43).
// Nas duas últimas, o funcionário lê o que o dono da empresa vê do trabalho dele (F05).
// A aba e a receita aberta ficam no endereço (components/workspace-view.ts): recarregar volta para o mesmo lugar.

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { QuickChat } from "@/components/QuickChat";
import type { ChatConversation, ChatDelivery, MonthSpending } from "@/lib/ock/chat";
import { fileUrl, loadDeliveries, loadSpending } from "@/lib/ock/chat-client";
import { formatBRL } from "@/lib/ock/pricing";
import { formatDateTime, STATEMENT_PAGE_SIZE, type StatementLine } from "@/lib/ock/statement";
import type { RecipeSummary } from "@/lib/recipes/types";
import { BudgetBar } from "./BudgetBar";
import { StatementList } from "./StatementList";
import { WORKSPACE_TABS as TABS, workspaceSearch, type WorkspaceTab, type WorkspaceView } from "./workspace-view";
import { WorkspaceRecipes, type WorkspaceRecipe } from "./WorkspaceRecipes";
import styles from "./OckWorkspace.module.css";

/** O que o funcionário lê nas abas Entregas e Meus gastos (o dono, que é quem vê, não precisa do aviso). */
const OWNER_SEES = "O dono da empresa vê suas entregas e quanto cada tarefa custou. Suas conversas, não.";

interface OckWorkspaceProps {
  pageMemberId: string;
  firstName: string;
  /** Se quem está na página é o dono (para ele, o aviso do que o dono vê não aparece). */
  isOwner: boolean;
  initialConversations: ChatConversation[];
  initialMonth: MonthSpending;
  /** Os cartões da aba Receitas: as prontas e as que estão "Em breve". */
  recipeCards: RecipeSummary[];
  /** As receitas prontas, com o que a tela de cada uma precisa. */
  recipes: WorkspaceRecipe[];
  /** A aba e a receita com que a página abre, lidas do endereço. */
  initialView: WorkspaceView;
  /** Se a voz está ligada no chat (OCK_AI_TOOLS). */
  voice: boolean;
}

export function OckWorkspace({
  pageMemberId,
  firstName,
  isOwner,
  initialConversations,
  initialMonth,
  recipeCards,
  recipes,
  initialView,
  voice,
}: OckWorkspaceProps) {
  const ids = useId();
  const [view, setView] = useState(initialView);
  const [month, setMonth] = useState(initialMonth);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tab = view.tab;
  const suggestions = recipeCards.filter((card) => card.available);

  // Troca o que está aberto e escreve no endereço, sem recarregar a página nem criar um passo no "Voltar".
  function changeView(next: WorkspaceView) {
    setView(next);
    const search = workspaceSearch(window.location.search, next);
    window.history.replaceState(null, "", `${window.location.pathname}${search}`);
  }

  function selectTab(next: WorkspaceTab) {
    changeView({ ...view, tab: next });
  }

  // A receita cobrou uma etapa: busca o gasto do mês de novo, para o alto da página acompanhar.
  const refreshMonth = useCallback(() => {
    void loadSpending().then((result) => {
      if (result.ok) setMonth(result.data.month);
    });
  }, []);

  // Setas, Home e End trocam de aba, como o leitor de tela anuncia que funciona.
  function handleTabKey(event: KeyboardEvent<HTMLDivElement>) {
    const current = TABS.findIndex((item) => item.id === tab);
    const next = nextTabIndex(event.key, current, TABS.length);
    if (next === null) return;
    event.preventDefault();
    selectTab(TABS[next].id);
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
            onClick={() => selectTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* O chat fica montado nas outras abas: a conversa aberta e o que foi escrito continuam lá. */}
      <div role="tabpanel" id={`${ids}-panel-chat`} aria-labelledby={`${ids}-tab-chat`} hidden={tab !== "chat"}>
        <QuickChat
          pageMemberId={pageMemberId}
          initialConversations={initialConversations}
          onMonthChange={setMonth}
          recipeSuggestions={suggestions}
          onOpenRecipe={(recipeId) => changeView({ tab: "recipes", recipeId })}
          voice={voice}
        />
      </div>
      {/* A receita aberta também fica montada nas outras abas: o acompanhamento do time continua. */}
      <div role="tabpanel" id={`${ids}-panel-recipes`} aria-labelledby={`${ids}-tab-recipes`} hidden={tab !== "recipes"}>
        <WorkspaceRecipes
          pageMemberId={pageMemberId}
          cards={recipeCards}
          recipes={recipes}
          openRecipeId={view.recipeId}
          onOpen={(recipeId) => changeView({ tab: "recipes", recipeId })}
          onClose={() => changeView({ tab: "recipes", recipeId: null })}
          onSpendingChange={refreshMonth}
        />
      </div>
      <div
        role="tabpanel"
        id={`${ids}-panel-deliveries`}
        aria-labelledby={`${ids}-tab-deliveries`}
        hidden={tab !== "deliveries"}
      >
        {/* Montadas só quando abertas: cada vez que a aba abre, a lista vem atualizada. */}
        {tab === "deliveries" && <DeliveriesPanel isOwner={isOwner} />}
      </div>
      <div
        role="tabpanel"
        id={`${ids}-panel-spending`}
        aria-labelledby={`${ids}-tab-spending`}
        hidden={tab !== "spending"}
      >
        {tab === "spending" && <SpendingPanel isOwner={isOwner} onMonthChange={setMonth} />}
      </div>
    </main>
  );
}

type Loaded<T> = { state: "loading" } | { state: "ready"; data: T } | { state: "error"; problem: string };

function DeliveriesPanel({ isOwner }: { isOwner: boolean }) {
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
        Tudo o que as IAs fizeram para você: o site das receitas, PDF, planilha, Word, gráfico e projeto em .zip.
      </p>
      {!isOwner && <p className={styles.muted}>{OWNER_SEES}</p>}
      {deliveries.state === "loading" && <p className={styles.muted}>Carregando…</p>}
      {deliveries.state === "error" && (
        <p className={styles.problem} role="alert">
          {deliveries.problem}
        </p>
      )}
      {deliveries.state === "ready" &&
        (deliveries.data.length === 0 ? (
          <p className={styles.muted}>
            Nenhuma entrega ainda. Peça um arquivo no chat (ex.: &ldquo;gere um PDF&rdquo;) ou use uma receita.
          </p>
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

interface SpendingPanelProps {
  isOwner: boolean;
  onMonthChange: (month: MonthSpending) => void;
}

function SpendingPanel({ isOwner, onMonthChange }: SpendingPanelProps) {
  const [spending, setSpending] = useState<Loaded<{ month: MonthSpending; lines: StatementLine[]; more: boolean }>>({
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

  const { month, lines, more } = spending.data;
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
        {month.budgetCents !== null && (
          <BudgetBar
            spentCents={month.spentCents}
            budgetCents={month.budgetCents}
            label="Quanto do teto do mês já foi usado"
          />
        )}
        <p className={styles.muted}>O mês conta do dia 1º, à meia-noite de Brasília. O teto é definido pelo dono da empresa.</p>
      </div>
      {!isOwner && <p className={styles.muted}>{OWNER_SEES}</p>}

      {lines.length === 0 ? (
        <p className={styles.muted}>Nenhum gasto neste mês.</p>
      ) : (
        <StatementList lines={lines} label="Gastos do mês" />
      )}
      {more && <p className={styles.muted}>Mostrando os {STATEMENT_PAGE_SIZE} gastos mais recentes.</p>}
    </section>
  );
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

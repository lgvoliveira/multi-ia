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
import { MAX_FOLDER_NAME } from "@/lib/ock/chat";
import type { ChatConversation, ChatDelivery, ChatFolder, DeliveriesData, MonthSpending } from "@/lib/ock/chat";
import { createFolder, deleteFolder, fileUrl, loadDeliveries, loadSpending, moveDelivery } from "@/lib/ock/chat-client";
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
          <p className={styles.lead}>Peça o que precisar em português. O Chefe cuida do resto.</p>
        </div>
        <div className={styles.side}>
          <p className={styles.month}>
            {isOwner ? (
              <>
                Gasto do mês: <strong>{formatBRL(month.spentCents)}</strong>
                {month.budgetCents === null ? " (sem teto)" : ` de ${formatBRL(month.budgetCents)}`}
              </>
            ) : month.budgetCents === null ? (
              <>
                Créditos: <strong>ilimitados</strong>
              </>
            ) : (
              <>
                Créditos restantes: <strong>{formatCredits(Math.max(0, month.budgetCents - month.spentCents))}</strong>
              </>
            )}
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
        {tab === "deliveries" && <DeliveriesPanel isOwner={isOwner} pageMemberId={pageMemberId} />}
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

function DeliveriesPanel({ isOwner, pageMemberId }: { isOwner: boolean; pageMemberId: string }) {
  const [state, setState] = useState<Loaded<DeliveriesData>>({ state: "loading" });
  const [newFolder, setNewFolder] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const reload = useCallback(() => {
    void loadDeliveries().then((result) => {
      setState(result.ok ? { state: "ready", data: result.data } : { state: "error", problem: result.problem });
    });
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  async function addFolder() {
    const name = newFolder.trim();
    if (!name || busy) return;
    setBusy(true);
    setProblem(null);
    const result = await createFolder(name, pageMemberId);
    setBusy(false);
    if (!result.ok) {
      setProblem(result.problem);
      return;
    }
    setNewFolder("");
    reload();
  }

  async function move(deliveryId: string, folderId: string | null) {
    setBusy(true);
    setProblem(null);
    const result = await moveDelivery(deliveryId, folderId, pageMemberId);
    setBusy(false);
    if (!result.ok) {
      setProblem(result.problem);
      return;
    }
    reload();
  }

  async function removeFolder(id: string) {
    if (!window.confirm("Apagar esta tarefa? Os documentos dentro dela voltam para “Sem tarefa”.")) return;
    setBusy(true);
    setProblem(null);
    const result = await deleteFolder(id, pageMemberId);
    setBusy(false);
    if (!result.ok) {
      setProblem(result.problem);
      return;
    }
    reload();
  }

  if (state.state === "loading") return <p className={`${styles.panel} ${styles.muted}`}>Carregando…</p>;
  if (state.state === "error") {
    return (
      <p className={`${styles.panel} ${styles.problem}`} role="alert">
        {state.problem}
      </p>
    );
  }

  const { deliveries, folders } = state.data;

  // O dono vê as entregas da empresa numa lista só; as pastas (tarefas) são a organização de cada funcionário.
  if (isOwner) {
    return (
      <section className={styles.panel} aria-label="Entregas">
        <p className={styles.panelLead}>
          Tudo o que as IAs fizeram para a equipe: o site das receitas, PDF, planilha, Word, gráfico e projeto em .zip.
        </p>
        {deliveries.length === 0 ? (
          <p className={styles.muted}>Nenhuma entrega ainda.</p>
        ) : (
          <ul className={styles.rows}>
            {deliveries.map((delivery) => (
              <li key={delivery.id} className={styles.row}>
                <span className={styles.rowName}>{delivery.name}</span>
                <span className={styles.rowDate}>{formatDateTime(delivery.createdAt)}</span>
                <a className={styles.rowLink} href={fileUrl(delivery.id)} download={delivery.name}>
                  Baixar<span className={styles.visuallyHidden}> {delivery.name}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  // Funcionário: as entregas organizadas por tarefa (pastas), com criar tarefa e mover documento entre elas.
  const byFolder = new Map<string | null, ChatDelivery[]>();
  for (const delivery of deliveries) {
    const list = byFolder.get(delivery.folderId);
    if (list) list.push(delivery);
    else byFolder.set(delivery.folderId, [delivery]);
  }
  const loose = byFolder.get(null) ?? [];

  return (
    <section className={styles.panel} aria-label="Entregas">
      <p className={styles.panelLead}>
        Tudo o que as IAs fizeram para você, organizado por tarefa. Crie uma tarefa e mova cada documento (de qualquer
        chat) para a tarefa que quiser.
      </p>
      <p className={styles.muted}>{OWNER_SEES}</p>
      {problem && (
        <p className={styles.problem} role="alert">
          {problem}
        </p>
      )}

      <form
        className={styles.newFolder}
        onSubmit={(event) => {
          event.preventDefault();
          void addFolder();
        }}
      >
        <input
          className={styles.newFolderInput}
          value={newFolder}
          onChange={(event) => setNewFolder(event.target.value)}
          maxLength={MAX_FOLDER_NAME}
          placeholder="Nome da tarefa (ex.: Campanha de maio)"
          aria-label="Nome da nova tarefa"
        />
        <button type="submit" className={styles.newFolderBtn} disabled={busy || !newFolder.trim()}>
          + Nova tarefa
        </button>
      </form>

      {deliveries.length === 0 && folders.length === 0 && (
        <p className={styles.muted}>
          Nenhuma entrega ainda. Peça um arquivo no chat (ex.: &ldquo;gere um PDF&rdquo;) ou use uma receita.
        </p>
      )}

      {folders.map((folder) => (
        <FolderBlock
          key={folder.id}
          title={folder.name}
          items={byFolder.get(folder.id) ?? []}
          folders={folders}
          busy={busy}
          onMove={move}
          onDelete={() => void removeFolder(folder.id)}
        />
      ))}

      {(loose.length > 0 || folders.length > 0) && (
        <FolderBlock title="Sem tarefa" items={loose} folders={folders} busy={busy} onMove={move} />
      )}
    </section>
  );
}

function FolderBlock({
  title,
  items,
  folders,
  busy,
  onMove,
  onDelete,
}: {
  title: string;
  items: ChatDelivery[];
  folders: ChatFolder[];
  busy: boolean;
  onMove: (deliveryId: string, folderId: string | null) => void;
  onDelete?: () => void;
}) {
  return (
    <section className={styles.folder} aria-label={`Tarefa: ${title}`}>
      <div className={styles.folderHead}>
        <h3 className={styles.folderName}>
          {title}
          <span className={styles.folderCount}>({items.length})</span>
        </h3>
        {onDelete && (
          <button type="button" className={styles.folderDelete} onClick={onDelete} disabled={busy}>
            Apagar tarefa
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className={styles.muted}>
          {onDelete ? "Vazia. Mova um documento para cá pelo seletor “Mover para”." : "Nenhum documento solto."}
        </p>
      ) : (
        <ul className={styles.rows}>
          {items.map((delivery) => (
            <li key={delivery.id} className={styles.row}>
              <span className={styles.rowName}>{delivery.name}</span>
              <span className={styles.rowDate}>{formatDateTime(delivery.createdAt)}</span>
              <label>
                <span className={styles.visuallyHidden}>Mover {delivery.name} para a tarefa</span>
                <select
                  className={styles.moveSelect}
                  value={delivery.folderId ?? ""}
                  disabled={busy}
                  onChange={(event) => onMove(delivery.id, event.target.value || null)}
                >
                  <option value="">Sem tarefa</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </label>
              <a className={styles.rowLink} href={fileUrl(delivery.id)} download={delivery.name}>
                Baixar<span className={styles.visuallyHidden}> {delivery.name}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
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

  // O funcionário vê só os créditos que restam (nunca valores em dinheiro — isso é do dono).
  if (!isOwner) {
    const remaining = month.budgetCents === null ? null : Math.max(0, month.budgetCents - month.spentCents);
    return (
      <section className={styles.panel} aria-label="Meus créditos">
        <div className={styles.usage}>
          <div className={styles.usageTop}>
            <div className={styles.usageItem}>
              <span className={styles.muted}>Créditos restantes neste mês</span>
              <span className={styles.usageValue}>{remaining === null ? "Ilimitados" : formatCredits(remaining)}</span>
            </div>
            {month.budgetCents !== null && (
              <div className={`${styles.usageItem} ${styles.usageRight}`}>
                <span className={styles.muted}>Do total do mês</span>
                <span className={styles.usageLimit}>{formatCredits(month.budgetCents)} créditos</span>
              </div>
            )}
          </div>
          {month.budgetCents !== null && (
            <BudgetBar
              spentCents={month.spentCents}
              budgetCents={month.budgetCents}
              label="Quanto dos seus créditos do mês já foi usado"
            />
          )}
          <p className={styles.muted}>
            Os créditos renovam no dia 1º. O total é definido pelo dono da empresa. O que você produziu fica na aba
            Entregas.
          </p>
        </div>
      </section>
    );
  }

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

/** Os créditos da OCK que o funcionário vê (1 crédito = R$ 0,01): esconde o valor em dinheiro, mostra um número. */
function formatCredits(cents: number): string {
  return Math.round(cents).toLocaleString("pt-BR");
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

"use client";

// O painel do Dono: ver os funcionários e quanto cada um gastou, definir um teto de gasto por funcionário,
// adicionar funcionário, e ver as últimas tarefas da empresa. Sem pagamento: a gente só MEDE o gasto.

import { useEffect, useState } from "react";
import { formatBRL, formatTokens, PROVIDER_LABEL } from "@/lib/ock/pricing";
import type { ProviderId } from "@/lib/providers/types";
import styles from "./OwnerDashboard.module.css";

interface Member {
  id: string;
  name: string;
  role: "owner" | "employee";
  budgetCents: number | null;
  spentCents: number;
  email: string | null;
  tempPassword: string | null;
  mustChangePassword: boolean;
}

interface TaskLog {
  prompt: string;
  answer: string | null;
  provider: ProviderId;
  effort: string;
  memberId: string | null;
  memberName: string | null;
  costCents: number;
}

interface CompanyInfo {
  creditCents: number | null;
}

interface ProviderSpend {
  provider: ProviderId;
  costCents: number;
  tokens: number;
  tasks: number;
}

interface Savings {
  premiumCents: number;
  actualCents: number;
  savedCents: number;
}

interface CompanyResponse {
  company?: CompanyInfo;
  members?: Member[];
  tasks?: TaskLog[];
  byProvider?: ProviderSpend[];
  savings?: Savings;
}

interface DeliveryFile {
  id: string;
  name: string;
  createdAt: string;
  url: string | null;
}

export function OwnerDashboard() {
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<TaskLog[]>([]);
  const [creditCents, setCreditCents] = useState<number | null>(null);
  const [byProvider, setByProvider] = useState<ProviderSpend[]>([]);
  const [savings, setSavings] = useState<Savings | null>(null);
  const [tab, setTab] = useState<"creditos" | "gastos" | "entregas">("gastos");
  const [newName, setNewName] = useState("");
  const [newBudgetReais, setNewBudgetReais] = useState<number | null>(null);
  const [creditReais, setCreditReais] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [deliveriesByMember, setDeliveriesByMember] = useState<Record<string, DeliveryFile[]>>({});
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [summaryBusy, setSummaryBusy] = useState<string | null>(null);

  function apply(data: CompanyResponse) {
    setMembers(data.members ?? []);
    setTasks(data.tasks ?? []);
    setCreditCents(data.company?.creditCents ?? null);
    setByProvider(data.byProvider ?? []);
    setSavings(data.savings ?? null);
  }

  async function load() {
    try {
      const res = await fetch("/api/ock/company", { cache: "no-store" });
      if (!res.ok) return;
      apply((await res.json()) as CompanyResponse);
    } catch {
      // Recarrega na próxima ação.
    }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/ock/company", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as CompanyResponse;
        if (!active) return;
        apply(data);
      } catch {
        // Recarrega na próxima ação.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Quando o dono abre "Painel de entregas", busca os arquivos produzidos por cada funcionário.
  useEffect(() => {
    if (tab !== "entregas") return;
    let active = true;
    (async () => {
      const emps = members.filter((m) => m.role === "employee");
      const out: Record<string, DeliveryFile[]> = {};
      await Promise.all(
        emps.map(async (m) => {
          try {
            const res = await fetch(`/api/ock/deliveries?memberId=${m.id}`, { cache: "no-store" });
            if (res.ok) out[m.id] = ((await res.json()) as { deliveries?: DeliveryFile[] }).deliveries ?? [];
          } catch {
            // ignora este funcionário
          }
        }),
      );
      if (active) setDeliveriesByMember(out);
    })();
    return () => {
      active = false;
    };
  }, [tab, members]);

  async function loadSummary(memberId: string) {
    setSummaryBusy(memberId);
    try {
      const res = await fetch(`/api/ock/summary?memberId=${memberId}`, { cache: "no-store" });
      const data = (await res.json()) as { summary?: string; problem?: string };
      setSummaries((prev) => ({ ...prev, [memberId]: data.summary ?? data.problem ?? "Não deu para gerar." }));
    } catch {
      setSummaries((prev) => ({ ...prev, [memberId]: "Não deu para gerar o resumo agora." }));
    } finally {
      setSummaryBusy(null);
    }
  }

  async function addCredit() {
    if (creditReais == null || creditReais <= 0 || busy) return;
    setBusy(true);
    try {
      await fetch("/api/ock/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addCreditCents: Math.round(creditReais * 100) }),
      });
      setCreditReais(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function addEmployee() {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      await fetch("/api/ock/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          budgetCents: newBudgetReais != null && newBudgetReais > 0 ? Math.round(newBudgetReais * 100) : undefined,
        }),
      });
      setNewName("");
      setNewBudgetReais(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function changeBudget(memberId: string, reais: number | null) {
    const budgetCents = reais != null && reais > 0 ? Math.round(reais * 100) : null;
    await fetch("/api/ock/company", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, budgetCents }),
    });
    await load();
  }

  async function deleteEmployee(memberId: string, memberName: string) {
    if (busy) return;
    if (!window.confirm(`Excluir ${memberName}? Isso apaga o login, os chats e as entregas dele. Não dá para desfazer.`)) {
      return;
    }
    setBusy(true);
    try {
      await fetch(`/api/ock/company?memberId=${memberId}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  const employees = members.filter((m) => m.role === "employee");
  const totalSpent = members.reduce((sum, m) => sum + m.spentCents, 0);
  const creditOver = creditCents != null && totalSpent >= creditCents;
  const creditBalance = creditCents != null ? Math.max(0, creditCents - totalSpent) : null;
  const maxAiCost = byProvider.reduce((m, p) => Math.max(m, p.costCents), 1);
  // Aviso: a soma dos tetos mensais dos funcionários não deveria passar do crédito da empresa.
  const totalBudgets = employees.reduce((sum, m) => sum + (m.budgetCents ?? 0), 0);
  const overAllocated = creditCents != null && totalBudgets > creditCents;

  return (
    <main className={styles.main}>
      <header className={styles.head}>
        <div>
          <p className={styles.kicker}>Painel do dono</p>
          <h1 className={styles.title}>Sua empresa</h1>
        </div>
        <div className={styles.total}>
          <span className={styles.totalLabel}>Gasto total do mês</span>
          <span className={styles.totalValue}>{formatBRL(totalSpent)}</span>
        </div>
      </header>

      <button
        type="button"
        className={styles.floatTab}
        data-active={tab === "creditos"}
        onClick={() => setTab("creditos")}
      >
        💳 Créditos
      </button>

      <div className={styles.tabs}>
        <button type="button" className={styles.tab} data-active={tab === "gastos"} onClick={() => setTab("gastos")}>
          Painel de gastos
        </button>
        <button type="button" className={styles.tab} data-active={tab === "entregas"} onClick={() => setTab("entregas")}>
          Painel de entregas
        </button>
      </div>

      {tab === "creditos" && (
      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Adicionar créditos</h2>
        <p className={styles.muted}>
          Adicione o valor que a empresa quer carregar para usar a plataforma. Os funcionários usam até o
          crédito acabar; quando acabar, é só recarregar aqui.
        </p>
        <div className={styles.addCreditRow}>
          <span className={styles.addCreditPrefix}>R$</span>
          <MoneyInput
            className={styles.addCreditInput}
            reais={creditReais}
            onChange={setCreditReais}
            placeholder="ex.: 10.000"
          />
          <button
            type="button"
            className={styles.addButton}
            onClick={() => void addCredit()}
            disabled={busy || !(creditReais != null && creditReais > 0)}
          >
            Adicionar créditos
          </button>
        </div>

        <div className={styles.creditsBalance}>
          <div className={styles.balanceItem}>
            <span className={styles.barLabel}>Crédito carregado</span>
            <span className={styles.balanceValue}>
              {creditCents != null ? formatBRL(creditCents) : "ilimitado (modo teste)"}
            </span>
          </div>
          <div className={styles.balanceItem}>
            <span className={styles.barLabel}>Gasto</span>
            <span className={styles.balanceValue}>{formatBRL(totalSpent)}</span>
          </div>
          {creditBalance != null && (
            <div className={styles.balanceItem}>
              <span className={styles.barLabel}>Saldo</span>
              <span className={styles.balanceValue} data-over={creditOver}>{formatBRL(creditBalance)}</span>
            </div>
          )}
        </div>
        {creditCents != null && (
          <div className={styles.barTrack}>
            <div
              className={styles.barFill}
              data-over={creditOver}
              style={{ width: `${Math.min(100, (totalSpent / creditCents) * 100)}%` }}
            />
          </div>
        )}
        {creditOver && (
          <p className={styles.creditBlocked}>⛔ Crédito esgotado — os funcionários estão travados. Adicione mais créditos para liberar.</p>
        )}
        {overAllocated && (
          <p className={styles.creditBlocked}>
            ⚠️ A soma dos créditos/mês dos funcionários ({formatBRL(totalBudgets)}) passa do crédito da empresa
            ({formatBRL(creditCents ?? 0)}). Carregue mais crédito ou reduza os limites.
          </p>
        )}
      </section>
      )}

      {tab === "gastos" && (
      <>
      {savings && savings.premiumCents > 0 && (
      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Economia</h2>
        <p className={styles.muted}>
          Quanto o Chefe economizou escolhendo a IA e o nível certos para cada tarefa, em vez de rodar
          tudo no modelo mais potente.
        </p>
        <div className={styles.savings}>
          <div className={styles.savingsMain}>
            <span className={styles.savingsBig}>{formatBRL(savings.savedCents)}</span>
            <span className={styles.savingsSub}>economizados até agora</span>
          </div>
          <div className={styles.savingsCompare}>
            <span>
              Custo real: <strong>{formatBRL(savings.actualCents)}</strong>
            </span>
            <span>
              No modelo mais potente seria: <strong>{formatBRL(savings.premiumCents)}</strong>
            </span>
            <span className={styles.savingsPct}>
              {Math.round((savings.savedCents / savings.premiumCents) * 100)}% mais barato
            </span>
          </div>
        </div>
      </section>
      )}

      {byProvider.length > 0 && (
      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Gasto por IA</h2>
        <p className={styles.muted}>Quanto cada IA custou à empresa. Serve para ver qual compensa e qual pesa no bolso.</p>
        <div className={styles.byAi}>
          {byProvider.map((p) => (
            <div key={p.provider} className={styles.aiRow}>
              <div className={styles.aiHead}>
                <span className={styles.aiDot} data-ai={p.provider} />
                <span className={styles.aiName}>{PROVIDER_LABEL[p.provider]}</span>
                <span className={styles.aiCost}>{formatBRL(p.costCents)}</span>
              </div>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ width: `${(p.costCents / maxAiCost) * 100}%` }} />
              </div>
              <span className={styles.aiMeta}>
                {p.tasks} {p.tasks === 1 ? "tarefa" : "tarefas"} · {formatTokens(p.tokens)} tokens
              </span>
            </div>
          ))}
        </div>
      </section>
      )}

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Adicionar login de funcionário</h2>

        <div className={styles.addRow}>
          <input
            className={styles.addName}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome do novo funcionário"
          />
          <MoneyInput
            className={styles.addBudget}
            reais={newBudgetReais}
            onChange={setNewBudgetReais}
            placeholder="Créditos/mês R$ (opcional)"
          />
          <button type="button" className={styles.addButton} onClick={() => void addEmployee()} disabled={busy || !newName.trim()}>
            Adicionar
          </button>
        </div>

        {overAllocated && (
          <p className={styles.creditBlocked}>
            ⚠️ A soma dos créditos/mês ({formatBRL(totalBudgets)}) passa do crédito da empresa
            ({formatBRL(creditCents ?? 0)}). Carregue mais crédito (aba Créditos) ou reduza os limites.
          </p>
        )}

        <div className={styles.members}>
          {employees.map((member) => (
            <div key={member.id} className={styles.member}>
              <div className={styles.memberInfo}>
                <span className={styles.memberName}>{member.name}</span>
                <span className={styles.memberSpent}>
                  gastou <strong>{formatBRL(member.spentCents)}</strong>
                  {member.budgetCents != null && <> de {formatBRL(member.budgetCents)}</>}
                </span>
              </div>
              {member.budgetCents != null && (
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    data-over={member.spentCents > member.budgetCents}
                    style={{ width: `${Math.min(100, (member.spentCents / member.budgetCents) * 100)}%` }}
                  />
                </div>
              )}
              <div className={styles.memberActions}>
                <div className={styles.budgetLabel}>
                  <span>Créditos/mês</span>
                  <BudgetField
                    cents={member.budgetCents}
                    onCommit={(reais) => void changeBudget(member.id, reais)}
                  />
                </div>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => void deleteEmployee(member.id, member.name)}
                  disabled={busy}
                >
                  Excluir
                </button>
              </div>
              {member.email && (
                <div className={styles.login}>
                  <CopyField label="Login" value={member.email} />
                  {member.mustChangePassword ? (
                    <>
                      <CopyField label="Senha temporária" value={member.tempPassword ?? ""} />
                      <span className={styles.loginHint}>Entregue ao funcionário; ele cria a própria senha no 1º acesso.</span>
                    </>
                  ) : (
                    <span className={styles.loginHint}>🔒 Senha definida pelo funcionário — você não tem acesso à conta.</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
      </>
      )}

      {tab === "entregas" && (
      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Entregas por funcionário</h2>
        <p className={styles.muted}>Os arquivos que cada funcionário produziu e um resumo do dia dele.</p>
        {employees.length === 0 && <p className={styles.muted}>Nenhum funcionário ainda.</p>}
        <div className={styles.deliveries}>
          {employees.map((member) => {
            const files = deliveriesByMember[member.id] ?? [];
            const own = tasks.filter((task) => task.memberId === member.id);
            return (
              <div key={member.id} className={styles.deliveryGroup}>
                <div className={styles.deliveryWhoRow}>
                  <h3 className={styles.deliveryWho}>{member.name}</h3>
                  <button
                    type="button"
                    className={styles.editBtn}
                    onClick={() => void loadSummary(member.id)}
                    disabled={summaryBusy === member.id}
                  >
                    {summaryBusy === member.id ? "Gerando…" : "Resumo do dia"}
                  </button>
                </div>

                {summaries[member.id] && <p className={styles.summaryBox}>{summaries[member.id]}</p>}

                {files.length > 0 && (
                  <div className={styles.fileList}>
                    {files.map((f) => (
                      <div key={f.id} className={styles.deliveryFileRow}>
                        <span className={styles.deliveryFileName}>📄 {f.name}</span>
                        {f.url && (
                          <a className={styles.openLink} href={f.url} target="_blank" rel="noopener noreferrer" download={f.name}>
                            Baixar
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {own.map((task, index) => (
                  <article key={index} className={styles.delivery}>
                    <div className={styles.deliveryHead}>
                      <span className={styles.aiDot} data-ai={task.provider} />
                      <span className={styles.deliveryPrompt}>{task.prompt}</span>
                      <span className={styles.taskMeta}>
                        {PROVIDER_LABEL[task.provider]} · {formatBRL(task.costCents)}
                      </span>
                    </div>
                  </article>
                ))}

                {files.length === 0 && own.length === 0 && <p className={styles.muted}>Nada ainda.</p>}
              </div>
            );
          })}
        </div>
      </section>
      )}

    </main>
  );
}

/** Mostra um valor (email/senha) num campo bonito com botão "Copiar" que leva para a área de transferência. */
function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Alguns navegadores bloqueiam a área de transferência: o valor ainda dá para selecionar à mão.
    }
  }

  return (
    <div className={styles.copyField}>
      <span className={styles.copyLabel}>{label}</span>
      <code className={styles.copyValue}>{value}</code>
      <button type="button" className={styles.copyBtn} data-copied={copied} onClick={() => void copy()}>
        {copied ? "Copiado!" : "Copiar"}
      </button>
    </div>
  );
}

/** Campo de valor em reais com separador de milhar (ex.: 10.000), sem as setinhas do input numérico. */
function MoneyInput({
  reais,
  onChange,
  onBlur,
  placeholder,
  className,
}: {
  reais: number | null;
  onChange: (reais: number | null) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      className={className}
      value={reais != null ? reais.toLocaleString("pt-BR") : ""}
      placeholder={placeholder}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        onChange(digits ? Number(digits) : null);
      }}
      onBlur={onBlur}
    />
  );
}

/** Teto mensal de um funcionário: mostra o valor e só vira editável ao clicar em "Editar". */
function BudgetField({ cents, onCommit }: { cents: number | null; onCommit: (reais: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [reais, setReais] = useState<number | null>(cents != null ? Math.round(cents / 100) : null);

  if (!editing) {
    return (
      <div className={styles.budgetView}>
        <span className={styles.budgetValue}>{cents != null ? formatBRL(cents) : "sem limite"}</span>
        <button
          type="button"
          className={styles.editBtn}
          onClick={() => {
            setReais(cents != null ? Math.round(cents / 100) : null);
            setEditing(true);
          }}
        >
          Editar
        </button>
      </div>
    );
  }

  return (
    <div className={styles.budgetView}>
      <MoneyInput className={styles.budgetInput} reais={reais} onChange={setReais} placeholder="sem limite" />
      <button
        type="button"
        className={styles.editBtn}
        data-save
        onClick={() => {
          onCommit(reais);
          setEditing(false);
        }}
      >
        Salvar
      </button>
    </div>
  );
}

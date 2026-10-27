"use client";

// Tela do resultado ("Seu site está pronto", "Sua proposta está pronta"): o site (prévia ou código) ou o texto, os
// botões de copiar e de baixar o arquivo, quanto custou e o resumo de como o time chegou ao resultado, com acesso a
// todas as etapas.

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { formatBRL } from "@/lib/ock/pricing";
import { parseRichText, plainText } from "@/lib/ock/rich-text";
import { siteFileName } from "@/lib/ock/site-file";
import { getProviderInfo } from "@/lib/providers/catalog";
import { AiDot } from "./AiDot";
import { RichText } from "./RichText";
import { formatDuration, type RunState } from "./run-state";
import { SitePreview } from "./SitePreview";
import { StepCard } from "./StepCard";
import styles from "./RunResult.module.css";

/** O resultado final: um site, ou um texto com o endereço que baixa o Word dele. */
export type RunOutcome = { kind: "site"; site: string } | { kind: "text"; text: string; documentHref: string };

interface RunResultProps {
  request: string;
  run: RunState;
  /** O título da tela, que vem da receita (ex.: "Sua proposta está pronta"). */
  title: string;
  outcome: RunOutcome;
  /** Quanto o time gastou do saldo da empresa, em centavos; null enquanto não se sabe. */
  chargedCents: number | null;
  onRestart: () => void;
}

export function RunResult({ request, run, title, outcome, chargedCents, onRestart }: RunResultProps) {
  const ids = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const stepsTitleRef = useRef<HTMLHeadingElement>(null);
  const [showSteps, setShowSteps] = useState(false);

  // O resultado começa do alto (a tela anterior podia estar rolada até a última etapa), e o foco vai
  // para o título: quem usa leitor de tela fica sabendo da troca. Se a receita terminou com a pessoa em outra aba do
  // espaço de trabalho (a receita fica escondida), a página fica onde está.
  useEffect(() => {
    const title = titleRef.current;
    if (!title || title.getClientRects().length === 0) return;
    window.scrollTo({ top: 0 });
    title.focus({ preventScroll: true });
  }, []);

  // Ao abrir "Ver todas as etapas", a tela (e o foco) vão até elas, que ficam embaixo da prévia.
  useEffect(() => {
    if (showSteps) stepsTitleRef.current?.focus();
  }, [showSteps]);

  return (
    <div className={styles.result}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <p className={styles.kicker}>
            {run.durationMs === undefined ? "Concluído" : `Concluído em ${formatDuration(run.durationMs)}`}
            {chargedCents !== null && ` · Custou ${formatBRL(chargedCents)}`}
          </p>
          <h2 ref={titleRef} tabIndex={-1} className={styles.title}>
            {title}
          </h2>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={onRestart}>
            Começar de novo
          </button>
          {outcome.kind === "site" ? (
            <button type="button" className={styles.primaryButton} onClick={() => downloadSite(outcome.site)}>
              Baixar arquivo
            </button>
          ) : (
            <>
              <CopyButton text={outcome.text} />
              {/* O servidor manda o Word como anexo: o navegador só salva. */}
              <a className={styles.primaryButton} href={outcome.documentHref} download>
                Baixar em Word
              </a>
            </>
          )}
        </div>
      </div>

      <div className={styles.layout}>
        {outcome.kind === "site" ? (
          <section className={styles.main} aria-label="Seu site">
            <ResultTabs site={outcome.site} />
            <p className={styles.note}>
              Na prévia, os botões que levam para fora do site (WhatsApp, telefone, e-mail) não abrem. No
              arquivo baixado, eles funcionam normalmente.
            </p>
          </section>
        ) : (
          <section className={styles.main} aria-label="O resultado">
            <div className={styles.document}>
              <RichText text={outcome.text} />
            </div>
            <p className={styles.note}>
              Confira o texto antes de mandar: o que estiver entre colchetes, como [valor], é para você preencher.
            </p>
          </section>
        )}

        <aside className={styles.team} aria-labelledby={`${ids}-team`}>
          <h3 id={`${ids}-team`} className={styles.teamTitle}>
            Como o time chegou aqui
          </h3>
          <ol className={styles.teamSteps}>
            {run.steps.map((step) => (
              <li key={step.id} className={styles.teamStep}>
                <span className={styles.teamStepName}>
                  <AiDot provider={step.provider} />
                  {step.name} · {getProviderInfo(step.provider).name}
                </span>
                {step.replacedProvider && (
                  <span className={styles.teamStepReplaced}>
                    No lugar do {getProviderInfo(step.replacedProvider).name}, que não conseguiu responder
                  </span>
                )}
                <span className={styles.teamStepSummary}>{step.doneSummary}</span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className={styles.linkButton}
            aria-expanded={showSteps}
            aria-controls={`${ids}-steps`}
            onClick={() => setShowSteps((shown) => !shown)}
          >
            {showSteps ? "Esconder as etapas" : "Ver todas as etapas"}
          </button>
        </aside>
      </div>

      <section
        id={`${ids}-steps`}
        className={styles.allSteps}
        aria-labelledby={`${ids}-steps-title`}
        hidden={!showSteps}
      >
        <h3 id={`${ids}-steps-title`} ref={stepsTitleRef} tabIndex={-1} className={styles.stepsTitle}>
          Todas as etapas
        </h3>
        <p className={styles.request}>
          <span className={styles.requestLabel}>Seu pedido:</span> {request}
        </p>
        <ol className={styles.steps}>
          {run.steps.map((step) => (
            <StepCard key={step.id} step={step} followText={false} headingLevel="h4" />
          ))}
        </ol>
      </section>
    </div>
  );
}

/** Quanto tempo o "Copiado" fica no botão antes de voltar ao normal. */
const COPIED_NOTICE_MS = 2500;

/** Copia o texto sem as marcas da IA, pronto para colar num e-mail ou no WhatsApp. */
function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state !== "copied") return;
    const timer = setTimeout(() => setState("idle"), COPIED_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [state]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(plainText(parseRichText(text)));
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <>
      <button type="button" className={styles.button} onClick={handleCopy}>
        {state === "copied" ? "Copiado" : "Copiar o texto"}
      </button>
      {/* Avisa quem usa leitor de tela, que não vê o botão mudar. */}
      <span role="status" className={state === "failed" ? styles.copyProblem : styles.visuallyHidden}>
        {state === "copied" && "Texto copiado."}
        {state === "failed" && "Não deu para copiar. Selecione o texto e copie com Ctrl + C."}
      </span>
    </>
  );
}

const TABS = [
  { id: "preview", label: "Prévia" },
  { id: "code", label: "Código" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** Abas Prévia e Código. As duas ficam carregadas: voltar para a prévia não recomeça o site. */
function ResultTabs({ site }: { site: string }) {
  const ids = useId();
  const [selected, setSelected] = useState<TabId>("preview");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Setas, Home e End trocam de aba, como o leitor de tela anuncia que funciona.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = TABS.findIndex((tab) => tab.id === selected);
    const next = nextTabIndex(event.key, current, TABS.length);
    if (next === null) return;
    event.preventDefault();
    setSelected(TABS[next].id);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className={styles.tabs}>
      <div role="tablist" aria-label="Como ver o site" className={styles.tabList} onKeyDown={handleKeyDown}>
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            ref={(button) => {
              tabRefs.current[index] = button;
            }}
            type="button"
            role="tab"
            id={`${ids}-tab-${tab.id}`}
            aria-selected={selected === tab.id}
            aria-controls={`${ids}-panel-${tab.id}`}
            tabIndex={selected === tab.id ? 0 : -1}
            className={styles.tab}
            onClick={() => setSelected(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`${ids}-panel-preview`}
        aria-labelledby={`${ids}-tab-preview`}
        hidden={selected !== "preview"}
      >
        <SitePreview html={site} />
      </div>
      {/* tabIndex deixa rolar o código pelo teclado. */}
      <pre
        role="tabpanel"
        id={`${ids}-panel-code`}
        aria-labelledby={`${ids}-tab-code`}
        hidden={selected !== "code"}
        tabIndex={0}
        className={styles.code}
      >
        {site}
      </pre>
    </div>
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

/** Tempo até liberar da memória o arquivo baixado: o navegador já começou a baixar. */
const DOWNLOAD_URL_LIFETIME_MS = 10_000;

/** Baixa o site como um arquivo .html. */
function downloadSite(site: string) {
  // "application/octet-stream" faz o navegador só salvar o arquivo. Ele nunca abre o site como uma página
  // do nosso endereço, onde o código das IAs enxergaria a nossa página.
  const url = URL.createObjectURL(new Blob([site], { type: "application/octet-stream" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = siteFileName(site);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS);
}

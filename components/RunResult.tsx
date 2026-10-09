"use client";

// Tela "Seu site está pronto": a prévia do site (ou o código), o botão de baixar o arquivo
// e o resumo de como o time chegou ao resultado, com acesso a todas as etapas.

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { getProviderInfo } from "@/lib/providers/catalog";
import { AiDot } from "./AiDot";
import { siteFileName } from "./generated-site";
import { formatDuration, type RunState } from "./run-state";
import { SitePreview } from "./SitePreview";
import { StepCard } from "./StepCard";
import styles from "./RunResult.module.css";

interface RunResultProps {
  request: string;
  run: RunState;
  /** O site pronto: o resultado final da execução. */
  site: string;
  onRestart: () => void;
}

export function RunResult({ request, run, site, onRestart }: RunResultProps) {
  const ids = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const stepsTitleRef = useRef<HTMLHeadingElement>(null);
  const [showSteps, setShowSteps] = useState(false);

  // O resultado começa do alto (a tela anterior podia estar rolada até a última etapa), e o foco vai
  // para o título: quem usa leitor de tela fica sabendo da troca.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    titleRef.current?.focus({ preventScroll: true });
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
          </p>
          <h1 ref={titleRef} tabIndex={-1} className={styles.title}>
            Seu site está pronto
          </h1>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={onRestart}>
            Começar de novo
          </button>
          <button type="button" className={styles.primaryButton} onClick={() => downloadSite(site)}>
            Baixar arquivo
          </button>
        </div>
      </div>

      <div className={styles.layout}>
        <section className={styles.main} aria-label="Seu site">
          <ResultTabs site={site} />
          <p className={styles.note}>
            Na prévia, os botões que levam para fora do site (WhatsApp, telefone, e-mail) não abrem. No
            arquivo baixado, eles funcionam normalmente.
          </p>
        </section>

        <aside className={styles.team} aria-labelledby={`${ids}-team`}>
          <h2 id={`${ids}-team`} className={styles.teamTitle}>
            Como o time chegou aqui
          </h2>
          <ol className={styles.teamSteps}>
            {run.steps.map((step) => (
              <li key={step.id} className={styles.teamStep}>
                <span className={styles.teamStepName}>
                  <AiDot provider={step.provider} />
                  {step.name} · {getProviderInfo(step.provider).name}
                </span>
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
        <h2 id={`${ids}-steps-title`} ref={stepsTitleRef} tabIndex={-1} className={styles.stepsTitle}>
          Todas as etapas
        </h2>
        <p className={styles.request}>
          <span className={styles.requestLabel}>Seu pedido:</span> {request}
        </p>
        <ol className={styles.steps}>
          {run.steps.map((step) => (
            <StepCard key={step.id} step={step} followText={false} headingLevel="h3" />
          ))}
        </ol>
      </section>
    </div>
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

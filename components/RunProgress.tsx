"use client";

// Tela "Seu time está trabalhando": um cartão por etapa, com a cor da IA, o status
// e o texto aparecendo enquanto a IA escreve.

import { useEffect, useLayoutEffect, useRef } from "react";
import { getProviderInfo } from "@/lib/providers/catalog";
import { AiDot } from "./AiDot";
import {
  formatDuration,
  type RunState,
  type RunStatus,
  type StepStatus,
  type StepView,
} from "./run-state";
import styles from "./RunProgress.module.css";

interface RunProgressProps {
  recipeName: string;
  request: string;
  run: RunState;
  onCancel: () => void;
  onRestart: () => void;
}

const TITLES: Record<RunStatus, string> = {
  running: "Seu time está trabalhando",
  finished: "Seu time terminou",
  failed: "O time parou no meio do caminho",
  cancelled: "Você cancelou",
  interrupted: "A conexão caiu",
};

const STATUS_LABELS: Record<StepStatus, string> = {
  waiting: "Aguardando",
  working: "Trabalhando…",
  done: "Concluído",
  failed: "Falhou",
  stopped: "Interrompido",
  skipped: "Não começou",
};

const BADGE_CLASSES: Record<StepStatus, string> = {
  waiting: styles.badgeWaiting,
  working: styles.badgeWorking,
  done: styles.badgeDone,
  failed: styles.badgeFailed,
  stopped: styles.badgeWaiting,
  skipped: styles.badgeWaiting,
};

export function RunProgress({ recipeName, request, run, onCancel, onRestart }: RunProgressProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Leva o foco para o título quando esta tela aparece: quem usa leitor de tela fica sabendo da troca.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const workingIndex = run.steps.findIndex((step) => step.status === "working");
  const message = endMessage(run);

  return (
    <div className={styles.run}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <p className={styles.kicker}>
            {recipeName}
            {workingIndex >= 0 && ` · Etapa ${workingIndex + 1} de ${run.steps.length}`}
          </p>
          <h1 ref={titleRef} tabIndex={-1} className={styles.title}>
            {TITLES[run.status]}
          </h1>
        </div>
        {run.status === "running" ? (
          <button type="button" className={styles.button} onClick={onCancel}>
            Cancelar
          </button>
        ) : (
          <button type="button" className={styles.button} onClick={onRestart}>
            Começar de novo
          </button>
        )}
      </div>

      {message && <p className={`${styles.message} ${styles[message.tone]}`}>{message.text}</p>}

      <p className={styles.request}>
        <span className={styles.requestLabel}>Seu pedido:</span> {request}
      </p>

      <ol className={styles.steps}>
        {run.steps.map((step) => (
          <StepCard key={step.id} step={step} />
        ))}
      </ol>

      {/* Avisa quem usa leitor de tela de cada troca de etapa, sem ler o texto que a IA escreve. */}
      <p className={styles.visuallyHidden} role="status">
        {announcement(run, message?.text)}
      </p>
    </div>
  );
}

function StepCard({ step }: { step: StepView }) {
  const providerName = getProviderInfo(step.provider).name;
  const hasOutput = step.status === "working" || step.text.length > 0;
  const label =
    step.status === "done" && step.durationMs !== undefined
      ? `Concluído em ${formatDuration(step.durationMs)}`
      : STATUS_LABELS[step.status];

  return (
    <li
      className={step.status === "working" ? `${styles.step} ${styles.stepWorking}` : styles.step}
      aria-current={step.status === "working" ? "step" : undefined}
    >
      <div className={styles.stepHeader}>
        <AiDot provider={step.provider} size="large" />
        <h2 className={styles.stepName}>
          {step.name} · {providerName}
        </h2>
        {!hasOutput && <span className={styles.stepSummary}>{step.summary}</span>}
        <span className={`${styles.badge} ${BADGE_CLASSES[step.status]}`}>{label}</span>
      </div>
      {hasOutput && <StepOutput step={step} label={`Resposta de ${step.name} (${providerName})`} />}
    </li>
  );
}

/** Distância do fim (em pixels) em que a caixa ainda conta como "lá embaixo". */
const FOLLOW_MARGIN_PX = 24;

/** Caixa com o texto da etapa. Código do site aparece em fundo escuro, com letra de código. */
function StepOutput({ step, label }: { step: StepView; label: string }) {
  const boxRef = useRef<HTMLPreElement>(null);
  const followRef = useRef(true);
  const live = step.status === "working";

  // A cada pedaço novo, a caixa acompanha o fim do texto, a não ser que a pessoa tenha subido para ler.
  // Vale também quando a etapa termina: o último pedaço costuma chegar junto com o "terminou".
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (box && followRef.current) box.scrollTop = box.scrollHeight;
  }, [live, step.text]);

  function handleScroll() {
    const box = boxRef.current;
    if (box) followRef.current = box.scrollHeight - box.scrollTop - box.clientHeight < FOLLOW_MARGIN_PX;
  }

  const formatClass = step.format === "html" ? styles.outputCode : styles.outputText;

  return (
    // A caixa rola sozinha; tabIndex deixa rolar também pelo teclado.
    <pre
      ref={boxRef}
      className={`${styles.output} ${formatClass}`}
      tabIndex={0}
      role="region"
      aria-label={label}
      onScroll={handleScroll}
    >
      {step.text}
      {live && <span className={styles.caret} aria-hidden="true" />}
    </pre>
  );
}

type Tone = "messageDone" | "messageError" | "messageNeutral";

/** Recado que aparece no alto da tela quando a execução acaba. */
function endMessage(run: RunState): { text: string; tone: Tone } | null {
  switch (run.status) {
    case "running":
      return null;
    case "finished":
      return {
        text:
          "Pronto! A tela de resultado, com a prévia do site, ainda está em construção e chega na " +
          "próxima tarefa. Por enquanto, o resultado final aparece no último cartão.",
        tone: "messageDone",
      };
    case "failed": {
      const failed = run.steps.find((step) => step.status === "failed");
      const who = failed ? `${failed.name} (${getProviderInfo(failed.provider).name})` : "Uma das IAs";
      return {
        text:
          `${who} não conseguiu terminar a etapa. As etapas concluídas continuam aqui. ` +
          "Tente começar de novo daqui a pouco.",
        tone: "messageError",
      };
    }
    case "cancelled":
      return { text: "As etapas que já tinham terminado continuam aqui embaixo.", tone: "messageNeutral" };
    case "interrupted":
      return {
        text: "A conexão com o servidor caiu antes do fim. Confira sua internet e comece de novo.",
        tone: "messageError",
      };
  }
}

function announcement(run: RunState, message: string | undefined): string {
  if (run.status !== "running") return `${TITLES[run.status]}. ${message ?? ""}`;
  const working = run.steps.find((step) => step.status === "working");
  if (!working) return "Começando…";
  return `${working.name} (${getProviderInfo(working.provider).name}) está trabalhando.`;
}

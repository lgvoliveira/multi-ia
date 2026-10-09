"use client";

// Cartão de uma etapa: a cor da IA, o status e o texto que ela escreveu (aparecendo ao vivo enquanto escreve).
// Usado na tela "Seu time está trabalhando" e em "Ver todas as etapas", no resultado.

import { useLayoutEffect, useRef } from "react";
import { getProviderInfo } from "@/lib/providers/catalog";
import { AiDot } from "./AiDot";
import { formatDuration, type StepStatus, type StepView } from "./run-state";
import styles from "./StepCard.module.css";

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

interface StepCardProps {
  step: StepView;
  /** A caixa de texto acompanha o fim enquanto a IA escreve. Desligado, ela abre no começo, para ler. */
  followText?: boolean;
  /** Nível do título do cartão, para seguir a ordem dos títulos da página. */
  headingLevel?: "h2" | "h3";
}

export function StepCard({ step, followText = true, headingLevel: Heading = "h2" }: StepCardProps) {
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
        <Heading className={styles.stepName}>
          {step.name} · {providerName}
        </Heading>
        {!hasOutput && <span className={styles.stepSummary}>{step.summary}</span>}
        <span className={`${styles.badge} ${BADGE_CLASSES[step.status]}`}>{label}</span>
      </div>
      {hasOutput && (
        <StepOutput step={step} follow={followText} label={`Resposta de ${step.name} (${providerName})`} />
      )}
    </li>
  );
}

/** Distância do fim (em pixels) em que a caixa ainda conta como "lá embaixo". */
const FOLLOW_MARGIN_PX = 24;

/** Caixa com o texto da etapa. Código do site aparece em fundo escuro, com letra de código. */
function StepOutput({ step, follow, label }: { step: StepView; follow: boolean; label: string }) {
  const boxRef = useRef<HTMLPreElement>(null);
  const followRef = useRef(true);
  const live = step.status === "working";

  // A cada pedaço novo, a caixa acompanha o fim do texto, a não ser que a pessoa tenha subido para ler.
  // Vale também quando a etapa termina: o último pedaço costuma chegar junto com o "terminou".
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (box && follow && followRef.current) box.scrollTop = box.scrollHeight;
  }, [follow, live, step.text]);

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

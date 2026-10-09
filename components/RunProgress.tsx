"use client";

// Tela "Seu time está trabalhando": um cartão por etapa, com a cor da IA, o status
// e o texto aparecendo enquanto a IA escreve. Quando o time termina um site, entra a tela de resultado
// (RunResult); esta fica na tela se o time parar no meio do caminho ou se o resultado for texto.

import { useEffect, useRef } from "react";
import { getProviderInfo } from "@/lib/providers/catalog";
import type { RunState, RunStatus, StepView } from "./run-state";
import { StepCard } from "./StepCard";
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

type Tone = "messageDone" | "messageError" | "messageNeutral";

/** Recado que aparece no alto da tela quando a execução acaba. */
function endMessage(run: RunState): { text: string; tone: Tone } | null {
  switch (run.status) {
    case "running":
      return null;
    case "finished":
      return { text: "Pronto! O resultado final está no último cartão.", tone: "messageDone" };
    case "failed": {
      const failed = run.steps.find((step) => step.status === "failed");
      return {
        text:
          `${failureText(failed)} As etapas concluídas continuam aqui. ` +
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

/** Qual etapa parou e por quê. Se outra IA tinha assumido o papel, as duas não conseguiram. */
function failureText(failed: StepView | undefined): string {
  if (!failed) return "Uma das IAs não conseguiu terminar a etapa.";
  const providerName = getProviderInfo(failed.provider).name;
  if (!failed.replacedProvider) return `${failed.name} (${providerName}) não conseguiu terminar a etapa.`;
  const replacedName = getProviderInfo(failed.replacedProvider).name;
  return `${failed.name}: nem o ${replacedName} nem o ${providerName} conseguiram terminar a etapa.`;
}

function announcement(run: RunState, message: string | undefined): string {
  if (run.status !== "running") return `${TITLES[run.status]}. ${message ?? ""}`;
  const working = run.steps.find((step) => step.status === "working");
  if (!working) return "Começando…";
  const who = `${working.name} (${getProviderInfo(working.provider).name})`;
  if (working.retryAttempt) return `${who} teve um problema e está tentando de novo.`;
  if (working.replacedProvider) {
    return `${who} entrou no lugar do ${getProviderInfo(working.replacedProvider).name} e está trabalhando.`;
  }
  return `${who} está trabalhando.`;
}

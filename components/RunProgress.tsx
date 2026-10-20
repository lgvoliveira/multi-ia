"use client";

// Tela "Seu time está trabalhando": as fases, uma após a outra, com um cartão por etapa.
// Numa fase em paralelo, várias IAs trabalham ao mesmo tempo, lado a lado. Uma revisão pode mandar
// refazer uma fase, e aí aparece a rodada. Um "documento vivo" junta o que o time já produziu.
// Quando o time termina um site, entra a tela de resultado (RunResult); esta fica na tela se o time
// parar no meio do caminho ou se o resultado for texto.

import { useEffect, useRef } from "react";
import { getProviderInfo } from "@/lib/providers/catalog";
import {
  liveDocument,
  stagesOf,
  type LiveDocument,
  type RunState,
  type RunStatus,
  type StageView,
  type StepView,
} from "./run-state";
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

/** Nomes das partes do documento vivo, na ordem em que aparecem. */
const DOCUMENT_PARTS: { key: keyof LiveDocument; label: string }[] = [
  { key: "brief", label: "Plano do chefe" },
  { key: "research", label: "Pesquisa de mercado" },
  { key: "back", label: "Estrutura e conteúdo" },
  { key: "front", label: "Visual do site" },
  { key: "reviewNotes", label: "Revisão do chefe" },
];

export function RunProgress({ recipeName, request, run, onCancel, onRestart }: RunProgressProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Leva o foco para o título quando esta tela aparece: quem usa leitor de tela fica sabendo da troca.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const stages = stagesOf(run);
  const currentIndex = currentStageIndex(stages);
  const message = endMessage(run);
  const document = liveDocument(run);

  return (
    <div className={styles.run}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <p className={styles.kicker}>
            {recipeName}
            {run.status === "running" && currentIndex >= 0 && ` · Fase ${currentIndex + 1} de ${stages.length}`}
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

      <LiveDocumentPanel document={document} />

      <div className={styles.stages}>
        {stages.map((stage) => (
          <section key={stage.id} className={styles.stage} aria-label={stageAriaLabel(stage)}>
            {stage.round > 1 && (
              <p className={styles.roundBanner}>
                {stage.kind === "review"
                  ? `Revisão — rodada ${stage.round}`
                  : `Refazendo depois da revisão — rodada ${stage.round}`}
              </p>
            )}
            <ol className={stage.kind === "parallel" ? styles.parallelSteps : styles.steps}>
              {stage.steps.map((step) => (
                <StepCard key={step.id} step={step} />
              ))}
            </ol>
          </section>
        ))}
      </div>

      {/* Avisa quem usa leitor de tela de cada troca, sem ler o texto que a IA escreve. */}
      <p className={styles.visuallyHidden} role="status">
        {announcement(run, message?.text)}
      </p>
    </div>
  );
}

/** Painel com o que o time já produziu até agora. Fica escondido enquanto nenhuma parte está pronta. */
function LiveDocumentPanel({ document }: { document: LiveDocument }) {
  const parts = DOCUMENT_PARTS.filter((part) => document[part.key] !== undefined);
  if (parts.length === 0) return null;

  return (
    <section className={styles.liveDoc} aria-label="O que o time já produziu">
      <h2 className={styles.liveDocTitle}>O documento vai tomando forma</h2>
      <dl className={styles.liveDocList}>
        {parts.map((part) => (
          <div key={part.key} className={styles.liveDocItem}>
            <dt className={styles.liveDocLabel}>{part.label}</dt>
            <dd className={styles.liveDocPreview}>{preview(document[part.key] ?? "")}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Começo do texto de uma parte, só para dar uma ideia do que já existe. */
const PREVIEW_CHARS = 180;
function preview(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > PREVIEW_CHARS ? `${trimmed.slice(0, PREVIEW_CHARS)}…` : trimmed;
}

/** A fase em foco: a que tem alguém trabalhando; senão, a primeira que ainda não terminou. */
function currentStageIndex(stages: StageView[]): number {
  const working = stages.findIndex((stage) => stage.steps.some((step) => step.status === "working"));
  if (working >= 0) return working;
  const pending = stages.findIndex((stage) => stage.steps.some((step) => step.status === "waiting"));
  return pending >= 0 ? pending : stages.length - 1;
}

function stageAriaLabel(stage: StageView): string {
  const base = stage.kind === "parallel" ? "Fase em paralelo" : stage.kind === "review" ? "Revisão" : "Fase";
  return stage.round > 1 ? `${base}, rodada ${stage.round}` : base;
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
  const working = run.steps.filter((step) => step.status === "working");
  if (working.length === 0) return "Começando…";

  if (working.length === 1) {
    const [step] = working;
    const who = `${step.name} (${getProviderInfo(step.provider).name})`;
    if (step.retryAttempt) return `${who} teve um problema e está tentando de novo.`;
    if (step.replacedProvider) {
      return `${who} entrou no lugar do ${getProviderInfo(step.replacedProvider).name} e está trabalhando.`;
    }
    const round = roundOf(run, step);
    return round > 1 ? `${who} está refazendo o trabalho (rodada ${round}).` : `${who} está trabalhando.`;
  }

  // Várias IAs ao mesmo tempo: junta os nomes.
  const names = working.map((step) => `${step.name} (${getProviderInfo(step.provider).name})`);
  return `${joinNames(names)} estão trabalhando ao mesmo tempo.`;
}

/** Rodada da fase a que a etapa pertence. */
function roundOf(run: RunState, step: StepView): number {
  return run.stages.find((stage) => stage.id === step.stageId)?.round ?? step.round;
}

/** Junta nomes com vírgulas e um "e" antes do último, como se fala. */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

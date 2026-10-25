"use client";

// Tela "Seu time está trabalhando": as fases, uma após a outra, com um cartão por etapa.
// Numa fase em paralelo, várias IAs trabalham ao mesmo tempo, lado a lado. Uma revisão pode mandar
// refazer uma fase, e aí aparece a rodada. Um "documento vivo" junta o que o time já produziu.
// Quando o time termina um site, entra a tela de resultado (RunResult); esta fica na tela se o time
// parar no meio do caminho ou se o resultado for texto.
// Embaixo do título fica o custo: quanto o time já gastou do saldo da empresa e, no fim, quanto custou. Se o custo for
// passar do que foi reservado, o time pausa antes da próxima fase e esta tela pergunta: continuar ou parar aqui.

import { useEffect, useRef } from "react";
import { formatBRL } from "@/lib/ock/pricing";
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
  /** Aviso de algo que não deu certo enquanto o time trabalha (ex.: o login do navegador mudou). */
  notice?: string | null;
  /** Quanto o time já gastou do saldo da empresa, em centavos; null enquanto não se sabe. */
  chargedCents: number | null;
  /** O que foi reservado ao começar (o máximo que o time podia gastar), em centavos. */
  estimateCents: number | null;
  /** true enquanto o servidor tenta reservar o que falta, depois do "Continuar". */
  resuming: boolean;
  onCancel: () => void;
  onResume: () => void;
  onRestart: () => void;
}

const TITLES: Record<RunStatus, string> = {
  running: "Seu time está trabalhando",
  paused: "O time está esperando você",
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

export function RunProgress({
  recipeName,
  request,
  run,
  notice,
  chargedCents,
  estimateCents,
  resuming,
  onCancel,
  onResume,
  onRestart,
}: RunProgressProps) {
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
        {run.status === "running" && (
          <button type="button" className={styles.button} onClick={onCancel}>
            Cancelar
          </button>
        )}
        {run.status !== "running" && run.status !== "paused" && (
          <button type="button" className={styles.button} onClick={onRestart}>
            Começar de novo
          </button>
        )}
      </div>

      {message && <p className={`${styles.message} ${styles[message.tone]}`}>{message.text}</p>}
      {run.status === "paused" && (
        <PausePanel
          chargedCents={chargedCents}
          neededCents={run.neededCents}
          resuming={resuming}
          onResume={onResume}
          onStop={onCancel}
        />
      )}
      {notice && (run.status === "running" || run.status === "paused") && (
        <p className={`${styles.message} ${styles.messageError}`} role="alert">
          {notice}
        </p>
      )}
      <CostLine status={run.status} chargedCents={chargedCents} estimateCents={estimateCents} />

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

interface PausePanelProps {
  chargedCents: number | null;
  neededCents: number | undefined;
  resuming: boolean;
  onResume: () => void;
  onStop: () => void;
}

/** A pergunta da pausa: o custo ia passar do que foi reservado. Continuar reserva o que falta; parar encerra aqui. */
function PausePanel({ chargedCents, neededCents, resuming, onResume, onStop }: PausePanelProps) {
  return (
    <section className={styles.pause} aria-label="O time pausou">
      <p>
        O custo vai passar do que foi reservado, então o time parou antes da próxima fase.
        {chargedCents !== null && ` Até aqui, ele gastou ${formatBRL(chargedCents)}.`}
      </p>
      <p>
        {neededCents === undefined
          ? "Para terminar, é preciso reservar mais do saldo da empresa."
          : `Para terminar, é preciso reservar até ${formatBRL(neededCents)} do saldo da empresa.`}{" "}
        Você paga só o que o time usar. Se parar aqui, paga só as etapas concluídas.
      </p>
      <div className={styles.pauseActions}>
        <button type="button" className={styles.primaryButton} onClick={onResume} disabled={resuming}>
          {resuming ? "Continuando…" : "Continuar"}
        </button>
        <button type="button" className={styles.button} onClick={onStop} disabled={resuming}>
          Parar aqui
        </button>
      </div>
    </section>
  );
}

interface CostLineProps {
  status: RunStatus;
  chargedCents: number | null;
  estimateCents: number | null;
}

/** Quanto o time já gastou (enquanto trabalha) ou quanto custou (no fim). */
function CostLine({ status, chargedCents, estimateCents }: CostLineProps) {
  if (chargedCents === null) return null;
  const spent = formatBRL(chargedCents);
  let text: string;
  switch (status) {
    case "running":
    case "paused":
    case "interrupted":
      text =
        `Gasto até agora: ${spent}` +
        (estimateCents === null ? "." : ` (reservado ao começar: até ${formatBRL(estimateCents)}).`);
      break;
    case "finished":
      text = `Custou ${spent}. O que sobrou da reserva voltou para o saldo da empresa.`;
      break;
    case "failed":
    case "cancelled":
      text = `Custou ${spent}, só pelas etapas concluídas. O resto da reserva voltou para o saldo da empresa.`;
      break;
  }
  return <p className={styles.cost}>{text}</p>;
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
    case "paused":
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
  if (run.status === "paused") {
    return `${TITLES.paused}. O custo vai passar do que foi reservado. Escolha entre continuar e parar aqui.`;
  }
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

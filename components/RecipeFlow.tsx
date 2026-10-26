"use client";

// Uma receita na tela, do começo ao fim: montar o time, acompanhar o time trabalhando ao vivo
// depois de "Começar" e, quando o site fica pronto, a tela de resultado.
//
// Desde a execução persistida, "Começar" só CRIA a execução no servidor (que roda sozinha, em partes).
// A tela acompanha pelo id: guarda ?run=<id> no endereço (dá para recarregar e continuar vendo),
// busca o plano e o status, e busca as novidades a cada segundo (com replay do que já passou). Sair da página
// e voltar NÃO interrompe o time: ele roda no servidor de qualquer jeito.
// Começar, cancelar e continuar levam o id de quem abriu a página (memberId): se o login do navegador mudou em outra
// aba, o servidor não faz nada e a tela mostra o aviso que ele mandou (F34).
// O custo acompanha a execução: a estimativa reservada ao começar e quanto o time já gastou (o servidor manda junto
// com as novidades). Se o custo for passar do reservado, o time pausa e a tela pergunta se continua.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProviderId } from "@/lib/providers/types";
import type { ScreenStage } from "@/lib/recipes/screen";
import { forgetActiveRun, recallActiveRun, rememberActiveRun } from "@/lib/runs/active-run";
import { cancelRun, readProblems, resumeRun, startRun, SERVER_PROBLEM } from "@/lib/runs/client";
import type { StepCost } from "@/lib/runs/estimate";
import { subscribeRun, type LostReason } from "@/lib/runs/live-client";
import type { PublicPlannedStage } from "@/lib/runs/public-events";
import {
  createRunState,
  finishedSite,
  runReducer,
  type PlannedStageView,
  type RunAction,
  type RunState,
} from "./run-state";
import { RunProgress } from "./RunProgress";
import { RunResult } from "./RunResult";
import { TeamBuilder, type Team, type TeamRole } from "./TeamBuilder";
import styles from "./RecipeFlow.module.css";

/** Uma fase agrupando as suas etapas, do jeito que a tela recebe (lib/recipes/screen.ts). */
type FlowStage = ScreenStage;

/** O resumo que GET /api/runs/[id] devolve: o pedido, status, plano, o custo e, se terminou, o resultado. */
interface RunInfo {
  request?: string;
  status?: string;
  plan?: PublicPlannedStage[];
  result?: string | null;
  durationMs?: number | null;
  estimateCents?: number | null;
  chargedCents?: number;
}

/** O custo da execução acompanhada: o reservado ao começar e o já gasto, em centavos (null enquanto não se sabe). */
interface RunCost {
  estimateCents: number | null;
  chargedCents: number | null;
}

const UNKNOWN_COST: RunCost = { estimateCents: null, chargedCents: null };

interface RecipeFlowProps {
  /** Quem abriu a página (o id no banco), para o servidor conferir que o login não mudou. */
  memberId: string;
  recipeId: string;
  recipeName: string;
  roles: TeamRole[];
  stages: FlowStage[];
  /** O custo máximo de cada etapa com cada IA, calculado no servidor, para a estimativa da tela de montar o time. */
  stepCosts: StepCost[];
  requestPlaceholder: string;
  /** Avisado quando o gasto da execução acompanhada muda: o espaço de trabalho atualiza o "Gasto do mês". */
  onSpendingChange?: () => void;
}

/** O que a tela diz quando não dá mais para acompanhar a execução. O time continua no servidor de qualquer jeito. */
const LOST_NOTICES: Record<LostReason, string> = {
  "signed-out":
    "A sua conta não está mais conectada neste navegador (ela pode ter saído em outra aba). Entre de novo para " +
    "continuar acompanhando. O time continua trabalhando.",
  "not-found":
    "Não dá para continuar acompanhando aqui: neste navegador, outra conta entrou (as abas do navegador dividem o " +
    "mesmo login). Clique em Sair, no topo, e entre de novo com a sua conta. O time continua trabalhando.",
};

export function RecipeFlow({
  memberId,
  recipeId,
  recipeName,
  roles,
  stages,
  stepCosts,
  requestPlaceholder,
  onSpendingChange,
}: RecipeFlowProps) {
  const [team, setTeam] = useState<Team>(() =>
    Object.fromEntries(roles.map((role) => [role.id, role.suggestedProvider])),
  );
  const [request, setRequest] = useState("");
  const [starting, setStarting] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [run, setRun] = useState<RunState | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cost, setCost] = useState<RunCost>(UNKNOWN_COST);
  const [resuming, setResuming] = useState(false);
  // Desliga a busca de novidades da execução atual. Trocado a cada nova execução acompanhada.
  const unsubscribeRef = useRef<(() => void) | null>(null);
  // Marca qual execução a tela acompanha agora: callbacks de uma execução antiga são ignorados.
  const trackingRef = useRef<symbol | null>(null);
  // Guardado numa ref: quem avisa pode trocar de função sem reiniciar o acompanhamento.
  const onSpendingChangeRef = useRef(onSpendingChange);

  useEffect(() => {
    onSpendingChangeRef.current = onSpendingChange;
  });

  // O time cobrou mais uma etapa (ou a execução parou): o gasto do mês mudou.
  useEffect(() => {
    if (cost.chargedCents !== null) onSpendingChangeRef.current?.();
  }, [cost.chargedCents]);

  // Começa a acompanhar uma execução pelo id: busca o plano e o status, e escuta os eventos ao vivo.
  // A mudança de tela (setState) só acontece DEPOIS da busca, nunca de forma síncrona (evita renders em cascata).
  // `silent`: retomada automática (pelo id guardado no navegador). Se a execução já não existe no servidor,
  // esquece o id sem mostrar erro — a pessoa simplesmente vê a tela de montar o time.
  const track = useCallback(
    async (id: string, { silent = false }: { silent?: boolean } = {}) => {
      const token = Symbol(id);
      trackingRef.current = token;
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;

      let info: RunInfo | null = null;
      let refusal: string[] = [SERVER_PROBLEM];
      try {
        const response = await fetch(`/api/runs/${id}`, { cache: "no-store" });
        if (response.ok) {
          const data: unknown = await response.json();
          if (data && typeof data === "object") info = data as RunInfo;
        } else {
          refusal = await readProblems(response);
        }
      } catch {
        // Sem o resumo agora: trata como problema abaixo.
      }
      // A tela pode ter trocado de execução enquanto buscávamos (ex.: "Começar de novo").
      if (trackingRef.current !== token) return;
      const plan = info?.plan ?? null;
      if (!plan) {
        if (silent) forgetActiveRun(recipeId);
        else setProblems(refusal);
        return;
      }

      // Guarda o id no endereço E no navegador: trocar de aba e voltar retoma este mesmo projeto.
      rememberActiveRun(recipeId, id);
      writeRunParam(id);
      setRunId(id);
      // Voltando a uma execução (recarregou, ou voltou a uma pausa mais tarde), o pedido vem do servidor.
      if (typeof info?.request === "string") setRequest(info.request);
      setCost({ estimateCents: info?.estimateCents ?? null, chargedCents: info?.chargedCents ?? null });

      // Execução JÁ terminada: monta o estado final direto do resumo, sem reviver os eventos.
      // Uma execução longa com IAs reais gera MILHARES de eventos (texto token a token); reviver tudo
      // é lento e pode nem chegar ao fim. Como o resultado já está salvo, mostramos ele na hora.
      if (info?.status === "finished" && typeof info.result === "string") {
        const finished = runReducer(buildRunState(stages, plan), {
          type: "event",
          event: { type: "run-finished", result: info.result, durationMs: info.durationMs ?? 0 },
        });
        setRun(finished);
        return; // Nada a assinar: o estado final já está pronto.
      }

      setRun(buildRunState(stages, plan));
      const apply = (action: RunAction) => {
        if (trackingRef.current === token) setRun((current) => current && runReducer(current, action));
      };
      unsubscribeRef.current = subscribeRun(id, {
        onEvent: (event) => apply({ type: "event", event }),
        onCharged: (chargedCents) => {
          if (trackingRef.current === token) setCost((current) => ({ ...current, chargedCents }));
        },
        onLost: (reason) => {
          if (trackingRef.current === token) setNotice(LOST_NOTICES[reason]);
        },
      });
    },
    [recipeId, stages],
  );

  // Ao abrir a página, retoma o acompanhamento: primeiro pelo ?run=<id> do endereço, senão pelo id
  // guardado no navegador (que sobrevive à troca de abas). Ao sair, desliga a escuta.
  // O acompanhamento começa fora do fluxo síncrono do efeito (evita renders em cascata).
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("run");
    const stored = fromUrl ? null : recallActiveRun(recipeId);
    const existing = fromUrl ?? stored;
    if (existing) queueMicrotask(() => void track(existing, { silent: Boolean(stored) }));
    return () => {
      trackingRef.current = null;
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [track, recipeId]);

  async function handleStart(chosenTeam: Team, chosenRequest: string) {
    setTeam(chosenTeam);
    setRequest(chosenRequest);
    setProblems([]);
    setNotice(null);

    setStarting(true);
    const start = await startRun({ recipeId, request: chosenRequest, team: chosenTeam, pageMemberId: memberId });
    setStarting(false);
    if (!start.ok) {
      setProblems(start.problems);
      return;
    }

    // `track` guarda o id no endereço e no navegador e começa a acompanhar.
    void track(start.runId);
  }

  async function handleCancel() {
    const id = runId;
    if (!id) return;
    // Só marca como cancelado depois que o servidor confirma: se o login mudou, o time continua e a tela avisa.
    const cancel = await cancelRun(id, memberId);
    if (!cancel.ok) {
      setNotice(cancel.problems.join(" "));
      return;
    }
    setNotice(null);
    setRun((current) => current && runReducer(current, { type: "cancel" }));
    trackingRef.current = null;
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    // A busca de novidades parou: pergunta uma última vez quanto custou (só as etapas concluídas).
    const chargedCents = await fetchChargedCents(id);
    if (chargedCents !== null) setCost((current) => ({ ...current, chargedCents }));
  }

  // "Continuar" numa pausa: o servidor reserva o que falta. Deu certo, a narração traz o time de volta ao trabalho;
  // recusou (sem saldo, teto do mês), a tela mostra o que fazer e a execução continua pausada.
  async function handleResume() {
    const id = runId;
    if (!id) return;
    setResuming(true);
    const resume = await resumeRun(id, memberId);
    setResuming(false);
    setNotice(resume.ok ? null : resume.problems.join(" "));
  }

  function handleRestart() {
    trackingRef.current = null;
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    setRun(null);
    setRunId(null);
    setNotice(null);
    setCost(UNKNOWN_COST);
    forgetActiveRun(recipeId);
    clearRunParam();
  }

  if (run) {
    const site = finishedSite(run);
    if (site !== null) {
      return (
        <RunResult
          request={request}
          run={run}
          site={site}
          chargedCents={cost.chargedCents}
          onRestart={handleRestart}
        />
      );
    }
    return (
      <RunProgress
        recipeName={recipeName}
        request={request}
        run={run}
        notice={notice}
        chargedCents={cost.chargedCents}
        estimateCents={cost.estimateCents}
        resuming={resuming}
        onCancel={handleCancel}
        onResume={handleResume}
        onRestart={handleRestart}
      />
    );
  }

  return (
    <div className={styles.flow}>
      <section className={styles.intro}>
        <h2 className={styles.title}>{recipeName}</h2>
        <p className={styles.lead}>
          Este é o time que recomendamos. Cada IA tem um papel; troque qualquer uma se preferir.
        </p>
      </section>

      <TeamBuilder
        roles={roles}
        stepCosts={stepCosts}
        requestPlaceholder={requestPlaceholder}
        initialTeam={team}
        initialRequest={request}
        starting={starting}
        problems={problems}
        onStart={handleStart}
      />
    </div>
  );
}

/** Monta o estado inicial da tela juntando os dados de cada etapa (locais) com a IA decidida (do plano do servidor). */
function buildRunState(stages: FlowStage[], plan: PublicPlannedStage[]): RunState {
  const providerOf = new Map<string, ProviderId>();
  for (const stage of plan) {
    for (const step of stage.steps) providerOf.set(step.stepId, step.provider);
  }
  const planned: PlannedStageView[] = stages.map((stage) => ({
    id: stage.id,
    kind: stage.kind,
    steps: stage.steps.map((step) => ({ ...step, provider: providerOf.get(step.id) ?? "claude" })),
  }));
  return createRunState(planned);
}

/** Quanto a execução custou até agora, pelo resumo do servidor. Sem resposta, null (a tela fica com o que já sabia). */
async function fetchChargedCents(id: string): Promise<number | null> {
  try {
    const response = await fetch(`/api/runs/${id}`, { cache: "no-store" });
    if (!response.ok) return null;
    const info = (await response.json()) as RunInfo;
    return typeof info.chargedCents === "number" ? info.chargedCents : null;
  } catch {
    return null;
  }
}

/** Guarda ?run=<id> no endereço, sem recarregar a página: dá para recarregar e continuar acompanhando. */
function writeRunParam(id: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set("run", id);
  window.history.replaceState(null, "", url.toString());
}

/** Tira o ?run=<id> do endereço ao voltar para a tela de montar o time. */
function clearRunParam(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("run");
  window.history.replaceState(null, "", url.toString());
}

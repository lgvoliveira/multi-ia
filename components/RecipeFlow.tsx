"use client";

// Uma receita na tela, do começo ao fim: montar o time, acompanhar o time trabalhando ao vivo
// depois de "Começar" e, quando o site fica pronto, a tela de resultado.
//
// Desde a execução persistida, "Começar" só CRIA a execução no servidor (que roda sozinha, em partes).
// A tela acompanha pelo id: guarda ?run=<id> no endereço (dá para recarregar e continuar vendo),
// busca o plano e o status, e escuta os eventos ao vivo (com replay do que já passou). Sair da página
// e voltar NÃO interrompe o time: ele roda no servidor de qualquer jeito.

import { useCallback, useEffect, useRef, useState } from "react";
import { readConnectedKeys } from "@/lib/keys/store";
import { getProviderInfo } from "@/lib/providers/catalog";
import type { ProviderId } from "@/lib/providers/types";
import type { StageKind, Step } from "@/lib/recipes/types";
import { forgetActiveRun, recallActiveRun, rememberActiveRun } from "@/lib/runs/active-run";
import { startRun, SERVER_PROBLEM } from "@/lib/runs/client";
import { subscribeRun } from "@/lib/runs/live-client";
import { getOwnerToken } from "@/lib/runs/owner";
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

/** O que a tela precisa de cada etapa. As instruções das IAs ficam no servidor. */
export type FlowStep = Pick<Step, "id" | "roleId" | "name" | "summary" | "doneSummary" | "format"> & {
  stageId: string;
};

/** Uma fase agrupando as suas etapas, do jeito que a tela recebe. */
export interface FlowStage {
  id: string;
  kind: StageKind;
  steps: FlowStep[];
}

/** O resumo que GET /api/runs/[id] devolve: status, plano e, se terminou, o resultado. */
interface RunInfo {
  status?: string;
  plan?: PublicPlannedStage[];
  result?: string | null;
  durationMs?: number | null;
}

interface RecipeFlowProps {
  recipeId: string;
  recipeName: string;
  roles: TeamRole[];
  stages: FlowStage[];
  requestPlaceholder: string;
}

export function RecipeFlow({ recipeId, recipeName, roles, stages, requestPlaceholder }: RecipeFlowProps) {
  const [team, setTeam] = useState<Team>(() =>
    Object.fromEntries(roles.map((role) => [role.id, role.suggestedProvider])),
  );
  const [request, setRequest] = useState("");
  const [starting, setStarting] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [run, setRun] = useState<RunState | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  // Desliga a escuta da execução atual (canal em tempo real e pesca). Trocado a cada nova execução acompanhada.
  const unsubscribeRef = useRef<(() => void) | null>(null);
  // Marca qual execução a tela acompanha agora: callbacks de uma execução antiga são ignorados.
  const trackingRef = useRef<symbol | null>(null);

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
      try {
        const response = await fetch(`/api/runs/${id}`, { cache: "no-store" });
        if (response.ok) {
          const data: unknown = await response.json();
          if (data && typeof data === "object") info = data as RunInfo;
        }
      } catch {
        // Sem o resumo agora: trata como problema abaixo.
      }
      // A tela pode ter trocado de execução enquanto buscávamos (ex.: "Começar de novo").
      if (trackingRef.current !== token) return;
      const plan = info?.plan ?? null;
      if (!plan) {
        if (silent) forgetActiveRun(recipeId);
        else setProblems([SERVER_PROBLEM]);
        return;
      }

      // Guarda o id no endereço E no navegador: trocar de aba e voltar retoma este mesmo projeto.
      rememberActiveRun(recipeId, id);
      writeRunParam(id);
      setRunId(id);

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
        // A falha agora vem do status do servidor; o evento run-failed (replay) já encerra a tela.
        onStatus: () => {},
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

    // Sem a chave da IA, o agente daquele papel não roda: avisa quais IAs faltam conectar.
    const keys = readConnectedKeys();
    const needed = [...new Set(Object.values(chosenTeam))] as ProviderId[];
    const missing = needed.filter((provider) => !keys[provider]);
    if (missing.length > 0) {
      const names = missing.map((provider) => getProviderInfo(provider).name).join(", ");
      setProblems([
        `Impossível rodar: conecte a chave de ${names} na aba "Minhas chaves de API". ` +
          "Cada agente só trabalha com a chave da sua IA.",
      ]);
      return;
    }

    setStarting(true);
    const ownerToken = getOwnerToken();
    const start = await startRun({ recipeId, request: chosenRequest, team: chosenTeam, keys, ownerToken });
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
    // Mostra o cancelamento na hora; o servidor confirma e a corrente de segmentos para sozinha.
    setRun((current) => current && runReducer(current, { type: "cancel" }));
    trackingRef.current = null;
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    if (!id) return;
    try {
      await fetch(`/api/runs/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerToken: getOwnerToken() }),
      });
    } catch {
      // Sem internet: a execução no servidor segue; o usuário pode tentar de novo.
    }
  }

  function handleRestart() {
    trackingRef.current = null;
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    setRun(null);
    setRunId(null);
    forgetActiveRun(recipeId);
    clearRunParam();
  }

  if (run) {
    const site = finishedSite(run);
    if (site !== null) {
      return <RunResult request={request} run={run} site={site} onRestart={handleRestart} />;
    }
    return (
      <RunProgress
        recipeName={recipeName}
        request={request}
        run={run}
        onCancel={handleCancel}
        onRestart={handleRestart}
      />
    );
  }

  return (
    <div className={styles.flow}>
      <section className={styles.intro}>
        <h1 className={styles.title}>{recipeName}</h1>
        <p className={styles.lead}>
          Este é o time que recomendamos. Cada IA tem um papel; troque qualquer uma se preferir.
        </p>
      </section>

      <TeamBuilder
        roles={roles}
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

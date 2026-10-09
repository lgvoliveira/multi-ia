"use client";

// Uma receita na tela, do começo ao fim: montar o time e, depois de "Começar",
// acompanhar o time trabalhando ao vivo. (A tela de resultado entra aqui na T7.)

import { useEffect, useRef, useState } from "react";
import type { Step } from "@/lib/recipes/types";
import { startRun } from "@/lib/runs/client";
import { createRunState, runReducer, type RunAction, type RunState } from "./run-state";
import { RunProgress } from "./RunProgress";
import { TeamBuilder, type Team, type TeamRole } from "./TeamBuilder";
import styles from "./RecipeFlow.module.css";

/** O que a tela precisa de cada etapa. As instruções das IAs ficam no servidor. */
export type FlowStep = Pick<Step, "id" | "roleId" | "name" | "summary" | "format">;

interface RecipeFlowProps {
  recipeId: string;
  recipeName: string;
  roles: TeamRole[];
  steps: FlowStep[];
  requestPlaceholder: string;
}

export function RecipeFlow({ recipeId, recipeName, roles, steps, requestPlaceholder }: RecipeFlowProps) {
  const [team, setTeam] = useState<Team>(() =>
    Object.fromEntries(roles.map((role) => [role.id, role.suggestedProvider])),
  );
  const [request, setRequest] = useState("");
  const [starting, setStarting] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [run, setRun] = useState<RunState | null>(null);
  // O "botão de parar" da execução atual: cancela a conexão, e o servidor manda as IAs pararem.
  const stopRef = useRef<AbortController | null>(null);

  // Saiu desta página no meio (ex.: clicou em "Receitas"): as IAs param.
  useEffect(() => () => stopRef.current?.abort(), []);

  async function handleStart(chosenTeam: Team, chosenRequest: string) {
    setTeam(chosenTeam);
    setRequest(chosenRequest);
    setProblems([]);
    setStarting(true);
    const stop = new AbortController();
    stopRef.current = stop;
    // Só mexe na tela se esta ainda for a execução atual (e não uma antiga, de antes de "Começar de novo").
    const apply = (action: RunAction) => {
      if (stopRef.current === stop) setRun((current) => current && runReducer(current, action));
    };

    const start = await startRun(
      { recipeId, request: chosenRequest, team: chosenTeam },
      { signal: stop.signal },
    );
    setStarting(false);
    if (!start.ok) {
      setProblems(start.problems);
      return;
    }

    setRun(createRunState(steps.map((step) => ({ ...step, provider: chosenTeam[step.roleId] }))));
    try {
      for await (const event of start.events) apply({ type: "event", event });
      apply({ type: "stream-ended" });
    } catch {
      apply(stop.signal.aborted ? { type: "cancel" } : { type: "stream-ended" });
    }
  }

  function handleCancel() {
    stopRef.current?.abort();
    setRun((current) => current && runReducer(current, { type: "cancel" }));
  }

  if (run) {
    return (
      <RunProgress
        recipeName={recipeName}
        request={request}
        run={run}
        onCancel={handleCancel}
        onRestart={() => setRun(null)}
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

"use client";

// A prateleira de agentes prontos, no alto da aba Receitas: os agentes organizados por área (ex.: TI tem agentes devs).
// "Conversar" abre o chat já ligado àquele agente (onStart). A persona de cada um fica no servidor; aqui só o catálogo.

import { AGENT_AREAS } from "@/lib/ock/agents";
import styles from "./WorkspaceAgents.module.css";

export function WorkspaceAgents({ onStart }: { onStart: (agentId: string) => void }) {
  return (
    <section className={styles.shelf} aria-labelledby="agents-title">
      <div className={styles.intro}>
        <h2 id="agents-title" className={styles.title}>
          Agentes prontos
        </h2>
        <p className={styles.lead}>
          Assistentes de IA já montados para uma função. Escolha um por área e converse com ele no chat — cada um responde
          no personagem dele, do jeito daquele trabalho.
        </p>
      </div>

      {AGENT_AREAS.map((area) => (
        <div key={area.id} className={styles.area}>
          <div className={styles.areaHead}>
            <h3 className={styles.areaName}>{area.name}</h3>
            <p className={styles.areaBlurb}>{area.blurb}</p>
          </div>
          <div className={styles.grid}>
            {area.agents.map((agent) => (
              <article key={agent.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={styles.avatar} aria-hidden="true">
                    {agent.name.slice(0, 1)}
                  </span>
                  <div className={styles.who}>
                    <p className={styles.cardName}>{agent.name}</p>
                    <p className={styles.cardRole}>{agent.role}</p>
                  </div>
                </div>
                <p className={styles.tagline}>{agent.tagline}</p>
                <button
                  type="button"
                  className={styles.action}
                  onClick={() => onStart(agent.id)}
                  aria-label={`Conversar com ${agent.name}, ${agent.role}`}
                >
                  Conversar
                </button>
              </article>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

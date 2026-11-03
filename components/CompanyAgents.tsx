"use client";

// A parte "Agentes da empresa" do painel do dono (Fase 2): a lista dos agentes que a empresa criou (com apagar) e o
// formulário para criar um novo (nome, função, chamada do cartão, como ele age, o que ele sempre sabe e perguntas de
// partida). Quem confere e grava é o servidor (app/dono/actions.ts); a persona e o conhecimento nunca voltam para cá.

import { useActionState, useState } from "react";
import { createAgentAction, deleteAgentAction } from "@/app/dono/actions";
import {
  AGENT_KNOWLEDGE_MAX,
  AGENT_NAME_MAX,
  AGENT_PERSONA_MAX,
  AGENT_ROLE_MAX,
  AGENT_STARTERS_MAX,
  AGENT_TAGLINE_MAX,
  type AgentField,
  type CompanyAgentCard,
  type CompanyAgentState,
} from "@/lib/ock/agent-forms";
import { PAGE_OWNER_FIELD, type MemberActionState } from "@/lib/ock/team-forms";
import styles from "./CompanyAgents.module.css";
import forms from "./TeamForms.module.css";

const INITIAL: CompanyAgentState = { status: "idle" };
const IDLE: MemberActionState = { status: "idle" };

export function CompanyAgents({ ownerId, agents }: { ownerId: string; agents: CompanyAgentCard[] }) {
  return (
    <div className={styles.wrap}>
      {agents.length > 0 && (
        <ul className={styles.list}>
          {agents.map((agent) => (
            <AgentItem key={agent.id} ownerId={ownerId} agent={agent} />
          ))}
        </ul>
      )}
      <CreateAgent ownerId={ownerId} />
    </div>
  );
}

function AgentItem({ ownerId, agent }: { ownerId: string; agent: CompanyAgentCard }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(deleteAgentAction, IDLE);

  return (
    <li className={styles.agent}>
      <div className={styles.agentMain}>
        <p className={styles.agentName}>
          {agent.name} <span className={styles.agentRole}>· {agent.role}</span>
        </p>
        <p className={styles.agentTagline}>{agent.tagline}</p>
        {agent.starters.length > 0 && (
          <p className={styles.agentStarters}>
            {agent.starters.length} pergunta{agent.starters.length > 1 ? "s" : ""} de partida
          </p>
        )}
      </div>
      {confirming ? (
        <form action={formAction} className={forms.inlineForm}>
          <input type="hidden" name="agentId" value={agent.id} />
          <input type="hidden" name={PAGE_OWNER_FIELD} value={ownerId} />
          <p className={forms.confirmText}>Apagar {agent.name}? A equipe deixa de ver este agente.</p>
          {state.status === "error" && (
            <p className={forms.error} role="alert">
              {state.message}
            </p>
          )}
          <div className={forms.buttons}>
            <button type="submit" className={forms.smallDanger} disabled={pending}>
              {pending ? "Apagando…" : "Apagar"}
            </button>
            <button type="button" className={forms.smallButton} onClick={() => setConfirming(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className={forms.smallButton} onClick={() => setConfirming(true)}>
          Apagar
        </button>
      )}
    </li>
  );
}

/** Depois de criar um agente, "Criar outro agente" recomeça o formulário do zero. */
function CreateAgent({ ownerId }: { ownerId: string }) {
  const [round, setRound] = useState(0);
  return <AgentForm key={round} ownerId={ownerId} onAnother={() => setRound((n) => n + 1)} />;
}

function AgentForm({ ownerId, onAnother }: { ownerId: string; onAnother: () => void }) {
  const [state, formAction, pending] = useActionState(createAgentAction, INITIAL);

  if (state.status === "created") {
    return (
      <div className={forms.stack}>
        <p className={styles.created}>
          Agente <strong>{state.card.name}</strong> criado! Já aparece na aba Receitas da equipe.
        </p>
        <button type="button" className={forms.secondaryButton} onClick={onAnother}>
          Criar outro agente
        </button>
      </div>
    );
  }

  const errors = state.status === "invalid" ? state.errors : {};
  const values = state.status === "invalid" || state.status === "error" ? state.values : undefined;

  function errorFor(field: AgentField) {
    const error = errors[field];
    return error ? (
      <p id={`agent-${field}-error`} className={forms.fieldError}>
        {error}
      </p>
    ) : null;
  }
  function described(field: AgentField, hintId?: string) {
    return errors[field] ? `agent-${field}-error` : hintId;
  }

  return (
    <form className={forms.inviteForm} action={formAction} noValidate>
      <input type="hidden" name={PAGE_OWNER_FIELD} value={ownerId} />
      <div className={forms.fields}>
        <div className={forms.field}>
          <label htmlFor="agent-name" className={forms.label}>
            Nome
          </label>
          <input
            id="agent-name"
            name="name"
            className={forms.input}
            type="text"
            autoComplete="off"
            maxLength={AGENT_NAME_MAX}
            defaultValue={values?.name}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={described("name", "agent-name-hint")}
          />
          {errorFor("name") ?? (
            <p id="agent-name-hint" className={forms.hint}>
              Um apelido, ex.: Clara.
            </p>
          )}
        </div>

        <div className={forms.field}>
          <label htmlFor="agent-role" className={forms.label}>
            Função
          </label>
          <input
            id="agent-role"
            name="role"
            className={forms.input}
            type="text"
            autoComplete="off"
            maxLength={AGENT_ROLE_MAX}
            defaultValue={values?.role}
            aria-invalid={errors.role ? true : undefined}
            aria-describedby={described("role", "agent-role-hint")}
          />
          {errorFor("role") ?? (
            <p id="agent-role-hint" className={forms.hint}>
              Ex.: Atendimento ao cliente.
            </p>
          )}
        </div>
      </div>

      <div className={forms.field}>
        <label htmlFor="agent-tagline" className={forms.label}>
          Uma linha do que ele faz
        </label>
        <input
          id="agent-tagline"
          name="tagline"
          className={forms.input}
          type="text"
          autoComplete="off"
          maxLength={AGENT_TAGLINE_MAX}
          defaultValue={values?.tagline}
          aria-invalid={errors.tagline ? true : undefined}
          aria-describedby={described("tagline", "agent-tagline-hint")}
        />
        {errorFor("tagline") ?? (
          <p id="agent-tagline-hint" className={forms.hint}>
            Aparece no cartão do agente, na aba Receitas.
          </p>
        )}
      </div>

      <div className={forms.field}>
        <label htmlFor="agent-persona" className={forms.label}>
          Como ele deve agir e falar
        </label>
        <textarea
          id="agent-persona"
          name="persona"
          className={styles.textarea}
          rows={4}
          maxLength={AGENT_PERSONA_MAX}
          defaultValue={values?.persona}
          aria-invalid={errors.persona ? true : undefined}
          aria-describedby={described("persona", "agent-persona-hint")}
        />
        {errorFor("persona") ?? (
          <p id="agent-persona-hint" className={forms.hint}>
            As instruções do agente. Ex.: “Você é do suporte da Loja X. Responda com calma e resolva o problema.”
          </p>
        )}
      </div>

      <div className={forms.field}>
        <label htmlFor="agent-knowledge" className={forms.label}>
          O que ele sempre deve saber (opcional)
        </label>
        <textarea
          id="agent-knowledge"
          name="knowledge"
          className={styles.textarea}
          rows={4}
          maxLength={AGENT_KNOWLEDGE_MAX}
          defaultValue={values?.knowledge}
          aria-invalid={errors.knowledge ? true : undefined}
          aria-describedby={described("knowledge", "agent-knowledge-hint")}
        />
        {errorFor("knowledge") ?? (
          <p id="agent-knowledge-hint" className={forms.hint}>
            Informações da empresa que o agente deve ter sempre à mão (preços, horários, políticas…).
          </p>
        )}
      </div>

      <div className={forms.field}>
        <label htmlFor="agent-starters" className={forms.label}>
          Perguntas de partida (opcional)
        </label>
        <textarea
          id="agent-starters"
          name="starters"
          className={styles.textarea}
          rows={3}
          defaultValue={values?.starters}
          aria-describedby="agent-starters-hint"
        />
        <p id="agent-starters-hint" className={forms.hint}>
          Uma por linha (até {AGENT_STARTERS_MAX}). Aparecem como atalhos quando a equipe abre o agente.
        </p>
      </div>

      {state.status === "error" && (
        <p className={forms.error} role="alert">
          {state.message}
        </p>
      )}

      <button type="submit" className={forms.primaryButton} disabled={pending}>
        {pending ? "Criando…" : "Criar agente"}
      </button>
    </form>
  );
}

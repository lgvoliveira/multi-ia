"use client";

// Tela "Montar o time": escolher a IA de cada papel e escrever o pedido.
// Roda no navegador porque reage na hora a cada troca de IA e a cada letra digitada.

import { useId, useRef, useState, type FormEvent } from "react";
import { MAX_REQUEST_CHARS } from "@/lib/engine/validate";
import { PROVIDERS, isProviderId } from "@/lib/providers/catalog";
import type { ProviderId } from "@/lib/providers/types";
import type { Role } from "@/lib/recipes/types";
import { AiDot } from "./AiDot";
import styles from "./TeamBuilder.module.css";

/** O que a tela precisa de cada papel. As instruções das IAs ficam no servidor. */
export type TeamRole = Pick<Role, "id" | "name" | "description" | "suggestedProvider">;

/** Tipos de agente que a pessoa pode acrescentar ao time, com a IA recomendada de cada um. */
const ADDABLE_AGENTS: readonly (TeamRole & { typeId: string })[] = [
  { typeId: "chief", id: "chief", name: "Chefe", description: "Entende o pedido, planeja, revisa e divide o trabalho", suggestedProvider: "claude" },
  { typeId: "researcher", id: "researcher", name: "Pesquisador", description: "Pesquisa ideias e conteúdos de referência", suggestedProvider: "gemini" },
  { typeId: "programmer", id: "programmer", name: "Programador", description: "Escreve o código do projeto", suggestedProvider: "gpt" },
];

/** Um agente que a pessoa acrescentou a mais do time base da receita. */
interface ExtraAgent {
  id: string;
  name: string;
  description: string;
  provider: ProviderId;
}

/** IA escolhida para cada papel (id do papel → IA). */
export type Team = Record<string, ProviderId>;

interface TeamBuilderProps {
  roles: TeamRole[];
  requestPlaceholder: string;
  /** Time e pedido com que a tela abre (ex.: ao voltar de uma execução para mudar algo). */
  initialTeam: Team;
  initialRequest: string;
  /** true enquanto o servidor ainda não respondeu: o botão fica travado. */
  starting: boolean;
  /** Problemas que o servidor apontou no último "Começar". */
  problems: string[];
  /** Chamado ao apertar "Começar" com o pedido escrito. */
  onStart: (team: Team, request: string) => void;
}

/** "editing": escrevendo; "empty": tentou começar sem pedido; "submitted": pedido enviado ao servidor. */
type FormStatus = "editing" | "empty" | "submitted";

const EMPTY_REQUEST = "Escreva o que você quer que o time faça.";

export function TeamBuilder({
  roles,
  requestPlaceholder,
  initialTeam,
  initialRequest,
  starting,
  problems,
  onStart,
}: TeamBuilderProps) {
  const [team, setTeam] = useState<Team>(initialTeam);
  const [request, setRequest] = useState(initialRequest);
  const [status, setStatus] = useState<FormStatus>("editing");
  // Agentes acrescentados pela pessoa, além do time base da receita.
  const [extraAgents, setExtraAgents] = useState<ExtraAgent[]>([]);
  const [choosingAgent, setChoosingAgent] = useState(false);
  const nextAgentId = useRef(1);
  const ids = useId();
  const requestId = `${ids}-request`;
  const hintId = `${ids}-hint`;
  const counterId = `${ids}-counter`;
  const errorId = `${ids}-error`;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (starting) return;
    if (!request.trim()) {
      setStatus("empty");
      return;
    }
    setStatus("submitted");
    onStart(team, request);
  }

  function addAgent(type: (typeof ADDABLE_AGENTS)[number]) {
    setExtraAgents((current) => [
      ...current,
      {
        id: `extra-${nextAgentId.current++}`,
        name: type.name,
        description: type.description,
        provider: type.suggestedProvider,
      },
    ]);
    setChoosingAgent(false);
    setStatus("editing");
  }

  function removeAgent(id: string) {
    setExtraAgents((current) => current.filter((agent) => agent.id !== id));
  }

  const atLimit = request.length >= MAX_REQUEST_CHARS;
  // Os problemas do servidor somem assim que a pessoa mexe no pedido ou no time.
  const errors = status === "empty" ? [EMPTY_REQUEST] : status === "submitted" ? problems : [];

  return (
    <form className={styles.layout} onSubmit={handleSubmit} noValidate>
      <section className={styles.team} aria-labelledby={`${ids}-team`}>
        <h2 id={`${ids}-team`} className={styles.sectionTitle}>
          Seu time
        </h2>
        <ol className={styles.roles}>
          {roles.map((role, index) => (
            <RoleCard
              key={role.id}
              role={role}
              position={index + 1}
              provider={team[role.id]}
              onChange={(provider) => {
                setTeam((current) => ({ ...current, [role.id]: provider }));
                setStatus("editing");
              }}
            />
          ))}
          {extraAgents.map((agent, index) => (
            <RoleCard
              key={agent.id}
              role={{
                id: agent.id,
                name: agent.name,
                description: agent.description,
                suggestedProvider: agent.provider,
              }}
              position={roles.length + index + 1}
              provider={agent.provider}
              onChange={(provider) => {
                setExtraAgents((current) =>
                  current.map((item) => (item.id === agent.id ? { ...item, provider } : item)),
                );
                setStatus("editing");
              }}
              onRemove={() => removeAgent(agent.id)}
            />
          ))}
        </ol>

        <div className={styles.addAgent}>
          {choosingAgent ? (
            <div className={styles.chooser} role="group" aria-label="Escolha o tipo de agente">
              {ADDABLE_AGENTS.map((type) => (
                <button
                  key={type.typeId}
                  type="button"
                  className={styles.chooserOption}
                  onClick={() => addAgent(type)}
                >
                  <AiDot provider={type.suggestedProvider} size="large" />
                  {type.name}
                </button>
              ))}
              <button
                type="button"
                className={styles.chooserCancel}
                onClick={() => setChoosingAgent(false)}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button type="button" className={styles.addButton} onClick={() => setChoosingAgent(true)}>
              + Adicionar agente
            </button>
          )}
          <p className={styles.addWarning}>
            Mais agentes deixam o desenvolvimento mais rápido, mas gastam mais tokens.
          </p>
        </div>
      </section>

      <section className={styles.request}>
        <label htmlFor={requestId} className={styles.requestLabel}>
          O que você quer?
        </label>
        <p id={hintId} className={styles.hint}>
          Escreva do seu jeito, em português. Quanto mais detalhes, melhor o resultado.
        </p>
        <textarea
          id={requestId}
          className={styles.textarea}
          rows={7}
          maxLength={MAX_REQUEST_CHARS}
          placeholder={requestPlaceholder}
          value={request}
          onChange={(event) => {
            setRequest(event.target.value);
            setStatus("editing");
          }}
          aria-invalid={status === "empty"}
          aria-describedby={[hintId, counterId, errors.length > 0 && errorId].filter(Boolean).join(" ")}
        />
        <p id={counterId} className={atLimit ? `${styles.counter} ${styles.counterAtLimit}` : styles.counter}>
          {formatNumber(request.length)}/{formatNumber(MAX_REQUEST_CHARS)} caracteres
          {atLimit && " · limite atingido"}
        </p>

        {errors.length > 0 && (
          <div id={errorId} className={styles.error} role="alert">
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        )}

        <button type="submit" className={styles.submit} disabled={starting}>
          {starting ? "Começando…" : "Começar"}
        </button>
      </section>
    </form>
  );
}

interface RoleCardProps {
  role: TeamRole;
  position: number;
  provider: ProviderId;
  onChange: (provider: ProviderId) => void;
  /** Só os agentes acrescentados pela pessoa podem ser removidos. */
  onRemove?: () => void;
}

function RoleCard({ role, position, provider, onChange, onRemove }: RoleCardProps) {
  const ids = useId();
  const nameId = `${ids}-name`;
  const labelId = `${ids}-label`;
  const selectId = `${ids}-select`;

  return (
    <li className={styles.role}>
      <span className={styles.position} aria-hidden="true">
        {position}
      </span>
      <div className={styles.roleInfo}>
        <span id={nameId} className={styles.roleName}>
          {role.name}
        </span>
        <span className={styles.roleDescription}>{role.description}</span>
      </div>
      <div className={styles.picker}>
        <label id={labelId} htmlFor={selectId} className={styles.pickerLabel}>
          IA
        </label>
        <div className={styles.pickerRow}>
          <AiDot provider={provider} size="large" />
          <select
            id={selectId}
            className={styles.select}
            value={provider}
            // O nome lido em voz alta fica "IA Chefe", e não só "IA", para cada papel.
            aria-labelledby={`${labelId} ${nameId}`}
            onChange={(event) => {
              if (isProviderId(event.target.value)) onChange(event.target.value);
            }}
          >
            {PROVIDERS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.id === role.suggestedProvider ? `${option.name} (recomendada)` : option.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {onRemove && (
        <button
          type="button"
          className={styles.removeAgent}
          onClick={onRemove}
          aria-label={`Remover agente ${role.name}`}
        >
          Remover
        </button>
      )}
    </li>
  );
}

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

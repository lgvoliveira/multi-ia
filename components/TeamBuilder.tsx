"use client";

// Tela "Montar o time": escolher a IA de cada papel e escrever o pedido, vendo o custo estimado.
// Roda no navegador porque reage na hora a cada troca de IA e a cada letra digitada.
// O custo estimado é o MÁXIMO que o time pode gastar (lib/runs/estimate.ts): a tela só soma os números que o servidor
// mandou. Ao começar, o servidor calcula de novo e reserva esse valor; no fim, cobra só o que o time usou.

import { useId, useState, type FormEvent } from "react";
import { MAX_REQUEST_CHARS } from "@/lib/engine/validate";
import { formatBRL } from "@/lib/ock/pricing";
import { PROVIDERS, isProviderId } from "@/lib/providers/catalog";
import type { ProviderId } from "@/lib/providers/types";
import type { Role } from "@/lib/recipes/types";
import { estimateCents, type StepCost } from "@/lib/runs/estimate";
import { AiDot } from "./AiDot";
import styles from "./TeamBuilder.module.css";

/** O que a tela precisa de cada papel. As instruções das IAs ficam no servidor. */
export type TeamRole = Pick<Role, "id" | "name" | "description" | "suggestedProvider">;

/** IA escolhida para cada papel (id do papel → IA). */
export type Team = Record<string, ProviderId>;

interface TeamBuilderProps {
  roles: TeamRole[];
  /** O custo máximo de cada etapa com cada IA, calculado no servidor. */
  stepCosts: StepCost[];
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
  stepCosts,
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
  const ids = useId();
  const requestId = `${ids}-request`;
  const hintId = `${ids}-hint`;
  const counterId = `${ids}-counter`;
  const errorId = `${ids}-error`;
  const estimateId = `${ids}-estimate`;

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

  const atLimit = request.length >= MAX_REQUEST_CHARS;
  // Os problemas do servidor somem assim que a pessoa mexe no pedido ou no time.
  const errors = status === "empty" ? [EMPTY_REQUEST] : status === "submitted" ? problems : [];

  return (
    <form className={styles.layout} onSubmit={handleSubmit} noValidate>
      <section className={styles.team} aria-labelledby={`${ids}-team`}>
        <h3 id={`${ids}-team`} className={styles.sectionTitle}>
          Seu time
        </h3>
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
        </ol>
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

        <button type="submit" className={styles.submit} disabled={starting} aria-describedby={estimateId}>
          {starting ? "Começando…" : "Começar"}
        </button>

        {/* Muda a cada troca de IA; quem usa leitor de tela ouve o valor novo. */}
        <div id={estimateId} className={styles.estimate} aria-live="polite">
          <p className={styles.estimateValue}>
            Custo estimado: <strong>até {formatBRL(estimateCents(stepCosts, team))}</strong>
          </p>
          <p className={styles.estimateNote}>
            Você paga só o que o time usar; o que sobrar volta para o saldo da empresa.
          </p>
        </div>
      </section>
    </form>
  );
}

interface RoleCardProps {
  role: TeamRole;
  position: number;
  provider: ProviderId;
  onChange: (provider: ProviderId) => void;
}

function RoleCard({ role, position, provider, onChange }: RoleCardProps) {
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
    </li>
  );
}

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

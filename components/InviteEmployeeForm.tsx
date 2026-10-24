"use client";

// Convidar um funcionário: o dono informa nome, e-mail e o teto do mês e recebe um link para mandar à pessoa.
// Quem confere tudo é o servidor (app/dono/actions.ts); aqui só aparecem os avisos que ele devolve.

import { useActionState, useState } from "react";
import { inviteEmployeeAction } from "@/app/dono/actions";
import { NAME_MAX_CHARS } from "@/lib/auth/forms";
import type { InviteField, InviteFormState } from "@/lib/ock/team-forms";
import { InviteLinkPanel } from "./InviteLinkPanel";
import styles from "./TeamForms.module.css";

const INITIAL: InviteFormState = { status: "idle" };

/** Depois de cada convite, "Convidar outra pessoa" recomeça o formulário do zero. */
export function InviteEmployee() {
  const [round, setRound] = useState(0);
  return <InviteEmployeeForm key={round} onAnother={() => setRound((n) => n + 1)} />;
}

function InviteEmployeeForm({ onAnother }: { onAnother: () => void }) {
  const [state, formAction, pending] = useActionState(inviteEmployeeAction, INITIAL);

  if (state.status === "created") {
    return (
      <div className={styles.stack}>
        <InviteLinkPanel name={state.name} link={state.link} kind="invite" />
        <button type="button" className={styles.secondaryButton} onClick={onAnother}>
          Convidar outra pessoa
        </button>
      </div>
    );
  }

  const errors = state.status === "invalid" ? state.errors : {};
  const values = state.status === "invalid" || state.status === "error" ? state.values : undefined;

  // Liga cada campo à sua mensagem (de erro ou de ajuda), para o leitor de tela ler as duas juntas.
  function fieldProps(field: InviteField, hintId?: string) {
    const error = errors[field];
    return {
      id: `invite-${field}`,
      name: field,
      className: styles.input,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `invite-${field}-error` : hintId,
    };
  }

  function fieldError(field: InviteField) {
    const error = errors[field];
    return error ? (
      <p id={`invite-${field}-error`} className={styles.fieldError}>
        {error}
      </p>
    ) : null;
  }

  return (
    <form className={styles.inviteForm} action={formAction} noValidate>
      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor="invite-name" className={styles.label}>
            Nome
          </label>
          <input
            {...fieldProps("name")}
            type="text"
            autoComplete="off"
            maxLength={NAME_MAX_CHARS}
            defaultValue={values?.name}
          />
          {fieldError("name")}
        </div>

        <div className={styles.field}>
          <label htmlFor="invite-email" className={styles.label}>
            E-mail
          </label>
          <input
            {...fieldProps("email", "invite-email-hint")}
            type="email"
            autoComplete="off"
            defaultValue={values?.email}
          />
          {fieldError("email") ?? (
            <p id="invite-email-hint" className={styles.hint}>
              É com ele que a pessoa vai entrar.
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="invite-budget" className={styles.label}>
            Teto do mês (R$)
          </label>
          <input
            {...fieldProps("budget", "invite-budget-hint")}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Ex.: 50,00"
            defaultValue={values?.budget}
          />
          {fieldError("budget") ?? (
            <p id="invite-budget-hint" className={styles.hint}>
              Vazio = sem teto. Renova todo dia 1º.
            </p>
          )}
        </div>
      </div>

      {state.status === "error" && (
        <p className={styles.error} role="alert">
          {state.message}
        </p>
      )}

      <button type="submit" className={styles.primaryButton} disabled={pending}>
        {pending ? "Gerando o convite…" : "Gerar o link do convite"}
      </button>
    </form>
  );
}

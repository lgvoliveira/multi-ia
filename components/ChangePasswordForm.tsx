"use client";

// Primeiro acesso: a pessoa entrou com a senha temporária e cria a própria aqui. Só o formulário; quem confere e grava
// é o servidor (app/trocar-senha/actions.ts). Ao dar certo, ele leva direto para o espaço de trabalho.

import { useActionState } from "react";
import { changePasswordAction } from "@/app/trocar-senha/actions";
import { PASSWORD_MIN_CHARS, type AcceptInviteState } from "@/lib/auth/forms";
import { firstName } from "@/lib/auth/member";
import styles from "./AuthForm.module.css";

const INITIAL: AcceptInviteState = { status: "idle" };

export function ChangePasswordForm({ name, email }: { name: string; email: string }) {
  const [state, formAction, pending] = useActionState(changePasswordAction, INITIAL);
  const errors = state.status === "invalid" ? state.errors : {};

  return (
    <main className={styles.main}>
      <form className={styles.card} action={formAction} noValidate aria-labelledby="change-title">
        <p className={styles.kicker}>Primeiro acesso</p>
        <h1 id="change-title" className={styles.title}>
          Olá, {firstName(name)}!
        </h1>
        <p className={styles.lead}>
          Você entrou com a senha temporária. Agora crie a sua própria senha para usar daqui para a frente.
        </p>

        <div className={styles.field}>
          <label htmlFor="email" className={styles.label}>
            Seu e-mail
          </label>
          <input
            id="email"
            className={styles.input}
            type="email"
            autoComplete="username"
            value={email}
            readOnly
            aria-describedby="email-hint"
          />
          <p id="email-hint" className={styles.hint}>
            É com ele e com a senha nova que você entra daqui para a frente.
          </p>
        </div>

        <div className={styles.field}>
          <label htmlFor="password" className={styles.label}>
            Crie uma senha
          </label>
          <input
            id="password"
            name="password"
            className={styles.input}
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "password-error" : "password-hint"}
          />
          {errors.password ? (
            <p id="password-error" className={styles.fieldError}>
              {errors.password}
            </p>
          ) : (
            <p id="password-hint" className={styles.hint}>
              Pelo menos {PASSWORD_MIN_CHARS} caracteres. Só você vai saber esta senha.
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="confirm" className={styles.label}>
            Repita a senha
          </label>
          <input
            id="confirm"
            name="confirm"
            className={styles.input}
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.confirm ? true : undefined}
            aria-describedby={errors.confirm ? "confirm-error" : undefined}
          />
          {errors.confirm && (
            <p id="confirm-error" className={styles.fieldError}>
              {errors.confirm}
            </p>
          )}
        </div>

        {state.status === "error" && (
          <p className={styles.error} role="alert">
            {state.message}
          </p>
        )}

        <button type="submit" className={styles.button} disabled={pending}>
          {pending ? "Salvando…" : "Salvar a senha e entrar"}
        </button>
      </form>
    </main>
  );
}

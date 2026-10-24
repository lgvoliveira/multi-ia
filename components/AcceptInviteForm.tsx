"use client";

// O funcionário abriu o link do convite: vê a empresa e o e-mail com que vai entrar, cria a própria senha e entra.
// O mesmo formulário serve para o link de senha nova. Quem confere tudo é o servidor (app/convite/actions.ts).

import { useActionState } from "react";
import { acceptInviteAction } from "@/app/convite/actions";
import { PASSWORD_MIN_CHARS, type AcceptInviteState } from "@/lib/auth/forms";
import { firstName } from "@/lib/auth/member";
import styles from "./AuthForm.module.css";

const INITIAL: AcceptInviteState = { status: "idle" };

interface AcceptInviteFormProps {
  token: string;
  kind: "invite" | "reset";
  name: string;
  email: string;
  companyName: string;
  /** Até quando o link vale, já escrito ("25/10, às 14:30"). */
  deadline: string;
  /** Nome de quem já está conectado neste navegador, se for outra pessoa (ex.: o dono testando o link). */
  signedInAs: string | null;
}

export function AcceptInviteForm({
  token,
  kind,
  name,
  email,
  companyName,
  deadline,
  signedInAs,
}: AcceptInviteFormProps) {
  const [state, formAction, pending] = useActionState(acceptInviteAction, INITIAL);
  const errors = state.status === "invalid" ? state.errors : {};
  const isInvite = kind === "invite";

  return (
    <main className={styles.main}>
      <form className={styles.card} action={formAction} noValidate aria-labelledby="invite-title">
        <p className={styles.kicker}>{isInvite ? "Convite para a equipe" : "Senha nova"}</p>
        <h1 id="invite-title" className={styles.title}>
          {companyName}
        </h1>
        <p className={styles.lead}>
          Olá, {firstName(name)}! {isInvite ? "Crie a sua senha para entrar na equipe." : "Crie uma senha nova para entrar."}
        </p>
        {signedInAs && (
          <p className={styles.notice}>
            Neste navegador, quem está conectado é {signedInAs}. Ao continuar, essa conta sai e você entra com a sua.
          </p>
        )}

        <input type="hidden" name="token" value={token} />

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
            É com ele e com a senha que você entra daqui para a frente.
          </p>
        </div>

        <div className={styles.field}>
          <label htmlFor="password" className={styles.label}>
            {isInvite ? "Crie uma senha" : "Senha nova"}
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
          {pending ? "Entrando…" : isInvite ? "Aceitar o convite e entrar" : "Salvar a senha e entrar"}
        </button>

        <p className={styles.footer}>Este link vale até {deadline} e funciona uma vez só.</p>
      </form>
    </main>
  );
}

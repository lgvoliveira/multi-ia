"use client";

// Entrar: uma tela só para o dono e o funcionário. Depois de entrar, cada um vai para a sua página.

import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "@/app/entrar/actions";
import type { SignInState } from "@/lib/auth/forms";
import styles from "./AuthForm.module.css";

const INITIAL: SignInState = { status: "idle" };

/** `notice`: aviso que vem de outra página (ex.: o link do e-mail de confirmação). */
export function SignInForm({ notice }: { notice?: string }) {
  const [state, formAction, pending] = useActionState(signIn, INITIAL);
  const errors = state.status === "invalid" ? state.errors : {};
  const email = state.status === "idle" ? undefined : state.values.email;

  return (
    <main className={styles.main}>
      <form className={styles.card} action={formAction} noValidate aria-labelledby="signin-title">
        <h1 id="signin-title" className={styles.title}>
          Entrar
        </h1>
        {notice && state.status === "idle" && <p className={styles.notice}>{notice}</p>}

        <div className={styles.field}>
          <label htmlFor="email" className={styles.label}>
            E-mail
          </label>
          <input
            id="email"
            name="email"
            className={styles.input}
            type="email"
            autoComplete="username"
            defaultValue={email}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && (
            <p id="email-error" className={styles.fieldError}>
              {errors.email}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="password" className={styles.label}>
            Senha
          </label>
          <input
            id="password"
            name="password"
            className={styles.input}
            type="password"
            autoComplete="current-password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "password-error" : undefined}
          />
          {errors.password && (
            <p id="password-error" className={styles.fieldError}>
              {errors.password}
            </p>
          )}
        </div>

        {state.status === "error" && (
          <p className={styles.error} role="alert">
            {state.message}
          </p>
        )}

        <button type="submit" className={styles.button} disabled={pending}>
          {pending ? "Entrando…" : "Entrar"}
        </button>

        <p className={styles.footer}>
          Funcionário: o acesso vem por um convite do dono da sua empresa.
          <br />
          Dono e ainda sem conta?{" "}
          <Link href="/cadastro" className={styles.link}>
            Criar a conta da empresa
          </Link>
        </p>
      </form>
    </main>
  );
}

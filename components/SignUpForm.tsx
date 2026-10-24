"use client";

// Cadastro da empresa: o dono cria a conta e recebe um e-mail para confirmar. Quem confere tudo é o servidor
// (app/cadastro/actions.ts); aqui só aparecem os avisos que ele devolve.

import Link from "next/link";
import { useActionState } from "react";
import { signUpCompany } from "@/app/cadastro/actions";
import type { SignUpField, SignUpState } from "@/lib/auth/forms";
import { NAME_MAX_CHARS, PASSWORD_MIN_CHARS } from "@/lib/auth/forms";
import styles from "./AuthForm.module.css";

const INITIAL: SignUpState = { status: "idle" };

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUpCompany, INITIAL);

  if (state.status === "check-email") {
    return (
      <main className={styles.main}>
        <section className={styles.card} aria-labelledby="check-email-title">
          <h1 id="check-email-title" className={styles.title}>
            Confira o seu e-mail
          </h1>
          <p className={styles.lead}>
            Mandamos um link para <strong>{state.email}</strong>. Abra a mensagem e clique no link para ativar a conta
            da empresa.
          </p>
          <p className={styles.hint}>Não chegou em alguns minutos? Veja a caixa de spam.</p>
          <p className={styles.footer}>
            Já confirmou?{" "}
            <Link href="/entrar" className={styles.link}>
              Entrar
            </Link>
          </p>
        </section>
      </main>
    );
  }

  const errors = state.status === "invalid" ? state.errors : {};
  const values = state.status === "invalid" || state.status === "error" ? state.values : {};

  // Liga cada campo à sua mensagem de erro, para o leitor de tela ler as duas juntas.
  function fieldProps(field: SignUpField) {
    const error = errors[field];
    return {
      id: field,
      name: field,
      className: styles.input,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `${field}-error` : undefined,
    };
  }

  function fieldError(field: SignUpField) {
    const error = errors[field];
    return error ? (
      <p id={`${field}-error`} className={styles.fieldError}>
        {error}
      </p>
    ) : null;
  }

  return (
    <main className={styles.main}>
      <form className={styles.card} action={formAction} noValidate aria-labelledby="signup-title">
        <h1 id="signup-title" className={styles.title}>
          Criar a conta da empresa
        </h1>
        <p className={styles.lead}>
          Você será o dono da conta. Depois, convida os funcionários e define o teto de gasto de cada um.
        </p>

        <div className={styles.field}>
          <label htmlFor="companyName" className={styles.label}>
            Nome da empresa
          </label>
          <input
            {...fieldProps("companyName")}
            type="text"
            autoComplete="organization"
            maxLength={NAME_MAX_CHARS}
            defaultValue={values.companyName}
          />
          {fieldError("companyName")}
        </div>

        <div className={styles.field}>
          <label htmlFor="ownerName" className={styles.label}>
            Seu nome
          </label>
          <input
            {...fieldProps("ownerName")}
            type="text"
            autoComplete="name"
            maxLength={NAME_MAX_CHARS}
            defaultValue={values.ownerName}
          />
          {fieldError("ownerName")}
        </div>

        <div className={styles.field}>
          <label htmlFor="email" className={styles.label}>
            Seu e-mail
          </label>
          <input {...fieldProps("email")} type="email" autoComplete="email" defaultValue={values.email} />
          {fieldError("email")}
        </div>

        <div className={styles.field}>
          <label htmlFor="password" className={styles.label}>
            Crie uma senha
          </label>
          <input {...fieldProps("password")} type="password" autoComplete="new-password" />
          {errors.password ? (
            fieldError("password")
          ) : (
            <p className={styles.hint}>Pelo menos {PASSWORD_MIN_CHARS} caracteres.</p>
          )}
        </div>

        {state.status === "error" && (
          <p className={styles.error} role="alert">
            {state.message}
          </p>
        )}

        <button type="submit" className={styles.button} disabled={pending}>
          {pending ? "Criando a conta…" : "Criar a conta"}
        </button>

        <p className={styles.footer}>
          Já tem conta?{" "}
          <Link href="/entrar" className={styles.link}>
            Entrar
          </Link>
        </p>
      </form>
    </main>
  );
}

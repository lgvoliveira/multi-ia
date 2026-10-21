"use client";

// Login do funcionário. No 1º acesso, ele entra com a senha TEMPORÁRIA que o dono deu e é obrigado a
// CRIAR a própria senha — depois disso, o dono não vê mais a senha nem consegue entrar na conta dele.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./OckLogin.module.css";

export function OckLogin() {
  const router = useRouter();
  const [step, setStep] = useState<"login" | "newPassword">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [memberId, setMemberId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function entrar() {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/ock/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as {
        member?: { id: string; mustChangePassword: boolean };
        problem?: string;
      };
      if (res.ok && data.member) {
        if (data.member.mustChangePassword) {
          setMemberId(data.member.id);
          setStep("newPassword");
        } else {
          router.push(`/trabalho?member=${data.member.id}`);
        }
        return;
      }
      setError(data.problem ?? "Não deu para entrar.");
    } catch {
      setError("Não consegui falar com o servidor.");
    } finally {
      setBusy(false);
    }
  }

  async function criarSenha() {
    if (busy) return;
    setError("");
    if (newPassword !== confirm) {
      setError("As senhas não são iguais.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/ock/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, currentPassword: password, newPassword }),
      });
      const data = (await res.json()) as { ok?: boolean; problem?: string };
      if (res.ok && data.ok) {
        router.push(`/trabalho?member=${memberId}`);
        return;
      }
      setError(data.problem ?? "Não deu para criar a senha.");
    } catch {
      setError("Não consegui falar com o servidor.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "newPassword") {
    return (
      <main className={styles.main}>
        <form
          className={styles.card}
          onSubmit={(e) => {
            e.preventDefault();
            void criarSenha();
          }}
        >
          <h1 className={styles.title}>Crie a sua senha</h1>
          <p className={styles.lead}>
            Este é o seu primeiro acesso. Escolha uma senha só sua — a partir de agora, nem a empresa a vê.
          </p>
          <label className={styles.label}>
            Nova senha
            <input
              className={styles.input}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="pelo menos 6 caracteres"
            />
          </label>
          <label className={styles.label}>
            Repita a senha
            <input
              className={styles.input}
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="a mesma senha"
            />
          </label>
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.button} disabled={busy || !newPassword || !confirm}>
            {busy ? "Salvando…" : "Criar senha e entrar"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <form
        className={styles.card}
        onSubmit={(e) => {
          e.preventDefault();
          void entrar();
        }}
      >
        <h1 className={styles.title}>Entrar</h1>
        <p className={styles.lead}>Use o email e a senha que a sua empresa criou para você.</p>

        <label className={styles.label}>
          Email
          <input
            className={styles.input}
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@ock.com.br"
          />
        </label>
        <label className={styles.label}>
          Senha
          <input
            className={styles.input}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="sua senha"
          />
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className={styles.button} disabled={busy || !email || !password}>
          {busy ? "Entrando…" : "Entrar"}
        </button>

        <p className={styles.back}>
          <Link href="/" className={styles.link}>
            Voltar
          </Link>
        </p>
      </form>
    </main>
  );
}

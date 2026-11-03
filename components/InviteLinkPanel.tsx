"use client";

// As credenciais que o dono acabou de criar para o funcionário: o e-mail e a SENHA TEMPORÁRIA, para entregar à pessoa
// (ex.: pelo WhatsApp). A senha só aparece aqui, uma vez. A pessoa entra com ela e cria a própria no primeiro acesso.

import { useEffect, useId, useRef, useState } from "react";
import { firstName } from "@/lib/auth/member";
import styles from "./InviteLinkPanel.module.css";

interface CredentialsPanelProps {
  name: string;
  email: string;
  tempPassword: string;
  /** Senha nova (reset) em vez de funcionário recém-criado: muda só os textos. */
  reset?: boolean;
  onClose?: () => void;
}

function whatsappMessage(name: string, email: string, password: string, reset: boolean): string {
  const greeting = `Olá, ${firstName(name)}!`;
  const head = reset ? "Aqui está a sua senha nova no OCK." : "Você foi adicionado à equipe no OCK.";
  return (
    `${greeting} ${head}\n` +
    `E-mail: ${email}\n` +
    `Senha temporária: ${password}\n` +
    `Entre no OCK com esses dados e crie a sua própria senha no primeiro acesso.`
  );
}

export function InviteLinkPanel({ name, email, tempPassword, reset = false, onClose }: CredentialsPanelProps) {
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const titleRef = useRef<HTMLParagraphElement>(null);
  const emailId = useId();
  const passwordId = useId();

  // O painel aparece no lugar do botão que o gerou: o foco vai para ele, e o leitor de tela lê o título.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  async function copyBoth() {
    try {
      await navigator.clipboard.writeText(`E-mail: ${email}\nSenha temporária: ${tempPassword}`);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  }

  const first = firstName(name);
  return (
    <div className={styles.panel}>
      <p ref={titleRef} tabIndex={-1} className={styles.title}>
        {reset ? `Senha nova de ${first}` : `Funcionário criado: ${first}`}
      </p>
      <p className={styles.text}>
        Entregue estes dados à pessoa (ex.: pelo WhatsApp). A senha é temporária: no primeiro acesso ela cria a própria.
        Aparecem aqui só uma vez.
      </p>

      <label htmlFor={emailId} className={styles.label}>
        E-mail
      </label>
      <input
        id={emailId}
        className={styles.link}
        type="text"
        value={email}
        readOnly
        onFocus={(event) => event.currentTarget.select()}
      />

      <label htmlFor={passwordId} className={styles.label}>
        Senha temporária
      </label>
      <input
        id={passwordId}
        className={styles.link}
        type="text"
        value={tempPassword}
        readOnly
        onFocus={(event) => event.currentTarget.select()}
      />

      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={copyBoth}>
          {copy === "copied" ? "Copiado!" : "Copiar e-mail e senha"}
        </button>
        <a
          className={styles.secondary}
          href={`https://wa.me/?text=${encodeURIComponent(whatsappMessage(name, email, tempPassword, reset))}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Mandar pelo WhatsApp
        </a>
        {onClose && (
          <button type="button" className={styles.ghost} onClick={onClose}>
            Fechar
          </button>
        )}
      </div>

      <p className={styles.hint} aria-live="polite">
        {copy === "failed"
          ? "Não deu para copiar sozinho. Selecione os campos e copie com Ctrl + C."
          : "Se a senha se perder, gere uma nova no cartão da pessoa."}
      </p>
    </div>
  );
}

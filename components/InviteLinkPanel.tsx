"use client";

// O link que o dono acabou de gerar, para mandar ao funcionário: copiar ou abrir o WhatsApp com a mensagem pronta.
// O link só aparece aqui, uma vez: o banco guarda só o resumo do código. Perdeu? Gera outro (o antigo para de valer).

import { useEffect, useId, useRef, useState } from "react";
import { firstName } from "@/lib/auth/member";
import styles from "./InviteLinkPanel.module.css";

interface InviteLinkPanelProps {
  name: string;
  link: string;
  kind: "invite" | "reset";
  onClose?: () => void;
}

function whatsappMessage(name: string, link: string, kind: "invite" | "reset"): string {
  const greeting = `Olá, ${firstName(name)}!`;
  return kind === "invite"
    ? `${greeting} Este é o seu convite para entrar na equipe no OCK. Abra o link e crie a sua senha ` +
        `(ele vale por 24 horas e funciona uma vez só): ${link}`
    : `${greeting} Este é o link para você criar uma senha nova no OCK ` +
        `(ele vale por 24 horas e funciona uma vez só): ${link}`;
}

export function InviteLinkPanel({ name, link, kind, onClose }: InviteLinkPanelProps) {
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const titleRef = useRef<HTMLParagraphElement>(null);
  const inputId = useId();

  // O painel aparece no lugar do botão que o gerou: o foco vai para ele, e o leitor de tela lê o título.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  }

  const first = firstName(name);
  return (
    <div className={styles.panel}>
      <p ref={titleRef} tabIndex={-1} className={styles.title}>
        {kind === "invite" ? `Convite criado para ${first}` : `Link de senha nova para ${first}`}
      </p>
      <p className={styles.text}>
        Mande este link para a pessoa, por exemplo pelo WhatsApp. Ele vale por 24 horas e funciona uma vez só.
      </p>

      <label htmlFor={inputId} className={styles.label}>
        Link
      </label>
      <input
        id={inputId}
        className={styles.link}
        type="text"
        value={link}
        readOnly
        onFocus={(event) => event.currentTarget.select()}
      />

      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={copyLink}>
          {copy === "copied" ? "Link copiado!" : "Copiar o link"}
        </button>
        <a
          className={styles.secondary}
          href={`https://wa.me/?text=${encodeURIComponent(whatsappMessage(name, link, kind))}`}
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
          ? "Não deu para copiar sozinho. Clique no link acima e copie com Ctrl + C."
          : "Se o link se perder, gere outro no cartão da pessoa: o antigo para de valer."}
      </p>
    </div>
  );
}

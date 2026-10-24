"use client";

// Aparece quando algo dá errado ao montar uma página (ex.: o banco não respondeu). O padrão do Next.js é em inglês.
// A mensagem técnica fica no registro do servidor; a tela só pede para tentar de novo.

import Link from "next/link";
import styles from "./error.module.css";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Algo deu errado do nosso lado</h1>
      <p className={styles.lead}>Não conseguimos abrir esta página agora. Tente de novo em instantes.</p>
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={() => retry()}>
          Tentar de novo
        </button>
        <Link href="/">Voltar ao início</Link>
      </div>
    </main>
  );
}

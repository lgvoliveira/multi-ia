import type { Metadata } from "next";
import { ApiKeysManager } from "@/components/ApiKeysManager";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Minhas chaves de API",
};

// Página "Minhas chaves de API": a pessoa conecta as IAs que já tem conta (Claude, GPT, Gemini).
export default function ApiKeysPage() {
  return (
    <main className={styles.main}>
      <section className={styles.intro}>
        <h1 className={styles.title}>Minhas chaves de API</h1>
        <p className={styles.lead}>
          Opcional. Se você já tem conta nas empresas de IA, conecte suas chaves e escolha
          &ldquo;Minhas chaves&rdquo; em qualquer projeto. O custo vai direto para a sua conta
          nelas, sem gastar créditos aqui.
        </p>
      </section>

      <ApiKeysManager />
    </main>
  );
}

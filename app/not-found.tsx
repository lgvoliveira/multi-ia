import type { Metadata } from "next";
import Link from "next/link";
import styles from "./not-found.module.css";

// Aparece em qualquer endereço que não existe (o padrão do Next.js é em inglês).
export const metadata: Metadata = {
  title: "Página não encontrada",
};

export default function NotFound() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Página não encontrada</h1>
      <p className={styles.lead}>
        O endereço pode estar errado, ou esta receita ainda não está pronta.
      </p>
      <Link href="/">Ver as receitas</Link>
    </main>
  );
}

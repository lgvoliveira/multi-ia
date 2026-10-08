import Link from "next/link";
import styles from "./SiteHeader.module.css";

// Topo do site. "Meus projetos", "Histórico", saldo e conta entram na etapa 5.
export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          Multi-IA
        </Link>
        <nav aria-label="Principal" className={styles.nav}>
          <Link href="/" className={styles.navLink}>
            Receitas
          </Link>
        </nav>
      </div>
    </header>
  );
}

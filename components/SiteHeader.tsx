import Link from "next/link";
import styles from "./SiteHeader.module.css";

// Topo do site. Só o logo, que volta para a entrada (escolher quem é você).
export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          OCK
        </Link>
      </div>
    </header>
  );
}

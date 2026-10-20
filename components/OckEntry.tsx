// A porta de entrada do OCK: você diz quem é. O dono vai para o painel de gestão; o funcionário
// entra com o login que o dono criou para ele. (Sem login de dono ainda — isto é para testar.)

import Link from "next/link";
import styles from "./OckEntry.module.css";

export function OckEntry() {
  return (
    <main className={styles.main}>
      <section className={styles.intro}>
        <p className={styles.kicker}>OCK</p>
        <h1 className={styles.title}>Quem é você?</h1>
        <p className={styles.lead}>
          O time de IAs trabalha para a sua empresa. Entre como <strong>dono</strong> para gerir os
          funcionários e ver os gastos, ou como <strong>funcionário</strong> para pedir tarefas.
        </p>
      </section>

      <div className={styles.columns}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Sou o dono</h2>
          <p className={styles.cardText}>
            Gerencie funcionários, crie o login de cada um, defina tetos de gasto e acompanhe o custo.
          </p>
          <Link href="/dono" className={styles.ownerButton}>
            Entrar como dono
          </Link>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Sou funcionário</h2>
          <p className={styles.cardText}>Entre com o email e a senha que a sua empresa criou para você.</p>
          <Link href="/entrar" className={styles.ownerButton}>
            Entrar com meu login
          </Link>
        </section>
      </div>
    </main>
  );
}

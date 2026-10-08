import styles from "./page.module.css";

// Página inicial. Na T5 ela ganha os cartões das receitas.
export default function HomePage() {
  return (
    <main className={styles.main}>
      <section className={styles.intro}>
        <h1 className={styles.title}>O que você quer fazer hoje?</h1>
        <p className={styles.lead}>
          Escolha uma receita e um time de IAs já montado começa a trabalhar para você. Dá para
          trocar qualquer IA antes de começar.
        </p>
      </section>

      <p className={styles.notice}>Em construção: as receitas aparecem aqui em breve.</p>
    </main>
  );
}

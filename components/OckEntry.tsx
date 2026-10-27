// A porta de entrada do OCK, para quem ainda não entrou: o dono cria a conta da empresa; quem já tem conta
// (dono ou funcionário) entra. O funcionário não se cadastra sozinho: o acesso vem por convite do dono.

import Link from "next/link";
import { isDemoMode } from "@/lib/auth/demo";
import styles from "./OckEntry.module.css";

export function OckEntry() {
  return (
    <main className={styles.main}>
      <section className={styles.intro}>
        <p className={styles.kicker}>OCK</p>
        <h1 className={styles.title}>O time de IAs da sua empresa</h1>
        <p className={styles.lead}>
          Os funcionários usam Claude, GPT e Gemini no trabalho do dia a dia. O dono acompanha o que cada um entregou e
          quanto gastou, e define um teto de gasto para cada um.
        </p>
      </section>

      <div className={styles.columns}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Sou o dono</h2>
          <p className={styles.cardText}>
            Crie a conta da empresa. Depois você convida os funcionários e define o teto de gasto de cada um.
          </p>
          <Link href="/cadastro" className={styles.ownerButton}>
            Criar a conta da empresa
          </Link>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Já tenho conta</h2>
          <p className={styles.cardText}>
            Dono ou funcionário, entre com o seu e-mail e a sua senha. O funcionário recebe o acesso por um convite do
            dono.
          </p>
          <Link href="/entrar" className={styles.ownerButton}>
            Entrar
          </Link>
        </section>

        {isDemoMode() && (
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>🕶️ Visão raio-x</h2>
            <p className={styles.cardText}>
              Só no seu computador: entre como Chefe ou como Funcionário com um clique, sem login nem crédito, para ver
              o site inteiro. Não aparece no site publicado.
            </p>
            <Link href="/raiox" className={styles.ownerButton}>
              Abrir a visão raio-x
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}

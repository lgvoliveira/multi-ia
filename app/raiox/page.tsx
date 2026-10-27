import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DEMO_ACCOUNTS, isDemoMode, type DemoView } from "@/lib/auth/demo";
import { entrarComoDemo } from "./actions";
import styles from "./raiox.module.css";

export const metadata: Metadata = {
  title: "Visão raio-x (local)",
  description: "Entre no site como Chefe ou como Funcionário, sem login, para ver tudo.",
};

const VIEWS: DemoView[] = ["chefe", "funcionario"];

// Página só local (modo raio-x): escolhe de qual lado ver o site. Fora do modo raio-x, não existe.
export default function RaioXPage() {
  if (!isDemoMode()) notFound();

  return (
    <main className={styles.main}>
      <section className={styles.intro}>
        <p className={styles.kicker}>Visão raio-x · só no seu computador</p>
        <h1 className={styles.title}>Entre e veja o site inteiro</h1>
        <p className={styles.lead}>
          Sem login, e-mail nem crédito. Escolha de qual lado ver — você pode trocar a qualquer hora pelo topo da
          página. Esta porta não existe no site publicado.
        </p>
      </section>

      <div className={styles.columns}>
        {VIEWS.map((view) => {
          const account = DEMO_ACCOUNTS[view];
          return (
            <form key={view} action={entrarComoDemo.bind(null, view)} className={styles.card}>
              <h2 className={styles.cardTitle}>{account.label}</h2>
              <p className={styles.cardText}>{account.description}</p>
              <button type="submit" className={styles.button}>
                {account.label}
              </button>
            </form>
          );
        })}
      </div>
    </main>
  );
}

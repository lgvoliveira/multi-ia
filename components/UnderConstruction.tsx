// Aviso provisório (etapa 5, PR 2a): o chat e as receitas ainda usam as tabelas do banco antigo, que não existem no
// banco novo. Voltam no PR 3, já ligados à empresa e ao login de quem está usando.

import Link from "next/link";
import { firstName, type CurrentMember } from "@/lib/auth/member";
import styles from "./UnderConstruction.module.css";

export function UnderConstruction({ me }: { me: CurrentMember }) {
  return (
    <main className={styles.main}>
      <section className={styles.card} aria-labelledby="under-construction-title">
        <p className={styles.kicker}>Em obras</p>
        <h1 id="under-construction-title" className={styles.title}>
          Olá, {firstName(me.name)}!
        </h1>
        <p className={styles.lead}>
          O espaço de trabalho está mudando para o banco novo. O chat e as receitas voltam no próximo passo, já ligados
          à sua empresa.
        </p>
        {me.role === "owner" && (
          <Link href="/dono" className={styles.link}>
            Ir para o painel do dono
          </Link>
        )}
      </section>
    </main>
  );
}

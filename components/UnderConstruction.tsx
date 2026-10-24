// Aviso provisório (etapa 5): o chat ainda usa as tabelas do banco antigo, que não existem no banco novo. Volta na
// parte 3c do PR 3, já ligado à empresa e ao login de quem está usando. A receita "Criar um site" já voltou (3a).

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
          O espaço de trabalho está mudando para o banco novo. O chat volta em breve, já ligado à sua empresa. Enquanto
          isso, a receita &ldquo;Criar um site&rdquo; já funciona.
        </p>
        <Link href="/recipes/create-site" className={styles.link}>
          Abrir a receita &ldquo;Criar um site&rdquo;
        </Link>
        {me.role === "owner" && (
          <Link href="/dono" className={styles.link}>
            Ir para o painel do dono
          </Link>
        )}
      </section>
    </main>
  );
}

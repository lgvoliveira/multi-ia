// O link do convite não serve: já foi usado (ou trocado por um mais novo), venceu, ou a pessoa foi desativada.
// A tela não diz qual caso é o de um link inventado: para quem não tem o link certo, todos parecem "não vale mais".

import Link from "next/link";
import styles from "./AuthForm.module.css";

const TEXTS = {
  "not-found": {
    title: "Este link não vale mais",
    lead: "Ele já foi usado, foi trocado por um link mais novo ou chegou incompleto. Peça um link novo ao dono da sua empresa.",
  },
  expired: {
    title: "Este link venceu",
    lead: "Os links de convite valem 24 horas. Peça um link novo ao dono da sua empresa.",
  },
  disabled: {
    title: "Este acesso foi desativado",
    lead: "O dono da sua empresa desativou este acesso. Se foi engano, fale com ele.",
  },
} as const;

export function InviteProblem({ kind }: { kind: keyof typeof TEXTS }) {
  const text = TEXTS[kind];
  return (
    <main className={styles.main}>
      <section className={styles.card} aria-labelledby="invite-problem-title">
        <h1 id="invite-problem-title" className={styles.title}>
          {text.title}
        </h1>
        <p className={styles.lead}>{text.lead}</p>
        <p className={styles.footer}>
          Já criou a sua senha?{" "}
          <Link href="/entrar" className={styles.link}>
            Entrar
          </Link>
        </p>
      </section>
    </main>
  );
}

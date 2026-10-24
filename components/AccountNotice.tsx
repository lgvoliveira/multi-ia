// Aviso para quem entrou, mas não pode usar a empresa: foi desativado pelo dono, ou o login não está ligado a
// nenhuma empresa (ex.: o cadastro falhou no meio do primeiro acesso).

import { signOut } from "@/app/entrar/actions";
import styles from "./AccountNotice.module.css";

const TEXTS = {
  disabled: {
    title: "Seu acesso foi desativado",
    lead: "O dono da sua empresa desativou este acesso. Se foi engano, fale com ele.",
  },
  "no-company": {
    title: "Não encontramos a sua empresa",
    lead: "Este login não está ligado a nenhuma empresa. Saia e entre de novo; se continuar assim, fale com a gente.",
  },
} as const;

export function AccountNotice({ kind }: { kind: keyof typeof TEXTS }) {
  const text = TEXTS[kind];
  return (
    <main className={styles.main}>
      <section className={styles.card} aria-labelledby="account-notice-title">
        <h1 id="account-notice-title" className={styles.title}>
          {text.title}
        </h1>
        <p className={styles.lead}>{text.lead}</p>
        <form action={signOut}>
          <button type="submit" className={styles.button}>
            Sair
          </button>
        </form>
      </section>
    </main>
  );
}

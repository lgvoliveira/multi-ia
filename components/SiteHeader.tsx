import Link from "next/link";
import { signOut } from "@/app/entrar/actions";
import { getViewer, type Viewer } from "@/lib/auth/viewer";
import { OwnerNav } from "./OwnerNav";
import styles from "./SiteHeader.module.css";

// Topo do site: o logo, que volta para a entrada, e, para quem está logado, quem é e o botão "Sair". O dono ganha os
// atalhos entre o painel dele e o espaço de trabalho.
export async function SiteHeader() {
  let viewer: Viewer;
  try {
    viewer = await getViewer();
  } catch {
    // O topo nunca derruba o site: se o banco falhar, ele aparece sem a conta, e a página mostra o erro (app/error.tsx).
    viewer = { status: "signed-out" };
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          OCK
        </Link>
        {viewer.status === "member" && viewer.member.role === "owner" && (
          <div className={styles.nav}>
            <OwnerNav />
          </div>
        )}
        {viewer.status !== "signed-out" && (
          <div className={styles.account}>
            {viewer.status === "member" && (
              <p className={styles.who}>
                <span className={styles.name}>{viewer.member.name}</span>
                <span className={styles.company}>{viewer.member.companyName}</span>
              </p>
            )}
            <form action={signOut}>
              <button type="submit" className={styles.signOut}>
                Sair
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}

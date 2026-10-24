// Painel do dono (etapa 5, PR 2a): a empresa e a equipe. Convidar funcionários, mudar o teto e desativar chegam no
// PR 2b; crédito, gastos e entregas de cada um, no PR 3.

import { firstName, type CurrentMember } from "@/lib/auth/member";
import { formatBRL } from "@/lib/ock/pricing";
import type { TeamMember } from "@/lib/ock/team";
import styles from "./OwnerHome.module.css";

function budgetText(person: TeamMember): string | null {
  if (person.role === "owner") return null;
  return person.monthlyBudgetCents === null ? "Sem teto" : `Teto de ${formatBRL(person.monthlyBudgetCents)} por mês`;
}

export function OwnerHome({ me, team }: { me: CurrentMember; team: TeamMember[] }) {
  return (
    <main className={styles.main}>
      <section className={styles.intro}>
        <p className={styles.kicker}>Painel do dono</p>
        <h1 className={styles.title}>{me.companyName}</h1>
        <p className={styles.lead}>Olá, {firstName(me.name)}. Aqui você acompanha a equipe da empresa.</p>
      </section>

      <section className={styles.section} aria-labelledby="team-title">
        <h2 id="team-title" className={styles.sectionTitle}>
          Equipe <span className={styles.count}>({team.length})</span>
        </h2>
        <ul className={styles.team}>
          {team.map((person) => {
            const budget = budgetText(person);
            return (
              <li key={person.id} className={styles.person}>
                <div className={styles.personMain}>
                  <p className={styles.personName}>
                    {person.name}
                    {person.id === me.id && <span className={styles.you}> (você)</span>}
                  </p>
                  <p className={styles.personEmail}>{person.email}</p>
                </div>
                <ul className={styles.tags} aria-label="Detalhes">
                  <li className={styles.tag}>{person.role === "owner" ? "Dono" : "Funcionário"}</li>
                  {budget && <li className={styles.tag}>{budget}</li>}
                  {person.status === "disabled" && <li className={styles.tagMuted}>Desativado</li>}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>

      <p className={styles.notice}>
        Em obras: convidar funcionários chega no próximo passo. Depois vêm o crédito da empresa e os gastos e as
        entregas de cada um.
      </p>
    </main>
  );
}

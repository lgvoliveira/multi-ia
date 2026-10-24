// Painel do dono (etapa 5): a empresa e a equipe. Convidar funcionários, mudar o teto, gerar link novo e desativar
// entraram no PR 2b; crédito, gastos e entregas de cada um chegam no PR 3.

import { firstName, type CurrentMember } from "@/lib/auth/member";
import { formatBRL } from "@/lib/ock/pricing";
import { deadlineText, type TeamMember } from "@/lib/ock/team";
import { budgetInputValue } from "@/lib/ock/team-forms";
import { InviteEmployee } from "./InviteEmployeeForm";
import { MemberActions } from "./MemberActions";
import styles from "./OwnerHome.module.css";

function budgetText(person: TeamMember): string | null {
  if (person.role === "owner") return null;
  return person.monthlyBudgetCents === null ? "Sem teto" : `Teto de ${formatBRL(person.monthlyBudgetCents)} por mês`;
}

/** A etiqueta e a frase do convite que a pessoa ainda não usou. Quem foi desativado não mostra convite. */
function inviteInfo(person: TeamMember): { tag: string; note: string } | null {
  const invite = person.invite;
  if (!invite || person.status !== "active") return null;
  if (invite.kind === "invite") {
    return invite.expired
      ? { tag: "Convite vencido", note: "O convite venceu antes de ser aceito. Gere um link novo e mande de novo." }
      : {
          tag: "Convite pendente",
          note: `O convite vale até ${deadlineText(invite.expiresAt)}. Se a pessoa perdeu o link, gere um novo.`,
        };
  }
  if (invite.expired) return null;
  return {
    tag: "Senha nova pendente",
    note: `O link de senha nova vale até ${deadlineText(invite.expiresAt)}. Até ele ser usado, a senha antiga continua valendo.`,
  };
}

export function OwnerHome({ me, team }: { me: CurrentMember; team: TeamMember[] }) {
  return (
    <main className={styles.main}>
      <section className={styles.intro}>
        <p className={styles.kicker}>Painel do dono</p>
        <h1 className={styles.title}>{me.companyName}</h1>
        <p className={styles.lead}>Olá, {firstName(me.name)}. Aqui você acompanha a equipe da empresa.</p>
      </section>

      <section className={styles.section} aria-labelledby="invite-title">
        <h2 id="invite-title" className={styles.sectionTitle}>
          Convidar um funcionário
        </h2>
        <p className={styles.sectionLead}>
          Você gera um link e manda para a pessoa (pelo WhatsApp, por exemplo). Ela abre, cria a própria senha e entra.
          Ninguém além dela fica sabendo a senha.
        </p>
        <InviteEmployee ownerId={me.id} />
      </section>

      <section className={styles.section} aria-labelledby="team-title">
        <h2 id="team-title" className={styles.sectionTitle}>
          Equipe <span className={styles.count}>({team.length})</span>
        </h2>
        <ul className={styles.team}>
          {team.map((person) => {
            const budget = budgetText(person);
            const invite = inviteInfo(person);
            return (
              <li key={person.id} className={styles.person}>
                <div className={styles.personTop}>
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
                    {invite && <li className={styles.tagWarning}>{invite.tag}</li>}
                    {person.status === "disabled" && <li className={styles.tagMuted}>Desativado</li>}
                  </ul>
                </div>
                {invite && <p className={styles.personNote}>{invite.note}</p>}
                {person.role === "employee" && (
                  <MemberActions
                    ownerId={me.id}
                    memberId={person.id}
                    name={person.name}
                    status={person.status}
                    budgetInput={budgetInputValue(person.monthlyBudgetCents)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <p className={styles.notice}>
        Em obras: o crédito da empresa e os gastos e as entregas de cada um chegam no próximo passo.
      </p>
    </main>
  );
}

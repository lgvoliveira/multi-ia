// As linhas do extrato do mês: cada receita numa linha só, com as IAs que trabalharam, o dia e a hora e o valor. Usada
// em "Meus gastos", no "Ver o que fez" do painel do dono e no extrato da empresa. Mostra só o que o extrato guarda (a
// descrição escrita pelo nosso servidor), nunca o pedido nem a resposta.

import { formatDateTime, providersText, signedBRL, spentText, type StatementLine } from "@/lib/ock/statement";
import { AiDot } from "./AiDot";
import styles from "./StatementList.module.css";

interface StatementListProps {
  lines: StatementLine[];
  label: string;
  /**
   * No extrato da empresa: o nome de cada pessoa, para mostrar quem gastou, e os valores com o sinal do extrato
   * (recarga +, gasto −). Sem isto, a lista é de uma pessoa só e mostra quanto cada linha gastou.
   */
  people?: ReadonlyMap<string, string>;
}

/** Quem fez a linha, no extrato da empresa. */
function whoText(line: StatementLine, people: ReadonlyMap<string, string>): string {
  if (line.kind === "topup") return "Recarga";
  const person = line.memberId ? (people.get(line.memberId) ?? "Alguém da equipe") : "Empresa";
  return line.kind === "adjustment" ? `Ajuste · ${person}` : person;
}

export function StatementList({ lines, label, people }: StatementListProps) {
  return (
    <ul className={styles.rows} aria-label={label}>
      {lines.map((line) => {
        const who = people ? whoText(line, people) : line.kind === "adjustment" ? "Ajuste" : null;
        const positive = line.amountCents > 0;
        return (
          <li key={line.id} className={styles.row}>
            <div className={styles.main}>
              <span className={styles.description}>{line.description}</span>
              {(line.providers.length > 0 || who) && (
                <span className={styles.meta}>
                  {who && <span>{who}</span>}
                  {line.providers.length > 0 && (
                    <span className={styles.providers}>
                      {line.providers.map((provider) => (
                        <AiDot key={provider} provider={provider} />
                      ))}
                      <span>{providersText(line.providers)}</span>
                    </span>
                  )}
                </span>
              )}
            </div>
            <span className={styles.date}>{formatDateTime(line.createdAt)}</span>
            <span className={people && positive ? `${styles.value} ${styles.credit}` : styles.value}>
              {people ? signedBRL(line.amountCents) : spentText(line)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

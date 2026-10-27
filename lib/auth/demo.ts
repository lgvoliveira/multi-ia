// A "visão raio-x": um atalho SÓ LOCAL para entrar no site como Chefe ou como Funcionário com um clique, sem login,
// e-mail nem crédito, para ver e fazer tudo. Usa as contas de teste que o seed já cria (empresa "Agência Exemplo", já
// com crédito e com teto nos funcionários). NUNCA vale em produção.

import type { MemberRole } from "./member";

/**
 * Liga a visão raio-x. Trava DUPLA de propósito: só com a variável `OCK_DEMO_MODE=1` (que fica só no `.env.local`,
 * nunca no Vercel) E fora de produção (no site publicado, `NODE_ENV` é "production"). Se a variável vazar para a
 * produção, o segundo teste ainda barra. Server-only: `OCK_DEMO_MODE` não é `NEXT_PUBLIC`, então no navegador é sempre
 * `undefined` e esta função dá `false`.
 */
export function isDemoMode(): boolean {
  return process.env.OCK_DEMO_MODE === "1" && process.env.NODE_ENV !== "production";
}

export interface DemoAccount {
  role: MemberRole;
  label: string;
  email: string;
  password: string;
  description: string;
}

/** As contas de teste do seed (a senha de todas é a mesma, e só existe no banco local). */
export const DEMO_ACCOUNTS = {
  chefe: {
    role: "owner",
    label: "Ver como Chefe",
    email: "marina@example.com",
    password: "senha-local-123",
    description: "O painel do dono: crédito da empresa, a equipe, os gastos de cada um e os convites.",
  },
  funcionario: {
    role: "employee",
    label: "Ver como Funcionário",
    email: "ana@example.com",
    password: "senha-local-123",
    description: "O espaço de trabalho: o chat com as IAs, as receitas, as entregas e os próprios gastos.",
  },
} satisfies Record<string, DemoAccount>;

export type DemoView = keyof typeof DEMO_ACCOUNTS;

export function isDemoView(value: unknown): value is DemoView {
  return value === "chefe" || value === "funcionario";
}

// Quem está logado, do jeito que as telas usam: a pessoa, o papel e a empresa. Só dados e funções puras, para testar
// sem banco. A busca no banco fica em viewer.ts.

export type MemberRole = "owner" | "employee";

export interface CurrentMember {
  id: string;
  companyId: string;
  companyName: string;
  name: string;
  email: string;
  role: MemberRole;
}

/** A página de cada papel: o dono vai para o painel; o funcionário, para o espaço de trabalho. */
export function homePathFor(role: MemberRole): "/dono" | "/trabalho" {
  return role === "owner" ? "/dono" : "/trabalho";
}

/** Primeiro nome, para cumprimentar ("Marina Souza" → "Marina"). */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Lê a linha de members (com a empresa junto, em `companies`) que o banco devolve. Confere cada campo em vez de
 * confiar no formato: se o banco mudar sem o código acompanhar, falha aqui com uma mensagem clara.
 */
export function parseMemberRow(row: unknown): CurrentMember {
  if (typeof row !== "object" || row === null) throw new Error("Cadastro da pessoa em formato inesperado.");
  const r = row as Record<string, unknown>;
  // A empresa vem como objeto (ligação de muitos para um); algumas versões devolvem uma lista de um item.
  const company = Array.isArray(r.companies) ? r.companies[0] : r.companies;
  const companyName = typeof company === "object" && company !== null ? (company as { name?: unknown }).name : null;

  if (!isText(r.id) || !isText(r.company_id) || !isText(r.name) || !isText(r.email) || !isText(companyName)) {
    throw new Error("Cadastro da pessoa incompleto.");
  }
  if (r.role !== "owner" && r.role !== "employee") throw new Error("Papel da pessoa desconhecido.");

  return {
    id: r.id,
    companyId: r.company_id,
    companyName,
    name: r.name,
    email: r.email,
    role: r.role,
  };
}

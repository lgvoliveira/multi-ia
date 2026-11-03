// O formulário do dono para criar um agente da empresa, e o cartão que a tela mostra. Só DADOS e conferências puras
// (vai para o navegador): a persona e o conhecimento (a instrução da IA) são conferidos aqui pelo tamanho, mas quem os
// usa é só o servidor. Mesma ideia de lib/ock/team-forms.ts (o convite), para o formulário do painel do dono.

import { text, type FormResult } from "@/lib/auth/forms";

/** Um agente da empresa, do jeito que a tela mostra (vitrine). A persona e o conhecimento NÃO vêm aqui. */
export interface CompanyAgentCard {
  id: string;
  name: string;
  role: string;
  tagline: string;
  starters: string[];
}

/** Os limites de cada campo (os mesmos do banco, migração company_agents). */
export const AGENT_NAME_MAX = 40;
export const AGENT_ROLE_MAX = 60;
export const AGENT_TAGLINE_MAX = 160;
export const AGENT_PERSONA_MIN = 20;
export const AGENT_PERSONA_MAX = 4000;
export const AGENT_KNOWLEDGE_MAX = 8000;
export const AGENT_STARTERS_MAX = 6;
export const AGENT_STARTER_MAX = 160;
/** Quantos agentes próprios uma empresa pode ter. */
export const MAX_COMPANY_AGENTS = 20;

export type AgentField = "name" | "role" | "tagline" | "persona" | "knowledge" | "starters";

export interface CompanyAgentValues {
  name: string;
  role: string;
  tagline: string;
  persona: string;
  knowledge: string | null;
  starters: string[];
}

/** O que a tela mandou de volta, para repreencher o formulário quando algo deu errado. */
export interface CompanyAgentTyped {
  name: string;
  role: string;
  tagline: string;
  persona: string;
  knowledge: string;
  starters: string;
}

/** O que a ação de criar um agente devolve para a tela. */
export type CompanyAgentState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<AgentField, string>>; values: CompanyAgentTyped }
  | { status: "error"; message: string; values: CompanyAgentTyped }
  | { status: "created"; card: CompanyAgentCard };

/** As perguntas de partida vêm de um campo de texto, uma por linha. Tira linhas vazias e corta no máximo. */
export function parseStarters(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, AGENT_STARTERS_MAX)
    .map((line) => line.slice(0, AGENT_STARTER_MAX));
}

/** O que o dono digitou, de volta, para repreencher o formulário. */
export function typedAgent(formData: FormData): CompanyAgentTyped {
  return {
    name: text(formData, "name"),
    role: text(formData, "role"),
    tagline: text(formData, "tagline"),
    persona: text(formData, "persona"),
    knowledge: text(formData, "knowledge"),
    starters: formData.get("starters")?.toString() ?? "",
  };
}

/** Confere o formulário do agente da empresa. Devolve os valores prontos ou os erros, em português. */
export function parseCompanyAgentForm(formData: FormData): FormResult<CompanyAgentValues, AgentField> {
  const name = text(formData, "name").trim();
  const role = text(formData, "role").trim();
  const tagline = text(formData, "tagline").trim();
  const persona = text(formData, "persona").trim();
  const knowledgeRaw = text(formData, "knowledge").trim();
  const starters = parseStarters(formData.get("starters")?.toString() ?? "");

  const errors: Partial<Record<AgentField, string>> = {};
  if (!name) errors.name = "Dê um nome ao agente (ex.: Clara).";
  else if (name.length > AGENT_NAME_MAX) errors.name = `O nome passou de ${AGENT_NAME_MAX} caracteres.`;

  if (!role) errors.role = "Diga a função dele (ex.: Atendimento ao cliente).";
  else if (role.length > AGENT_ROLE_MAX) errors.role = `A função passou de ${AGENT_ROLE_MAX} caracteres.`;

  if (!tagline) errors.tagline = "Escreva uma linha do que ele faz, para o cartão.";
  else if (tagline.length > AGENT_TAGLINE_MAX) errors.tagline = `A linha passou de ${AGENT_TAGLINE_MAX} caracteres.`;

  if (!persona) errors.persona = "Explique como ele deve agir e falar.";
  else if (persona.length < AGENT_PERSONA_MIN) errors.persona = "Explique um pouco melhor como ele deve agir.";
  else if (persona.length > AGENT_PERSONA_MAX) errors.persona = `As instruções passaram de ${AGENT_PERSONA_MAX} caracteres.`;

  if (knowledgeRaw.length > AGENT_KNOWLEDGE_MAX) {
    errors.knowledge = `O conhecimento passou de ${AGENT_KNOWLEDGE_MAX} caracteres.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors, values: {} };
  return {
    ok: true,
    values: { name, role, tagline, persona, knowledge: knowledgeRaw || null, starters },
  };
}

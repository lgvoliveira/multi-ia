import { describe, expect, it } from "vitest";
import { AGENT_NAME_MAX, parseCompanyAgentForm, parseStarters } from "./agent-forms";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const OK = {
  name: "Clara",
  role: "Atendimento ao cliente",
  tagline: "Responde clientes com calma.",
  persona: "Você é a Clara, do suporte da Loja X. Responda com calma e resolva o problema.",
  knowledge: "Horário: 9h às 18h.",
  starters: "Responda a um cliente insatisfeito\nEscreva uma resposta de troca",
};

describe("formulário do agente da empresa", () => {
  it("aceita um agente completo e devolve os valores prontos", () => {
    const result = parseCompanyAgentForm(form(OK));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.values).toEqual({
      name: "Clara",
      role: "Atendimento ao cliente",
      tagline: "Responde clientes com calma.",
      persona: OK.persona,
      knowledge: "Horário: 9h às 18h.",
      starters: ["Responda a um cliente insatisfeito", "Escreva uma resposta de troca"],
    });
  });

  it("conhecimento vazio vira null", () => {
    const result = parseCompanyAgentForm(form({ ...OK, knowledge: "   " }));
    expect(result.ok && result.values.knowledge).toBeNull();
  });

  it("cobra os campos obrigatórios e a persona muito curta", () => {
    const empty = parseCompanyAgentForm(form({ name: "", role: "", tagline: "", persona: "" }));
    expect(empty.ok).toBe(false);
    if (empty.ok) return;
    expect(Object.keys(empty.errors).sort()).toEqual(["name", "persona", "role", "tagline"]);

    const short = parseCompanyAgentForm(form({ ...OK, persona: "curto" }));
    expect(!short.ok && short.errors.persona).toBeTruthy();
  });

  it("recusa um nome longo demais", () => {
    const result = parseCompanyAgentForm(form({ ...OK, name: "a".repeat(AGENT_NAME_MAX + 1) }));
    expect(!result.ok && result.errors.name).toBeTruthy();
  });
});

describe("perguntas de partida", () => {
  it("uma por linha, sem vazias, no máximo 6", () => {
    const raw = "\n uma \n\n dois \n três\nquatro\ncinco\nseis\nsete\n";
    expect(parseStarters(raw)).toEqual(["uma", "dois", "três", "quatro", "cinco", "seis"]);
  });
});

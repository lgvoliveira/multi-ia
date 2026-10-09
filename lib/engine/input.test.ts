import { describe, expect, it } from "vitest";
import type { Role, Step } from "@/lib/recipes/types";
import { buildStepInput, buildSystemPrompt } from "./input";

const role: Role = {
  id: "reviewer",
  name: "Revisor",
  description: "",
  suggestedProvider: "gemini",
  systemPrompt: "Você é o revisor do time.",
};

const step: Step = {
  id: "review",
  roleId: "reviewer",
  name: "Revisor",
  summary: "",
  doneSummary: "",
  instruction: "Aponte os erros do site.",
  inputs: [
    { from: "request", label: "Pedido do cliente" },
    { from: "step", stepId: "code", label: "Site do programador" },
  ],
  maxOutputTokens: 100,
  sampleOutput: "Tudo certo.",
  format: "text",
};

describe("montagem do que a IA recebe", () => {
  it("o prompt de sistema é quem a IA é (papel) seguido do que ela faz agora (etapa)", () => {
    expect(buildSystemPrompt(role, step)).toBe("Você é o revisor do time.\n\nAponte os erros do site.");
  });

  it("a entrada junta o pedido e as respostas anteriores, na ordem da receita e com os nomes de cada parte", () => {
    const outputs = new Map([
      ["plan", "Plano que esta etapa não pediu."],
      ["code", "<h1>Doce Encanto</h1>"],
    ]);

    expect(buildStepInput(step, "Quero um site.", outputs)).toBe(
      '<parte nome="Pedido do cliente">\nQuero um site.\n</parte>\n\n' +
        '<parte nome="Site do programador">\n<h1>Doce Encanto</h1>\n</parte>',
    );
  });

  it("dá erro se falta a resposta de uma etapa anterior", () => {
    expect(() => buildStepInput(step, "Quero um site.", new Map())).toThrow('"code"');
  });
});

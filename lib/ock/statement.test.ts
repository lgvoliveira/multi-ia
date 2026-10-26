import { describe, expect, it } from "vitest";
import { emptyMonth, monthActivityText, parseStatementRow, providersText, signedBRL } from "./statement";

describe("contas do mês na tela", () => {
  it("o resumo do mês conta no singular e no plural", () => {
    expect(monthActivityText({ ...emptyMonth("p"), quickTasks: 8, recipes: 1, deliveries: 3 })).toBe(
      "Neste mês: 8 tarefas rápidas, 1 receita, 3 entregas",
    );
    expect(monthActivityText({ ...emptyMonth("p"), quickTasks: 1 })).toBe(
      "Neste mês: 1 tarefa rápida, 0 receitas, 0 entregas",
    );
    expect(monthActivityText(emptyMonth("p"))).toBe("Nada neste mês ainda.");
  });

  it("as IAs por extenso", () => {
    expect(providersText(["claude", "gpt", "gemini"])).toBe("Claude, GPT e Gemini");
    expect(providersText(["gpt"])).toBe("GPT");
    expect(providersText([])).toBe("");
  });

  it("o valor com o sinal do extrato", () => {
    expect(signedBRL(20000)).toBe("+ R$ 200,00");
    expect(signedBRL(-37)).toBe("− R$ 0,37");
    expect(signedBRL(0)).toBe("R$ 0,00");
  });

  it("uma linha do banco: receita, mensagem e recarga", () => {
    const base = { entry_id: 5, member_id: "p1", task_id: null, providers: [], created_at: "2026-10-25T12:00:00Z" };
    expect(
      parseStatementRow({ ...base, kind: "charge", run_id: "r1", description: "Criar um site", amount_cents: -37 }),
    ).toMatchObject({ recipe: true, amountCents: -37 });
    expect(
      parseStatementRow({
        ...base,
        kind: "charge",
        run_id: null,
        description: "Tarefa rápida · Resposta",
        amount_cents: "-2",
      }),
    ).toMatchObject({ recipe: false, amountCents: -2 });
    expect(
      parseStatementRow({ ...base, kind: "topup", member_id: null, run_id: null, description: "Pix", amount_cents: 20000 }),
    ).toMatchObject({ kind: "topup", memberId: null, recipe: false });
  });

  it("uma IA desconhecida não chega à tela, e uma linha estranha é recusada", () => {
    const row = {
      entry_id: 1,
      kind: "charge",
      member_id: "p1",
      run_id: "r1",
      description: "Criar um site",
      providers: ["claude", "outra-ia"],
      amount_cents: -1,
      created_at: "2026-10-25T12:00:00Z",
    };
    expect(parseStatementRow(row).providers).toEqual(["claude"]);
    expect(() => parseStatementRow({ ...row, kind: "saque" })).toThrow();
    expect(() => parseStatementRow({ ...row, amount_cents: null })).toThrow();
  });
});

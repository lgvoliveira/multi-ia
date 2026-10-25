import { describe, expect, it } from "vitest";
import { STALE_TASK_ANSWER, taskView } from "./conversation-view";
import type { TaskRow } from "./task-store";

const ROW: TaskRow = {
  id: "t1",
  prompt: "Pesquise o preço do café",
  answer: "Uns R$ 30 o quilo.",
  status: "finished",
  action: "pesquisa",
  chosen_provider: "gemini",
  chosen_tier: "economico",
  chosen_effort: "low",
  created_at: "2026-10-25T10:00:00Z",
};

const EXTRAS = { costCents: 2, attachments: [], deliveries: [], chart: null, now: Date.parse("2026-10-25T10:01:00Z") };

describe("uma mensagem guardada, do jeito que a tela mostra", () => {
  it("traz a IA que fez, quanto custou e o aviso do tipo de resposta", () => {
    expect(taskView(ROW, EXTRAS)).toMatchObject({
      id: "t1",
      status: "finished",
      provider: "gemini",
      tier: "economico",
      effort: "low",
      costCents: 2,
      reason: null,
      notice: expect.stringContaining("pesquisa na internet ainda não está ligada"),
    });
  });

  it("uma mensagem que ficou respondendo por mais de 6 minutos parou no meio: aparece como falha, sem cobrança", () => {
    const running = { ...ROW, status: "running" as const, answer: null };
    expect(taskView(running, EXTRAS)).toMatchObject({ status: "running", answer: null });
    const later = { ...EXTRAS, now: Date.parse("2026-10-25T10:07:00Z") };
    expect(taskView(running, later)).toMatchObject({ status: "failed", answer: STALE_TASK_ANSWER, notice: null });
  });
});

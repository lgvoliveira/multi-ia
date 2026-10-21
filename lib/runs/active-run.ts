// Lembra, no navegador, qual execução está em andamento para cada receita.
// É o que faz a tela RETOMAR o projeto mesmo quando o endereço perde o ?run=<id>
// (por exemplo, ao clicar numa aba do topo e voltar): ao abrir a receita de novo,
// a tela recupera o id guardado aqui e volta a acompanhar a execução no servidor.
//
// Fica no navegador (localStorage): vale para todas as abas deste navegador e dura até
// o projeto ser recomeçado ("Começar de novo") ou o id guardado sumir do servidor.

const STORAGE_KEY = "multi-ia:active-run";

type ActiveRuns = Record<string, string>;

/** Guarda o id da execução em andamento desta receita. */
export function rememberActiveRun(recipeId: string, runId: string): void {
  const all = readAll();
  all[recipeId] = runId;
  writeAll(all);
}

/** Devolve o id da execução em andamento desta receita, ou null se não houver. */
export function recallActiveRun(recipeId: string): string | null {
  const value = readAll()[recipeId];
  return typeof value === "string" && value ? value : null;
}

/** Esquece a execução desta receita (ao recomeçar ou quando o servidor já não a tem). */
export function forgetActiveRun(recipeId: string): void {
  const all = readAll();
  if (!(recipeId in all)) return;
  delete all[recipeId];
  writeAll(all);
}

function readAll(): ActiveRuns {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const runs: ActiveRuns = {};
    for (const [recipeId, runId] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof runId === "string" && runId) runs[recipeId] = runId;
    }
    return runs;
  } catch {
    return {};
  }
}

function writeAll(runs: ActiveRuns): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
  } catch {
    // Navegador sem armazenamento (ex.: aba privada): a tela ainda retoma pelo ?run= no endereço.
  }
}

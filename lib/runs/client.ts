// O lado do navegador: pede ao servidor para CRIAR uma execução e devolve o id dela.
// A execução roda no servidor, persistida, em chamadas curtas e separadas; o navegador acompanha
// depois pelo Realtime/replay (ver lib/runs/live-client.ts). Aqui não há mais transmissão ao vivo.

import type { RunRefusalBody, RunRequestBody } from "./parse-request";

export const RUNS_URL = "/api/runs";

export const OFFLINE_PROBLEM =
  "Não conseguimos falar com o servidor. Confira sua internet e tente de novo.";
export const SERVER_PROBLEM = "Algo deu errado do nosso lado. Tente de novo daqui a pouco.";

/** O corpo que o navegador manda: o pedido, o time, as chaves conectadas e o token do dono. */
export interface StartRunBody extends RunRequestBody {
  /** Identidade anônima de quem iniciou, para poder cancelar depois (ver lib/runs/owner.ts). */
  ownerToken: string;
}

export type RunStart = { ok: true; runId: string } | { ok: false; problems: string[] };

export interface StartRunOptions {
  /** Cancela só o pedido de criação (não a execução, que já roda no servidor). */
  signal?: AbortSignal;
  /** Quem faz o pedido pela internet. Os testes trocam pela rota do servidor, sem precisar de rede. */
  fetch?: typeof fetch;
}

/** Cria uma execução. Devolve o id, ou os problemas que o servidor apontou. */
export async function startRun(body: StartRunBody, options: StartRunOptions = {}): Promise<RunStart> {
  const send = options.fetch ?? fetch;
  let response: Response;
  try {
    response = await send(RUNS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch {
    return { ok: false, problems: [OFFLINE_PROBLEM] };
  }

  if (!response.ok) {
    return { ok: false, problems: await readProblems(response) };
  }
  try {
    const data: unknown = await response.json();
    if (typeof data === "object" && data !== null && "runId" in data) {
      const { runId } = data as { runId: unknown };
      if (typeof runId === "string" && runId) return { ok: true, runId };
    }
  } catch {
    // A resposta não veio no formato combinado.
  }
  return { ok: false, problems: [SERVER_PROBLEM] };
}

async function readProblems(response: Response): Promise<string[]> {
  try {
    const body: unknown = await response.json();
    if (isRefusal(body)) return body.problems;
  } catch {
    // A resposta não veio no formato combinado (ex.: o servidor caiu antes de responder).
  }
  return [SERVER_PROBLEM];
}

function isRefusal(body: unknown): body is RunRefusalBody {
  if (typeof body !== "object" || body === null || !("problems" in body)) return false;
  const { problems } = body;
  return (
    Array.isArray(problems) &&
    problems.length > 0 &&
    problems.every((problem) => typeof problem === "string")
  );
}

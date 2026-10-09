// O lado do navegador: pede ao servidor para começar uma execução e entrega a narração, evento por evento.

import { readNdjson } from "./ndjson";
import type { RunRefusalBody, RunRequestBody } from "./parse-request";
import type { PublicRunEvent } from "./public-events";

export const RUNS_URL = "/api/runs";

export const OFFLINE_PROBLEM =
  "Não conseguimos falar com o servidor. Confira sua internet e tente de novo.";
export const SERVER_PROBLEM = "Algo deu errado do nosso lado. Tente de novo daqui a pouco.";

export type RunStart =
  | { ok: true; events: AsyncGenerator<PublicRunEvent> }
  | { ok: false; problems: string[] };

export interface StartRunOptions {
  /** Cancela a execução: a conexão cai e o servidor manda as IAs pararem. */
  signal?: AbortSignal;
  /** Quem faz o pedido pela internet. Os testes trocam pela rota do servidor, sem precisar de rede. */
  fetch?: typeof fetch;
}

/** Começa uma execução. Se o servidor recusar o pedido, devolve os problemas que ele apontou. */
export async function startRun(body: RunRequestBody, options: StartRunOptions = {}): Promise<RunStart> {
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

  if (!response.ok || !response.body) {
    return { ok: false, problems: await readProblems(response) };
  }
  return { ok: true, events: readNdjson<PublicRunEvent>(response.body) };
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

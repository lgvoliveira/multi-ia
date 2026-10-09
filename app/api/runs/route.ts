// POST /api/runs: começa uma execução e manda a narração ao navegador enquanto as IAs trabalham,
// uma linha por evento (veja lib/runs/ndjson.ts). Pedido inválido não começa: volta na hora,
// com a lista de problemas em português.

import { runRecipe } from "@/lib/engine/run";
import type { RunEvent } from "@/lib/engine/types";
import { getProvider } from "@/lib/providers/registry";
import { toNdjsonStream } from "@/lib/runs/ndjson";
import { parseRunRequest, type RunRefusalBody } from "@/lib/runs/parse-request";
import { toPublicEvent, type PublicRunEvent } from "@/lib/runs/public-events";

/** Tamanho máximo do corpo do pedido. Folga grande: um pedido de 4.000 caracteres ocupa bem menos. */
const MAX_BODY_SIZE = 64 * 1024;

const STREAM_HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  // Sem guardar cópia e sem compactar: a compactação junta os pedaços e a narração deixaria de chegar ao vivo.
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
  "X-Content-Type-Options": "nosniff",
};

export async function POST(request: Request): Promise<Response> {
  // Só aceita JSON. Isso também impede que outro site dispare execuções pelo navegador de alguém.
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return refuse(415, ["Formato de pedido não aceito."]);
  }
  if (Number(request.headers.get("content-length")) > MAX_BODY_SIZE) {
    return refuse(413, ["O pedido é grande demais."]);
  }

  const text = await request.text();
  if (text.length > MAX_BODY_SIZE) return refuse(413, ["O pedido é grande demais."]);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return refuse(400, ["Não entendemos o pedido enviado."]);
  }

  const parsed = parseRunRequest(body);
  if (!parsed.ok) return refuse(400, parsed.problems);

  // As IAs param se a conexão cair: a pessoa cancelou, fechou a página ou perdeu a internet.
  const stop = new AbortController();
  const signal = AbortSignal.any([request.signal, stop.signal]);
  const events = runRecipe(parsed.input, { getProvider, signal });

  return new Response(toNdjsonStream(narrateToUser(events), { onCancel: () => stop.abort() }), {
    headers: STREAM_HEADERS,
  });
}

/** A narração na versão do usuário. O que é só interno vai para o registro do servidor. */
async function* narrateToUser(events: AsyncIterable<RunEvent>): AsyncGenerator<PublicRunEvent> {
  try {
    for await (const event of events) {
      logFailure(event);
      yield toPublicEvent(event);
    }
  } catch (error) {
    // Defeito no nosso código. A narração acaba sem um evento de fim, e a tela avisa a pessoa.
    console.error("[api/runs] Erro inesperado durante a execução:", error);
  }
}

/** Anota no registro do servidor cada falha de uma IA, com a mensagem técnica que a tela não recebe. */
function logFailure(event: RunEvent) {
  switch (event.type) {
    case "step-retrying":
      console.warn(
        `[api/runs] A etapa "${event.stepId}" falhou (${event.provider}); ` +
          `tentativa ${event.attempt} daqui a ${event.delayMs} ms: ${event.errorMessage}`,
      );
      return;
    case "step-switched":
      console.warn(
        `[api/runs] A etapa "${event.stepId}" falhou (${event.from}); ` +
          `${event.to} assumiu o papel "${event.roleId}": ${event.errorMessage}`,
      );
      return;
    case "run-failed":
      console.error(
        `[api/runs] A etapa "${event.stepId}" falhou (${event.provider}): ${event.errorMessage}`,
      );
      return;
  }
}

function refuse(status: number, problems: string[]): Response {
  return Response.json({ problems } satisfies RunRefusalBody, { status });
}

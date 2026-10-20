// POST /api/keys/validate: recebe { provider, apiKey }, confere a chave com a empresa da IA
// e responde só { ok: true } ou { ok: false, reason }. A chave nunca é gravada nem registrada.

import { isProviderId } from "@/lib/providers/catalog";
import { validateApiKey, type KeyValidation } from "@/lib/providers/validate-key";

/** A chave é curta; uma folga pequena já cobre qualquer formato. */
const MAX_BODY_SIZE = 8 * 1024;

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return reply({ ok: false, reason: "invalid" }, 415);
  }

  const text = await request.text();
  if (text.length > MAX_BODY_SIZE) return reply({ ok: false, reason: "invalid" }, 413);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return reply({ ok: false, reason: "invalid" }, 400);
  }

  if (typeof body !== "object" || body === null) {
    return reply({ ok: false, reason: "invalid" }, 400);
  }

  const { provider, apiKey } = body as Record<string, unknown>;
  if (!isProviderId(provider) || typeof apiKey !== "string") {
    return reply({ ok: false, reason: "invalid" }, 400);
  }

  // Chave inválida não é erro de pedido: respondemos 200 com o veredito no corpo.
  const result = await validateApiKey(provider, apiKey);
  return reply(result, 200);
}

function reply(result: KeyValidation, status: number): Response {
  return Response.json(result, { status });
}

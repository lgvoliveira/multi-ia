// Dispara a continuação de uma execução: o servidor chama a si mesmo em /api/runs/<id>/continue,
// que roda o próximo segmento (uma fase). "Dispara e esquece": não espera a resposta, só garante que
// a chamada saiu. Assim cada segmento roda numa chamada curta e separada, sobrevivendo ao navegador sair
// e cabendo no teto de tempo da função. SÓ do servidor: usa o segredo interno, que nunca vai para o navegador.

/**
 * Descobre o endereço do próprio site para a chamada interna.
 * Ordem: a dica do chamador (ex.: cabeçalho da requisição) → VERCEL_URL (produção/preview) →
 * variável pública de base → localhost no desenvolvimento.
 */
export function resolveSelfOrigin(hint?: string): string {
  if (hint) return hint;
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (base) return base.replace(/\/+$/, "");
  return "http://localhost:3000";
}

/** Tira o endereço de uma requisição recebida (cabeçalhos de proxy ou Host), para a chamada apontar ao mesmo host. */
export function originFromRequest(request: Request): string | undefined {
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!forwardedHost) return undefined;
  const proto = request.headers.get("x-forwarded-proto") ?? (forwardedHost.startsWith("localhost") ? "http" : "https");
  return `${proto}://${forwardedHost}`;
}

/**
 * Chama /api/runs/<id>/continue sem esperar a resposta. Erro aqui não derruba quem chamou:
 * se a chamada se perder, o varredor de reservas vencidas retoma a execução depois.
 */
export function triggerContinue(runId: string, originHint?: string): void {
  const origin = resolveSelfOrigin(originHint);
  const secret = process.env.INTERNAL_RUN_SECRET ?? "";
  const url = `${origin}/api/runs/${runId}/continue`;

  const call = fetch(url, {
    method: "POST",
    headers: { "x-internal-secret": secret },
    // Impede o navegador/edge de reusar uma resposta antiga desta chamada interna.
    cache: "no-store",
  }).catch((error) => {
    console.error(`[runs] Não consegui disparar a continuação de ${runId}:`, error);
  });

  // Mantém a promessa viva na função serverless sem bloquear a resposta ao usuário.
  waitUntil(call);
}

/**
 * Prolonga a vida da função serverless até a promessa resolver, quando o ambiente oferece esse recurso
 * (o `waitUntil` do contexto de requisição da Vercel). Fora dele, é uma chamada "dispara e esquece" comum.
 */
function waitUntil(promise: Promise<unknown>): void {
  const context = (globalThis as { [REQUEST_CONTEXT]?: RequestContext })[REQUEST_CONTEXT];
  const getStore = context?.get;
  const store = typeof getStore === "function" ? getStore() : undefined;
  if (store && typeof store.waitUntil === "function") {
    store.waitUntil(promise);
    return;
  }
  // Sem waitUntil: evita rejeição sem dono; a chamada já foi disparada.
  void promise;
}

/** A chave onde a Vercel publica o contexto da requisição atual (inclui o waitUntil). */
const REQUEST_CONTEXT = Symbol.for("@vercel/request-context");

interface RequestContext {
  get?: () => { waitUntil?: (promise: Promise<unknown>) => void } | undefined;
}

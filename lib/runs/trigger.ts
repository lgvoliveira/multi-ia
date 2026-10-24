// Dispara a continuação de uma execução: o servidor chama a si mesmo em /api/runs/<id>/continue,
// que roda o próximo segmento (uma fase). "Dispara e esquece": não espera a resposta, só garante que
// a chamada saiu. Assim cada segmento roda numa chamada curta e separada, sobrevivendo ao navegador sair
// e cabendo no teto de tempo da função. SÓ do servidor: usa o segredo interno, que nunca vai para o navegador.

import { INTERNAL_SECRET_HEADER, internalRunSecret } from "./internal-secret";

/**
 * Descobre o endereço do próprio site para a chamada interna. NUNCA vem do pedido recebido: os cabeçalhos de um pedido
 * (Host, X-Forwarded-Host) podem ser inventados por quem pede, e a chamada leva o segredo interno (F39).
 * Ordem: VERCEL_URL (publicação na Vercel) → endereço configurado → o próprio computador, na porta do `npm run dev`.
 * Na publicação, conferir se a proteção de acesso da Vercel deixa o site chamar a si mesmo por esse endereço.
 */
export function resolveSelfOrigin(): string {
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (base) return base.replace(/\/+$/, "");
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/**
 * Chama /api/runs/<id>/continue sem esperar a resposta. Erro aqui não derruba quem chamou:
 * se a chamada se perder, a próxima busca de novidades da tela retoma a execução (lib/runs/resume.ts).
 */
export function triggerContinue(runId: string): void {
  const origin = resolveSelfOrigin();
  const secret = internalRunSecret() ?? "";
  const url = `${origin}/api/runs/${runId}/continue`;

  const call = fetch(url, {
    method: "POST",
    headers: { [INTERNAL_SECRET_HEADER]: secret },
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

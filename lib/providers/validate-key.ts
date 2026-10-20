// Confere, no SERVIDOR, se uma chave de API é válida e é mesmo daquela IA.
// A forma de saber é perguntar à própria empresa: um pedido leve (listar os modelos) usando a chave.
// A empresa responde "ok" (chave boa) ou "não autorizado" (chave errada, falsa, vencida ou de outra IA).
//
// Segurança: este arquivo só roda no servidor. A chave nunca é gravada nem registrada em log;
// ela é usada só para este pedido e descartada.

import type { ProviderId } from "./types";

/** Resultado da conferência. `reason` explica por que não passou, para a tela mostrar a mensagem certa. */
export type KeyValidation =
  | { ok: true }
  | { ok: false; reason: "invalid" | "rate-limited" | "network" };

interface ProviderCheck {
  /** Endereço leve (lista de modelos) só para confirmar a chave. */
  url: string;
  /** Como a empresa espera receber a chave. */
  headers: (key: string) => Record<string, string>;
}

const CHECKS: Record<ProviderId, ProviderCheck> = {
  claude: {
    url: "https://api.anthropic.com/v1/models?limit=1",
    headers: (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01" }),
  },
  gpt: {
    url: "https://api.openai.com/v1/models",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  gemini: {
    // A chave vai no cabeçalho (x-goog-api-key), nunca no endereço, para não acabar em log nenhum.
    url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
    headers: (key) => ({ "x-goog-api-key": key }),
  },
};

/** Quanto tempo esperar a resposta da empresa antes de desistir. */
const TIMEOUT_MS = 8000;

export async function validateApiKey(provider: ProviderId, apiKey: string): Promise<KeyValidation> {
  const key = apiKey.trim();
  if (key.length < 8) return { ok: false, reason: "invalid" };

  const check = CHECKS[provider];

  let response: Response;
  try {
    response = await fetch(check.url, {
      method: "GET",
      headers: check.headers(key),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Sem internet, tempo esgotado ou a empresa fora do ar: não é culpa da chave.
    return { ok: false, reason: "network" };
  }

  if (response.ok) return { ok: true };

  // Chave recusada: errada, falsa, vencida ou de outra IA.
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    return { ok: false, reason: "invalid" };
  }

  // Empresa pediu para tentar de novo mais tarde (muitos pedidos).
  if (response.status === 429) return { ok: false, reason: "rate-limited" };

  // Qualquer outra falha (ex.: a empresa com problema): tratamos como "tente de novo".
  return { ok: false, reason: "network" };
}

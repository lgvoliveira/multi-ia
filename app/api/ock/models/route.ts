// POST /api/ock/models { keys } → lista os modelos disponíveis em CADA conta de IA conectada.
// A chave vem do navegador (BYOK), é usada só para consultar e NUNCA é gravada nem registrada em log.
// Serve para o dono ver o que a conta dele tem e para acertar os níveis (econômico/padrão/potente).

import { isProviderId } from "@/lib/providers/catalog";
import type { ProviderKeys } from "@/lib/providers/registry";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ problem: "Pedido inválido." }, { status: 400 });
  }
  const keys = parseKeys((body as { keys?: unknown } | null)?.keys);

  const [claude, gpt, gemini] = await Promise.all([
    keys.claude ? listClaude(keys.claude) : notConnected(),
    keys.gpt ? listOpenAI(keys.gpt) : notConnected(),
    keys.gemini ? listGemini(keys.gemini) : notConnected(),
  ]);

  return Response.json({ claude, gpt, gemini }, { headers: { "Cache-Control": "no-store" } });
}

interface ProviderModels {
  connected: boolean;
  models?: string[];
  error?: string;
}

function notConnected(): ProviderModels {
  return { connected: false };
}

async function listClaude(apiKey: string): Promise<ProviderModels> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/models?limit=100", {
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    });
    if (!res.ok) return { connected: true, error: `Erro ${res.status}` };
    const data = (await res.json()) as { data?: { id?: string }[] };
    return { connected: true, models: (data.data ?? []).map((m) => m.id ?? "").filter(Boolean) };
  } catch {
    return { connected: true, error: "Não deu para consultar." };
  }
}

async function listOpenAI(apiKey: string): Promise<ProviderModels> {
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return { connected: true, error: `Erro ${res.status}` };
    const data = (await res.json()) as { data?: { id?: string }[] };
    const models = (data.data ?? [])
      .map((m) => m.id ?? "")
      .filter((id) => /^(gpt|o\d|chatgpt)/.test(id))
      .sort();
    return { connected: true, models };
  } catch {
    return { connected: true, error: "Não deu para consultar." };
  }
}

async function listGemini(apiKey: string): Promise<ProviderModels> {
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
      headers: { "x-goog-api-key": apiKey },
    });
    if (!res.ok) return { connected: true, error: `Erro ${res.status}` };
    const data = (await res.json()) as { models?: { name?: string }[] };
    const models = (data.models ?? [])
      .map((m) => (m.name ?? "").replace(/^models\//, ""))
      .filter((id) => id.startsWith("gemini"))
      .sort();
    return { connected: true, models };
  } catch {
    return { connected: true, error: "Não deu para consultar." };
  }
}

function parseKeys(value: unknown): ProviderKeys {
  if (typeof value !== "object" || value === null) return {};
  const keys: ProviderKeys = {};
  for (const [id, key] of Object.entries(value as Record<string, unknown>)) {
    if (isProviderId(id) && typeof key === "string" && key.trim()) keys[id] = key.trim();
  }
  return keys;
}

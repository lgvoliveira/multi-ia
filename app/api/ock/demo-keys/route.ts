// Tela de chaves de teste (visão raio-x): grava as chaves da plataforma num arquivo local (fora do Git) para usar a IA
// de verdade no computador, sem editar o .env.local. Só existe no modo raio-x; em produção dá 404. O valor da chave
// nunca volta para a tela (o GET só diz quais estão conectadas).

import { isDemoMode } from "@/lib/auth/demo";
import { writeDemoKeys, type DemoKeyMap } from "@/lib/keys/demo-keys";
import { serverKeys } from "@/lib/keys/server-keys";
import type { ProviderId } from "@/lib/providers/types";

const IDS: readonly ProviderId[] = ["claude", "gpt", "gemini"];

/** Quais IAs estão de fato disponíveis (ambiente + chaves coladas na tela), só presença, nunca o valor. */
function connectedStatus(): Record<ProviderId, boolean> {
  const keys = serverKeys();
  return { claude: !!keys.claude, gpt: !!keys.gpt, gemini: !!keys.gemini };
}

export async function GET(): Promise<Response> {
  if (!isDemoMode()) return Response.json({ error: "Só no modo raio-x." }, { status: 404 });
  return Response.json({ connected: connectedStatus() });
}

export async function POST(request: Request): Promise<Response> {
  if (!isDemoMode()) return Response.json({ error: "Só no modo raio-x." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const source = (body ?? {}) as Record<string, unknown>;
  const partial: DemoKeyMap = {};
  for (const id of IDS) {
    if (typeof source[id] === "string") partial[id] = source[id] as string;
  }

  try {
    writeDemoKeys(partial);
  } catch {
    return Response.json({ error: "Não deu para salvar." }, { status: 500 });
  }
  return Response.json({ connected: connectedStatus() });
}

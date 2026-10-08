// Lista das IAs que o usuário pode escolher. Só dados (sem chaves nem chamadas),
// por isso pode ser usada também pelas telas.

import type { ProviderId } from "./types";

export interface ProviderInfo {
  id: ProviderId;
  /** Nome mostrado na tela. A cor de cada IA fica em styles/tokens.css (--color-ai-<id>). */
  name: string;
}

export const PROVIDERS: readonly ProviderInfo[] = [
  { id: "claude", name: "Claude" },
  { id: "gpt", name: "GPT" },
  { id: "gemini", name: "Gemini" },
];

export function isProviderId(value: unknown): value is ProviderId {
  return PROVIDERS.some((provider) => provider.id === value);
}

export function getProviderInfo(id: ProviderId): ProviderInfo {
  const info = PROVIDERS.find((provider) => provider.id === id);
  if (!info) throw new Error(`IA desconhecida: ${id}`);
  return info;
}

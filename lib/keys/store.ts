// Guarda, no navegador, as chaves de API que a pessoa conectou.
// É o que liga a aba "Minhas chaves de API" à execução: a tela de montar o time lê daqui
// para saber quais IAs estão conectadas e manda a chave para o servidor na hora de rodar.
//
// Fica no navegador (localStorage): vale para todas as abas deste navegador e dura até a pessoa
// remover a chave. O armazenamento seguro e permanente no servidor (criptografado) entra com o login — ver AGENTS.md.

import { PROVIDERS } from "@/lib/providers/catalog";
import type { ProviderId } from "@/lib/providers/types";

export type ConnectedKeys = Partial<Record<ProviderId, string>>;

const STORAGE_KEY = "multi-ia:connected-keys";

export function readConnectedKeys(): ConnectedKeys {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const keys: ConnectedKeys = {};
    for (const { id } of PROVIDERS) {
      const value = (parsed as Record<string, unknown>)[id];
      if (typeof value === "string" && value) keys[id] = value;
    }
    return keys;
  } catch {
    return {};
  }
}

export function setConnectedKey(id: ProviderId, key: string): void {
  const keys = readConnectedKeys();
  keys[id] = key;
  write(keys);
}

export function removeConnectedKey(id: ProviderId): void {
  const keys = readConnectedKeys();
  delete keys[id];
  write(keys);
}

function write(keys: ConnectedKeys): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Navegador sem armazenamento (ex.: aba privada): a conexão vale só enquanto a página estiver aberta.
  }
}

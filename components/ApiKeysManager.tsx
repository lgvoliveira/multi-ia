"use client";

import { useEffect, useState } from "react";
import { readConnectedKeys, removeConnectedKey, setConnectedKey } from "@/lib/keys/store";
import { PROVIDERS } from "@/lib/providers/catalog";
import type { ProviderId } from "@/lib/providers/types";
import { ApiKeyCard } from "./ApiKeyCard";
import styles from "./ApiKeysManager.module.css";

// Guarda, por IA, a versão mascarada da chave (para mostrar) e a chave em si (para o botão "Testar").
// Tudo fica só na memória do navegador nesta versão: nada é enviado para fora a não ser, no momento
// de conectar ou testar, para o NOSSO servidor conferir com a empresa da IA (ver app/api/keys/validate).
// O armazenamento seguro e permanente (criptografado no Supabase) entra junto com o login (ver AGENTS.md).
export type Connection = { masked: string; rawKey: string } | null;

const NO_CONNECTIONS: Record<ProviderId, Connection> = {
  claude: null,
  gpt: null,
  gemini: null,
};

export function ApiKeysManager() {
  const [connections, setConnections] = useState<Record<ProviderId, Connection>>(NO_CONNECTIONS);

  // Ao abrir a página, mostra como "Conectada" o que já foi conectado antes (guardado na sessão).
  useEffect(() => {
    const saved = readConnectedKeys();
    const restored: Record<ProviderId, Connection> = { ...NO_CONNECTIONS };
    for (const { id } of PROVIDERS) {
      const key = saved[id];
      if (key) restored[id] = { masked: maskKey(key), rawKey: key };
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carrega o estado salvo uma vez, ao montar.
    setConnections(restored);
  }, []);

  function connect(id: ProviderId, rawKey: string) {
    setConnectedKey(id, rawKey);
    setConnections((prev) => ({ ...prev, [id]: { masked: maskKey(rawKey), rawKey } }));
  }

  function remove(id: ProviderId) {
    removeConnectedKey(id);
    setConnections((prev) => ({ ...prev, [id]: null }));
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.notice}>
        Sua chave nunca é mostrada de novo depois de conectada e você pode removê-la quando quiser.
      </p>

      <div className={styles.list}>
        {PROVIDERS.map((provider) => (
          <ApiKeyCard
            key={provider.id}
            providerId={provider.id}
            connection={connections[provider.id]}
            onConnect={(rawKey) => connect(provider.id, rawKey)}
            onRemove={() => remove(provider.id)}
          />
        ))}
      </div>
    </div>
  );
}

// Mostra só o começo e o fim da chave; o miolo vira bolinhas.
function maskKey(rawKey: string): string {
  const key = rawKey.trim();
  const head = key.slice(0, 6);
  const tail = key.slice(-4);
  return `${head}••••••••${tail}`;
}

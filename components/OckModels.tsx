"use client";

// Lista os modelos disponíveis em cada conta de IA conectada (a chave vai ao servidor só pra consultar).
// Serve para o dono ver o que tem e para acertar os níveis econômico/padrão/potente.

import { useState } from "react";
import { readConnectedKeys } from "@/lib/keys/store";
import { PROVIDER_LABEL } from "@/lib/ock/pricing";
import type { ProviderId } from "@/lib/providers/types";
import styles from "./OckModels.module.css";

interface ProviderModels {
  connected: boolean;
  models?: string[];
  error?: string;
}

type Result = Record<ProviderId, ProviderModels>;

export function OckModels() {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/ock/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: readConnectedKeys() }),
      });
      if (res.ok) setResult((await res.json()) as Result);
    } catch {
      // Sem internet: nada a mostrar.
    } finally {
      setLoading(false);
    }
  }

  const providers: ProviderId[] = ["claude", "gpt", "gemini"];

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.button} onClick={() => void load()} disabled={loading}>
        {loading ? "Consultando…" : "Ver modelos disponíveis na minha conta"}
      </button>

      {result && (
        <div className={styles.grid}>
          {providers.map((id) => {
            const p = result[id];
            return (
              <div key={id} className={styles.card}>
                <h4 className={styles.title}>{PROVIDER_LABEL[id]}</h4>
                {!p?.connected && <p className={styles.muted}>Não conectada.</p>}
                {p?.error && <p className={styles.error}>{p.error}</p>}
                {p?.models && p.models.length > 0 && (
                  <ul className={styles.list}>
                    {p.models.map((m) => (
                      <li key={m}>
                        <code className={styles.code}>{m}</code>
                      </li>
                    ))}
                  </ul>
                )}
                {p?.connected && !p.error && (p.models?.length ?? 0) === 0 && (
                  <p className={styles.muted}>Nenhum modelo listado.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

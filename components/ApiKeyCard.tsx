"use client";

import { useId, useState } from "react";
import { getProviderInfo } from "@/lib/providers/catalog";
import type { ProviderId } from "@/lib/providers/types";
import type { KeyValidation } from "@/lib/providers/validate-key";
import { AiDot } from "./AiDot";
import type { Connection } from "./ApiKeysManager";
import styles from "./ApiKeyCard.module.css";

// Passo a passo para pegar a chave em cada empresa. Só texto e o link oficial de cada uma.
interface KeyHelp {
  company: string;
  keyUrl: string;
  intro: string;
  steps: string[];
}

const KEY_HELP: Record<ProviderId, KeyHelp> = {
  claude: {
    company: "Anthropic",
    keyUrl: "https://console.anthropic.com/settings/keys",
    intro: "Abra a página de chaves da Anthropic:",
    steps: ["Entre com sua conta e clique em “Create Key”", "Copie a chave e cole aqui embaixo"],
  },
  gpt: {
    company: "OpenAI",
    keyUrl: "https://platform.openai.com/api-keys",
    intro: "Abra a página de chaves da OpenAI:",
    steps: [
      "Entre com sua conta e clique em “Create new secret key”",
      "Copie a chave e cole aqui embaixo",
    ],
  },
  gemini: {
    company: "Google",
    keyUrl: "https://aistudio.google.com/apikey",
    intro: "Abra a página de chaves do Google:",
    steps: ["Entre com sua conta Google e clique em criar chave", "Copie a chave e cole aqui embaixo"],
  },
};

interface ApiKeyCardProps {
  providerId: ProviderId;
  connection: Connection;
  onConnect: (rawKey: string) => void;
  onRemove: () => void;
}

export function ApiKeyCard({ providerId, connection, onConnect, onRemove }: ApiKeyCardProps) {
  const help = KEY_HELP[providerId];
  const name = getProviderInfo(providerId).name;
  const inputId = useId();

  const [value, setValue] = useState("");
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [test, setTest] = useState<{ state: "idle" | "testing"; result: string | null }>({
    state: "idle",
    result: null,
  });

  const connected = connection !== null;

  async function handleConnect() {
    const key = value.trim();
    if (key.length < 8) {
      setConnectError("Cole uma chave para conectar.");
      return;
    }
    setConnectError(null);
    setConnecting(true);
    const result = await checkKey(providerId, key);
    setConnecting(false);

    if (result.ok) {
      onConnect(key);
      setValue("");
    } else {
      setConnectError(messageFor(result.reason, help.company));
    }
  }

  async function handleTest() {
    if (!connection) return;
    setTest({ state: "testing", result: null });
    const result = await checkKey(providerId, connection.rawKey);
    setTest({
      state: "idle",
      result: result.ok ? "✓ Chave funcionando" : `✕ ${messageFor(result.reason, help.company)}`,
    });
  }

  function handleRemove() {
    setTest({ state: "idle", result: null });
    onRemove();
  }

  return (
    <article className={connected ? styles.card : `${styles.card} ${styles.active}`}>
      <div className={styles.head}>
        <div className={styles.identity}>
          <AiDot provider={providerId} size="large" />
          <span className={styles.name}>
            {help.company} · {name}
          </span>
        </div>
        <span className={connected ? `${styles.badge} ${styles.badgeOn}` : styles.badge}>
          {connected ? "Conectada" : "Não conectada"}
        </span>
      </div>

      {connected ? (
        <div className={styles.connected}>
          <div className={styles.connectedRow}>
            <code className={styles.masked}>{connection.masked}</code>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondary}
                onClick={handleTest}
                disabled={test.state === "testing"}
              >
                {test.state === "testing" ? "Testando…" : "Testar"}
              </button>
              <button type="button" className={styles.secondary} onClick={handleRemove}>
                Remover
              </button>
            </div>
          </div>
          {test.result && (
            <p className={test.result.startsWith("✓") ? styles.testOk : styles.testFail}>
              {test.result}
            </p>
          )}
        </div>
      ) : (
        <div className={styles.connect}>
          <ol className={styles.steps}>
            <li>
              {help.intro}{" "}
              <a className={styles.link} href={help.keyUrl} target="_blank" rel="noopener noreferrer">
                pegar minha chave
              </a>
            </li>
            {help.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          <label className={styles.fieldLabel} htmlFor={inputId}>
            Chave de API
          </label>
          <div className={styles.inputRow}>
            <input
              id={inputId}
              className={styles.input}
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="Cole sua chave aqui"
              value={value}
              disabled={connecting}
              onChange={(event) => {
                setValue(event.target.value);
                if (connectError) setConnectError(null);
              }}
              aria-invalid={connectError !== null}
            />
            <button
              type="button"
              className={styles.primary}
              onClick={handleConnect}
              disabled={connecting}
            >
              {connecting ? "Verificando…" : "Conectar"}
            </button>
          </div>
          {connectError && <p className={styles.error}>{connectError}</p>}
        </div>
      )}
    </article>
  );
}

// Chama o nosso servidor para conferir a chave. A chave só sai daqui para o nosso próprio endereço.
async function checkKey(provider: ProviderId, apiKey: string): Promise<KeyValidation> {
  try {
    const response = await fetch("/api/keys/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey }),
    });
    if (!response.ok) return { ok: false, reason: "network" };
    return (await response.json()) as KeyValidation;
  } catch {
    return { ok: false, reason: "network" };
  }
}

function messageFor(reason: "invalid" | "rate-limited" | "network", company: string): string {
  switch (reason) {
    case "invalid":
      return `Essa chave não foi aceita pela ${company}. Confira se copiou certo e se é uma chave da ${company}.`;
    case "rate-limited":
      return `A ${company} está ocupada agora. Espere um instante e tente de novo.`;
    case "network":
      return `Não deu para falar com a ${company} agora. Verifique a internet e tente de novo.`;
  }
}

"use client";

// A telinha "Conectar chaves de IA" da visão raio-x: cole a chave de cada IA e salve, sem editar arquivo nenhum. As
// chaves vão para um arquivo local (fora do Git) que só o modo raio-x lê; conectar uma chave já liga a IA real. O valor
// nunca volta para a tela — o botão só mostra quais estão conectadas.

import { useEffect, useState } from "react";
import styles from "./TeamForms.module.css";

type ProviderId = "claude" | "gpt" | "gemini";

const FIELDS: { id: ProviderId; label: string }[] = [
  { id: "claude", label: "Claude (Anthropic)" },
  { id: "gpt", label: "GPT (OpenAI)" },
  { id: "gemini", label: "Gemini (Google)" },
];

const EMPTY = { claude: "", gpt: "", gemini: "" };

export function DemoKeys() {
  const [connected, setConnected] = useState<Record<ProviderId, boolean>>({ claude: false, gpt: false, gemini: false });
  const [values, setValues] = useState<Record<ProviderId, string>>({ ...EMPTY });
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");

  useEffect(() => {
    let active = true;
    fetch("/api/ock/demo-keys")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (active && data?.connected) setConnected(data.connected);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setState("saving");
    // Manda só os campos preenchidos: não apaga uma chave já conectada.
    const payload: Record<string, string> = {};
    for (const { id } of FIELDS) {
      const value = values[id].trim();
      if (value) payload[id] = value;
    }
    try {
      const response = await fetch("/api/ock/demo-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "erro");
      setConnected(data.connected);
      setValues({ ...EMPTY });
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <form
      className={styles.inlineForm}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {FIELDS.map(({ id, label }) => (
        <div key={id} className={styles.field}>
          <label htmlFor={`key-${id}`} className={styles.label}>
            {label} {connected[id] ? "— conectada ✓" : "— não conectada"}
          </label>
          <input
            id={`key-${id}`}
            className={styles.input}
            type="password"
            autoComplete="off"
            placeholder={connected[id] ? "(já conectada — cole para trocar)" : "cole a chave aqui"}
            value={values[id]}
            onChange={(event) => setValues((current) => ({ ...current, [id]: event.target.value }))}
          />
        </div>
      ))}
      {state === "error" && (
        <p className={styles.error} role="alert">
          Não deu para salvar. Tente de novo.
        </p>
      )}
      {state === "done" && (
        <p className={styles.hint} role="status">
          Chaves salvas. A IA real está ligada — é só usar o chat.
        </p>
      )}
      <div className={styles.buttons}>
        <button type="submit" className={styles.smallPrimary} disabled={state === "saving"}>
          {state === "saving" ? "Salvando…" : "Salvar chaves"}
        </button>
      </div>
    </form>
  );
}

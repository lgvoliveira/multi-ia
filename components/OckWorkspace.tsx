"use client";

// A área do FUNCIONÁRIO. Abas:
// - "Chat": vários chats (barra lateral com histórico; "Novo chat"). Cada chat guarda as mensagens para sempre.
//   Descreve a tarefa (pode ANEXAR arquivo), o Chefe escolhe a melhor IA, e a OCK mede o custo.
// - "Painel de entregas": os ARQUIVOS que a IA produziu (PDF, planilha, código, gráfico…) com link para baixar.
// - "Painel de gastos": o uso do funcionário em tokens e o limite dele.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ProviderId } from "@/lib/providers/types";
import { formatTokens, PROVIDER_LABEL, tokensForCents } from "@/lib/ock/pricing";
import styles from "./OckWorkspace.module.css";

interface Route {
  provider: ProviderId;
  effort: "low" | "medium" | "high";
  tier?: "economico" | "padrao" | "potente";
  mode: "rapido" | "projeto";
  reason: string;
}

const TIER_LABEL: Record<"economico" | "padrao" | "potente", string> = {
  economico: "econômico",
  padrao: "padrão",
  potente: "potente",
};

interface Task {
  prompt: string;
  answer: string | null;
  provider: ProviderId;
  tokens: number;
}

interface StoredFile {
  id: string;
  name: string;
  mime: string | null;
  sizeBytes: number | null;
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

interface Delivery {
  id: string;
  name: string;
  createdAt: string;
  url: string | null;
}

type Message =
  | { role: "user"; text: string; files?: string[] }
  | {
      role: "assistant";
      text: string;
      route: Route;
      tokens: number;
      image?: string;
      file?: { name: string; url: string };
      historical?: boolean;
    }
  | { role: "note"; text: string };

const EFFORT_LABEL: Record<Route["effort"], string> = { low: "baixo", medium: "médio", high: "alto" };
const TABS = [
  ["chat", "Chat"],
  ["entregas", "Painel de entregas"],
  ["gasto", "Painel de gastos"],
] as const;
type Tab = (typeof TABS)[number][0];

/** Transforma as tarefas de um chat em bolhas (antigas em cima). */
function hydrate(tasks: Task[]): Message[] {
  const out: Message[] = [];
  for (const task of tasks) {
    out.push({ role: "user", text: task.prompt });
    if (task.answer != null) {
      out.push({
        role: "assistant",
        text: task.answer,
        route: { provider: task.provider, effort: "medium", mode: "rapido", reason: "" },
        tokens: task.tokens,
        historical: true,
      });
    }
  }
  return out;
}

export function OckWorkspace({ memberId }: { memberId: string }) {
  const [name, setName] = useState<string | null>(null);
  const [tokensUsed, setTokensUsed] = useState(0);
  const [budgetCents, setBudgetCents] = useState<number | null>(null);
  const [memberMissing, setMemberMissing] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  const [attached, setAttached] = useState<StoredFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(`/api/ock/conversations?memberId=${memberId}`, { cache: "no-store" });
      if (res.ok) setConversations((((await res.json()) as { conversations?: Conversation[] }).conversations) ?? []);
    } catch {
      // mantém a lista atual
    }
  }, [memberId]);

  const openConversation = useCallback(async (id: string) => {
    setConversationId(id);
    try {
      const res = await fetch(`/api/ock/conversations?conversationId=${id}`, { cache: "no-store" });
      if (res.ok) setMessages(hydrate((((await res.json()) as { tasks?: Task[] }).tasks) ?? []));
    } catch {
      setMessages([]);
    }
  }, []);

  // Carrega o funcionário (nome, limite, total gasto).
  useEffect(() => {
    if (!memberId) return;
    let ignore = false;
    (async () => {
      try {
        const meRes = await fetch(`/api/ock/member?id=${memberId}`, { cache: "no-store" });
        if (meRes.status === 404) {
          if (!ignore) setMemberMissing(true);
          return;
        }
        if (meRes.ok) {
          const data = (await meRes.json()) as { member?: { name: string; budgetCents: number | null }; tasks?: Task[] };
          if (!ignore && data.member) {
            setName(data.member.name);
            setBudgetCents(data.member.budgetCents);
            const t = data.tasks ?? [];
            setTokensUsed(t.reduce((sum, task) => sum + (task.tokens ?? 0), 0));
          }
        }
      } catch {
        // Sem internet: a tela mostra vazio.
      }
    })();
    return () => {
      ignore = true;
    };
  }, [memberId]);

  // Carrega a lista de chats (desacoplada: sobrevive a re-render). O funcionário clica para abrir.
  useEffect(() => {
    if (!memberId) return;
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(`/api/ock/conversations?memberId=${memberId}`, { cache: "no-store" });
        if (!ignore && res.ok) {
          setConversations(((await res.json()) as { conversations?: Conversation[] }).conversations ?? []);
        }
      } catch {
        // mantém a lista atual
      }
    })();
    return () => {
      ignore = true;
    };
  }, [memberId]);

  useEffect(() => {
    if (tab === "chat") listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, tab]);

  useEffect(() => {
    if (tab !== "entregas") return;
    (async () => {
      try {
        const res = await fetch(`/api/ock/deliveries?memberId=${memberId}`, { cache: "no-store" });
        if (res.ok) setDeliveries((((await res.json()) as { deliveries?: Delivery[] }).deliveries) ?? []);
      } catch {
        // mantém
      }
    })();
  }, [tab, memberId]);

  function newChat() {
    setConversationId(null);
    setMessages([]);
    setInput("");
    setAttached([]);
  }

  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("memberId", memberId);
      form.append("file", file);
      const res = await fetch("/api/ock/files", { method: "POST", body: form });
      const data = (await res.json()) as { file?: StoredFile; problem?: string };
      if (res.ok && data.file) {
        setAttached((prev) => [...prev, data.file!]);
      } else {
        setMessages((prev) => [...prev, { role: "note", text: data.problem ?? "Não deu para subir o arquivo." }]);
      }
    } finally {
      setUploading(false);
    }
  }

  async function send() {
    const message = input.trim();
    if ((!message && attached.length === 0) || sending) return;
    const fileIds = attached.map((f) => f.id);
    const fileNames = attached.map((f) => f.name);
    const wasNew = !conversationId;
    setInput("");
    setAttached([]);
    setMessages((prev) => [...prev, { role: "user", text: message, files: fileNames }]);
    setSending(true);
    try {
      const res = await fetch("/api/ock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message || "(ver arquivo anexado)", memberId, fileIds, conversationId }),
      });
      const data = (await res.json()) as {
        route?: Route;
        answer?: string;
        tokens?: number;
        image?: string;
        file?: { name: string; url: string };
        conversationId?: string;
        problem?: string;
      };
      if (res.ok && data.route && typeof data.answer === "string") {
        const tokens = data.tokens ?? 0;
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: data.answer!, route: data.route!, tokens, image: data.image, file: data.file },
        ]);
        setTokensUsed((prev) => prev + tokens);
        if (data.conversationId) {
          setConversationId(data.conversationId);
          if (wasNew) void loadConversations();
        }
      } else {
        setMessages((prev) => [...prev, { role: "note", text: data.problem ?? "Algo deu errado. Tente de novo." }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "note", text: "Não consegui falar com o servidor." }]);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  // Microfone: grava a voz e manda transcrever (Whisper). O texto cai no campo de mensagem.
  async function toggleMic() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size === 0) return;
        setTranscribing(true);
        try {
          const form = new FormData();
          form.append("audio", blob, "audio.webm");
          const res = await fetch("/api/ock/transcribe", { method: "POST", body: form });
          const data = (await res.json()) as { text?: string; problem?: string };
          if (res.ok && data.text) {
            setInput((prev) => (prev ? `${prev} ${data.text}` : (data.text ?? "")).trim());
          } else {
            setMessages((prev) => [...prev, { role: "note", text: data.problem ?? "Não deu para transcrever." }]);
          }
        } catch {
          setMessages((prev) => [...prev, { role: "note", text: "Não consegui transcrever o áudio." }]);
        } finally {
          setTranscribing(false);
        }
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "note", text: "Não consegui acessar o microfone. Permita o acesso no navegador." },
      ]);
    }
  }

  if (!memberId || memberMissing) {
    return (
      <div className={styles.workspace}>
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>Escolha quem é você primeiro.</h2>
          <p className={styles.emptyText}>
            <Link href="/" className={styles.link}>
              Voltar e entrar com seu login
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const tokenLimit = budgetCents != null ? tokensForCents(budgetCents) : null;
  const overLimit = tokenLimit != null && tokensUsed > tokenLimit;

  return (
    <div className={styles.workspace}>
      <header className={styles.bar}>
        <div>
          <p className={styles.barLabel}>Trabalhando como</p>
          <p className={styles.who}>{name ?? "…"}</p>
        </div>
      </header>

      <div className={styles.tabs}>
        {TABS.map(([id, label]) => (
          <button key={id} type="button" className={styles.tab} data-active={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "chat" && (
        <div className={styles.chatLayout}>
          <aside className={styles.sidebar}>
            <button type="button" className={styles.newChat} onClick={newChat}>
              + Novo chat
            </button>
            <div className={styles.convList}>
              {conversations.length === 0 && <p className={styles.convEmpty}>Seus chats aparecem aqui.</p>}
              {conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={styles.convItem}
                  data-active={c.id === conversationId}
                  onClick={() => void openConversation(c.id)}
                  title={c.title}
                >
                  {c.title}
                </button>
              ))}
            </div>
          </aside>

          <div className={styles.chatMain}>
            <div className={styles.list} ref={listRef}>
              {messages.length === 0 && (
                <div className={styles.empty}>
                  <h2 className={styles.emptyTitle}>Descreva a tarefa. O Chefe cuida do resto.</h2>
                  <p className={styles.emptyText}>
                    Você pede em português normal; o Chefe escolhe a IA mais eficiente e mostra quanto custou. Pode{" "}
                    <strong>anexar um arquivo</strong> (📎), pedir um <strong>PDF, planilha, gráfico ou código</strong>.
                  </p>
                </div>
              )}
              {messages.map((msg, index) => (
                <MessageRow key={index} message={msg} />
              ))}
              {sending && <div className={styles.thinking}>O Chefe está decidindo quem faz e executando…</div>}
            </div>

            {attached.length > 0 && (
              <div className={styles.attached}>
                {attached.map((f) => (
                  <span key={f.id} className={styles.chip}>
                    📎 {f.name}
                    <button
                      type="button"
                      className={styles.chipX}
                      onClick={() => setAttached((prev) => prev.filter((x) => x.id !== f.id))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className={styles.composer}>
              <input
                ref={chatFileRef}
                type="file"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                  e.target.value = "";
                }}
              />
              <textarea
                className={styles.input}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder={
                  recording
                    ? "Gravando… toque no microfone para parar"
                    : transcribing
                      ? "Transcrevendo…"
                      : "O que você precisa? Ex.: gere um PDF, faça um gráfico, escreva o código de um site…"
                }
                rows={2}
                disabled={sending}
              />
              <div className={styles.composerBar}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => chatFileRef.current?.click()}
                  disabled={uploading}
                  title="Anexar arquivo"
                  aria-label="Anexar arquivo"
                >
                  <PlusIcon />
                </button>
                <div className={styles.grow} />
                <button
                  type="button"
                  className={styles.iconBtn}
                  data-recording={recording}
                  onClick={() => void toggleMic()}
                  disabled={transcribing}
                  title={recording ? "Parar gravação" : "Falar"}
                  aria-label="Microfone"
                >
                  <MicIcon />
                </button>
                <button
                  type="button"
                  className={styles.sendBtn}
                  onClick={() => void send()}
                  disabled={sending || (!input.trim() && attached.length === 0)}
                  title="Enviar"
                  aria-label="Enviar"
                >
                  <SendIcon />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "entregas" && (
        <div className={styles.list}>
          <p className={styles.emptyHint}>
            Tudo que a IA produziu para você — PDF, planilha, Word, código (.zip), gráficos. Clique para baixar.
          </p>
          {deliveries.length === 0 && <p className={styles.emptyHint}>Nenhuma entrega ainda.</p>}
          {deliveries.map((d) => (
            <div key={d.id} className={styles.deliveryRow}>
              <span className={styles.deliveryName}>📄 {d.name}</span>
              <span className={styles.deliveryDate}>{new Date(d.createdAt).toLocaleString("pt-BR")}</span>
              {d.url && (
                <a className={styles.openLink} href={d.url} target="_blank" rel="noopener noreferrer" download={d.name}>
                  Baixar
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "gasto" && (
        <div className={styles.list}>
          <div className={styles.usageCard}>
            <div className={styles.usageTop}>
              <div>
                <span className={styles.barLabel}>Tokens usados</span>
                <span className={styles.usageValue} data-over={overLimit}>
                  {formatTokens(tokensUsed)}
                </span>
              </div>
              <div className={styles.usageRight}>
                <span className={styles.barLabel}>Seu limite</span>
                <span className={styles.usageLimit}>
                  {tokenLimit != null ? `${formatTokens(tokenLimit)} tokens` : "sem limite"}
                </span>
              </div>
            </div>
            {tokenLimit != null && (
              <div className={styles.usageTrack}>
                <div
                  className={styles.usageFill}
                  data-over={overLimit}
                  style={{ width: `${Math.min(100, (tokensUsed / tokenLimit) * 100)}%` }}
                />
              </div>
            )}
            <p className={styles.usageNote}>Limite em tokens é uma estimativa (o preço do token varia por IA).</p>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageRow({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className={`${styles.row} ${styles.rowUser}`}>
        <div className={styles.bubbleUser}>
          {message.files && message.files.length > 0 && (
            <div className={styles.bubbleFiles}>{message.files.map((n) => `📎 ${n}`).join("  ")}</div>
          )}
          {message.text}
        </div>
      </div>
    );
  }
  if (message.role === "note") {
    return <div className={styles.note}>{message.text}</div>;
  }
  const { route, tokens, text } = message;
  return (
    <div className={`${styles.row} ${styles.rowAssistant}`}>
      <div className={styles.bubbleAssistant}>
        <div className={styles.routeBadge}>
          <span className={styles.aiDot} data-ai={route.provider} />
          <span className={styles.routeText}>
            {message.historical ? (
              <>
                Feito por <strong>{PROVIDER_LABEL[route.provider]}</strong>
              </>
            ) : (
              <>
                Chefe escolheu <strong>{PROVIDER_LABEL[route.provider]}</strong>
                {route.tier ? ` ${TIER_LABEL[route.tier]}` : ""} (esforço {EFFORT_LABEL[route.effort]})
                {route.mode === "projeto" ? " · modo projeto" : ""}
              </>
            )}
          </span>
          <span className={styles.cost}>{formatTokens(tokens)} tok</span>
        </div>
        {route.reason && <p className={styles.reason}>{route.reason}</p>}
        <div className={styles.answer}>{text}</div>
        {message.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.genImage} src={message.image} alt="Imagem gerada pela IA" />
        )}
        {message.file && (
          <a
            className={styles.fileDownload}
            href={message.file.url}
            target="_blank"
            rel="noopener noreferrer"
            download={message.file.name}
          >
            ⬇️ Baixar {message.file.name}
          </a>
        )}
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

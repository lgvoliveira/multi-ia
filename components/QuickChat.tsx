"use client";

// O chat da tarefa rápida: as conversas ao lado, as mensagens e a caixa de escrever, com anexos. A pessoa pede, o
// Chefe escolhe a IA, e cada resposta mostra quem fez e quanto custou (no chat não há estimativa antes de mandar,
// decisão do Luis de 25/10/2026, issue #39). Mandar e anexar levam o id de quem abriu a página: se o login do navegador
// mudou em outra aba, o servidor não faz nada e a tela mostra o aviso (F34). Com o chat vazio, as receitas prontas
// aparecem como sugestão: escolher uma abre a receita na aba Receitas.

import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { AiDot } from "@/components/AiDot";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENTS_CUT_NOTICE,
  ATTACHMENTS_ONLY_PROMPT,
  MAX_ATTACHMENTS,
  MAX_MESSAGE_CHARS,
  MAX_VOICE_SECONDS,
  type ChatConversation,
  type ChatFile,
  type ChatTask,
  type MonthSpending,
} from "@/lib/ock/chat";
import { fileUrl, loadConversation, sendMessage, transcribeAudio, uploadAttachment } from "@/lib/ock/chat-client";
import type { RecipeSummary } from "@/lib/recipes/types";
import styles from "./QuickChat.module.css";

interface QuickChatProps {
  pageMemberId: string;
  initialConversations: ChatConversation[];
  /** Avisado quando o gasto do mês muda (depois de cada resposta). */
  onMonthChange: (month: MonthSpending) => void;
  /** As receitas prontas, sugeridas com o chat vazio. */
  recipeSuggestions: RecipeSummary[];
  onOpenRecipe: (recipeId: string) => void;
  /** Se a voz está ligada (OCK_AI_TOOLS): mostra o botão Ditar. */
  voice: boolean;
}

/** Uma mensagem na tela: já respondida, ou esperando a resposta. */
type Entry =
  | { kind: "task"; task: ChatTask }
  | { kind: "pending"; id: number; prompt: string; attachments: ChatFile[] };

export function QuickChat({
  pageMemberId,
  initialConversations,
  onMonthChange,
  recipeSuggestions,
  onOpenRecipe,
  voice,
}: QuickChatProps) {
  const ids = useId();
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [opening, setOpening] = useState(false);
  const [message, setMessage] = useState("");
  const [attached, setAttached] = useState<ChatFile[]>([]);
  const [uploading, setUploading] = useState(0);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // A gravação do ditado: o gravador do navegador, os pedaços do áudio e o relógio.
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const clockRef = useRef<number | null>(null);
  // Cada conversa aberta ganha um número: a resposta de uma conversa que a pessoa já trocou é ignorada.
  const openTicket = useRef(0);
  const pendingCounter = useRef(0);

  // Saindo da página no meio de um ditado: o microfone desliga e nada é enviado.
  useEffect(
    () => () => {
      if (clockRef.current !== null) window.clearInterval(clockRef.current);
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
        recorder.stream.getTracks().forEach((track) => track.stop());
      }
    },
    [],
  );

  // A lista acompanha a mensagem mais nova. Sem mensagens, fica no alto: o começo do chat vazio não some.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = entries.length > 0 ? list.scrollHeight : 0;
  }, [entries, sending]);

  async function openConversation(id: string) {
    if (sending || id === activeId) return;
    const ticket = ++openTicket.current;
    setActiveId(id);
    setEntries([]);
    setProblem(null);
    setOpening(true);
    const result = await loadConversation(id);
    if (ticket !== openTicket.current) return;
    setOpening(false);
    if (result.ok) {
      setEntries(result.data.tasks.map((task) => ({ kind: "task", task })));
    } else {
      setProblem(result.problem);
    }
  }

  function startNewChat() {
    if (sending) return;
    openTicket.current++;
    setActiveId(null);
    setEntries([]);
    setProblem(null);
    setOpening(false);
    inputRef.current?.focus();
  }

  async function attachFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    setProblem(null);
    let count = attached.length;
    for (const file of files) {
      if (count >= MAX_ATTACHMENTS) {
        setProblem(`Dá para anexar até ${MAX_ATTACHMENTS} arquivos por mensagem.`);
        break;
      }
      count++;
      setUploading((current) => current + 1);
      const result = await uploadAttachment(file, pageMemberId);
      setUploading((current) => current - 1);
      if (result.ok) {
        setAttached((current) => [...current, result.data]);
      } else {
        count--;
        setProblem(`${file.name}: ${result.problem}`);
      }
    }
  }

  /** Começa a gravar o ditado. O navegador pede licença para usar o microfone na primeira vez. */
  async function startDictation() {
    setProblem(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setProblem("Este navegador não grava áudio. Escreva a mensagem ou use outro navegador.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setProblem("Não deu para usar o microfone. Libere o microfone para este site no navegador e tente de novo.");
      return;
    }
    const recorder = new MediaRecorder(stream);
    audioChunks.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunks.current.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      void finishDictation(new Blob(audioChunks.current, { type: recorder.mimeType || "audio/webm" }));
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
    setRecordedSeconds(0);
    setAnnouncement("Gravando. Fale e aperte Parar quando terminar.");
    const startedAt = Date.now();
    clockRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setRecordedSeconds(elapsed);
      // No limite, para sozinho e transcreve o que foi gravado.
      if (elapsed >= MAX_VOICE_SECONDS) stopDictation();
    }, 250);
  }

  function stopDictation() {
    if (clockRef.current !== null) {
      window.clearInterval(clockRef.current);
      clockRef.current = null;
    }
    setRecording(false);
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  /** Manda o áudio para transcrever e põe o texto na caixa, para a pessoa revisar antes de enviar. */
  async function finishDictation(audio: Blob) {
    if (audio.size === 0) {
      setProblem("O áudio veio vazio. Grave de novo.");
      return;
    }
    setTranscribing(true);
    setAnnouncement("Transcrevendo o que você disse…");
    const result = await transcribeAudio(audio, pageMemberId);
    setTranscribing(false);
    if (!result.ok) {
      setProblem(result.problem);
      setAnnouncement(result.problem);
      return;
    }
    const { text, month } = result.data;
    setMessage((current) => (current.trim() ? `${current.trimEnd()} ${text}` : text).slice(0, MAX_MESSAGE_CHARS));
    onMonthChange(month);
    setAnnouncement("Texto ditado. Revise e envie.");
    inputRef.current?.focus();
  }

  async function send() {
    const text = message.trim();
    if (sending || uploading > 0 || (!text && attached.length === 0)) return;
    const files = attached;
    const pendingId = ++pendingCounter.current;
    setEntries((current) => [
      ...current,
      { kind: "pending", id: pendingId, prompt: text || ATTACHMENTS_ONLY_PROMPT, attachments: files },
    ]);
    setMessage("");
    setAttached([]);
    setProblem(null);
    setSending(true);
    setAnnouncement("Mensagem enviada. O Chefe está escolhendo quem responde.");

    const result = await sendMessage({ message: text, conversationId: activeId, fileIds: files.map((f) => f.id), pageMemberId });
    setSending(false);
    if (!result.ok) {
      // Nada foi guardado: a mensagem volta para a caixa, para mandar de novo.
      setEntries((current) => current.filter((entry) => !(entry.kind === "pending" && entry.id === pendingId)));
      setMessage(text);
      setAttached(files);
      setProblem(result.problem);
      setAnnouncement(result.problem);
      return;
    }

    const { conversation, task, month } = result.data;
    setEntries((current) =>
      current.map((entry) => (entry.kind === "pending" && entry.id === pendingId ? { kind: "task", task } : entry)),
    );
    setActiveId(conversation.id);
    setConversations((current) => [conversation, ...current.filter((item) => item.id !== conversation.id)]);
    onMonthChange(month);
    setAnnouncement(
      task.status === "finished" ? "Resposta pronta." : (task.answer ?? "A resposta não veio."),
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter manda; Shift + Enter pula linha. Durante a escrita com acento (IME), o Enter não conta.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  }

  const dictating = recording || transcribing;
  const canSend = !sending && uploading === 0 && !dictating && (message.trim().length > 0 || attached.length > 0);
  const inputId = `${ids}-message`;

  return (
    <div className={styles.layout}>
      <nav className={styles.sidebar} aria-label="Suas conversas">
        <button type="button" className={styles.newChat} onClick={startNewChat} disabled={sending}>
          + Novo chat
        </button>
        {conversations.length === 0 ? (
          <p className={styles.sidebarEmpty}>Suas conversas aparecem aqui.</p>
        ) : (
          <ul className={styles.conversationList}>
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <button
                  type="button"
                  className={styles.conversation}
                  aria-current={conversation.id === activeId ? "true" : undefined}
                  title={conversation.title}
                  onClick={() => void openConversation(conversation.id)}
                  disabled={sending}
                >
                  {conversation.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>

      <section className={styles.main} aria-label="Conversa">
        <div className={styles.messages} ref={listRef} tabIndex={0} aria-label="Mensagens da conversa">
          {entries.length === 0 && !opening && (
            <EmptyChat suggestions={recipeSuggestions} onOpenRecipe={onOpenRecipe} />
          )}
          {opening && <p className={styles.status}>Abrindo a conversa…</p>}
          <ol className={styles.turns}>
            {entries.map((entry) =>
              entry.kind === "task" ? (
                <TaskTurn key={entry.task.id} task={entry.task} />
              ) : (
                <li key={`pending-${entry.id}`} className={styles.turn}>
                  <UserBubble prompt={entry.prompt} attachments={entry.attachments} />
                  <p className={styles.thinking}>O Chefe está escolhendo quem responde…</p>
                </li>
              ),
            )}
          </ol>
        </div>

        {problem && (
          <p className={styles.problem} role="alert">
            {problem}
          </p>
        )}

        <form
          className={styles.composer}
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <label htmlFor={inputId} className={styles.visuallyHidden}>
            Mensagem para o Chefe
          </label>
          <textarea
            id={inputId}
            ref={inputRef}
            className={styles.input}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={MAX_MESSAGE_CHARS}
            rows={2}
            placeholder="O que você precisa? Ex.: escreva um e-mail, gere um PDF, faça um gráfico…"
          />
          {(attached.length > 0 || uploading > 0) && (
            <ul className={styles.attachedList} aria-label="Arquivos anexados">
              {attached.map((file) => (
                <li key={file.id} className={styles.chip}>
                  <span className={styles.chipName}>{file.name}</span>
                  <button
                    type="button"
                    className={styles.chipRemove}
                    onClick={() => setAttached((current) => current.filter((item) => item.id !== file.id))}
                    aria-label={`Tirar ${file.name}`}
                    disabled={sending}
                  >
                    ×
                  </button>
                </li>
              ))}
              {uploading > 0 && <li className={styles.chip}>Anexando…</li>}
            </ul>
          )}
          <div className={styles.composerBar}>
            <input
              ref={fileInputRef}
              type="file"
              className={styles.visuallyHidden}
              accept={ATTACHMENT_ACCEPT}
              multiple
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => void attachFiles(event)}
            />
            <button
              type="button"
              className={styles.attach}
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || attached.length + uploading >= MAX_ATTACHMENTS}
            >
              Anexar arquivo
            </button>
            {voice && (
              <button
                type="button"
                className={styles.iconButton}
                onClick={recording ? stopDictation : () => void startDictation()}
                disabled={sending || transcribing}
                aria-pressed={recording}
                aria-label={recording ? "Parar a gravação" : "Ditar por voz"}
                title={recording ? "Parar" : "Ditar por voz"}
              >
                {recording ? (
                  <>
                    <StopIcon /> {clock(recordedSeconds)}
                  </>
                ) : transcribing ? (
                  "…"
                ) : (
                  <MicIcon />
                )}
              </button>
            )}
            <button type="submit" className={styles.send} disabled={!canSend}>
              {sending ? "Respondendo…" : "Enviar"}
            </button>
          </div>
        </form>

        <p className={styles.visuallyHidden} aria-live="polite">
          {announcement}
        </p>
      </section>
    </div>
  );
}

/** O tempo do ditado, como num relógio: 75 → "1:15". */
function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Quantas receitas o chat vazio sugere, no máximo. */
const MAX_SUGGESTIONS = 3;

function EmptyChat({
  suggestions,
  onOpenRecipe,
}: {
  suggestions: RecipeSummary[];
  onOpenRecipe: (recipeId: string) => void;
}) {
  const shown = suggestions.slice(0, MAX_SUGGESTIONS);
  return (
    <div className={styles.empty}>
      <h2 className={styles.emptyTitle}>Descreva a tarefa. O Chefe cuida do resto.</h2>
      <p className={styles.emptyText}>
        Peça em português normal e o time de IAs resolve para você. Dá para anexar um arquivo e pedir um PDF, uma
        planilha, um gráfico ou um projeto em .zip.
      </p>
      {shown.length > 0 && (
        <div className={styles.suggestions}>
          <h3 className={styles.suggestionsTitle}>Ou use uma receita pronta:</h3>
          <ul className={styles.suggestionList}>
            {shown.map((recipe) => (
              <li key={recipe.id}>
                <button type="button" className={styles.suggestion} onClick={() => onOpenRecipe(recipe.id)}>
                  <span className={styles.suggestionName}>{recipe.name}</span>
                  <span className={styles.suggestionText}>{recipe.description}</span>
                  {/* As cores do time são enfeite: o time aparece escrito ao abrir a receita. */}
                  <span className={styles.suggestionTeam}>
                    {recipe.team.map((member) => (
                      <AiDot key={member.roleName} provider={member.provider} />
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TaskTurn({ task }: { task: ChatTask }) {
  return (
    <li className={styles.turn}>
      <UserBubble prompt={task.prompt} attachments={task.attachments} />
      {task.status === "finished" && <Answer task={task} />}
      {/* Ainda respondendo (mandada de outra aba, por exemplo): a resposta aparece ao abrir a conversa de novo. */}
      {task.status === "running" && (
        <p className={styles.thinking}>Respondendo… Abra a conversa de novo daqui a pouco para ver a resposta.</p>
      )}
      {task.status === "failed" && (
        <p className={styles.failed}>{task.answer ?? "Esta resposta não chegou. Nada foi cobrado."}</p>
      )}
    </li>
  );
}

function UserBubble({ prompt, attachments }: { prompt: string; attachments: ChatFile[] }) {
  return (
    <div className={styles.user}>
      {attachments.length > 0 && (
        <p className={styles.userFiles}>Anexos: {attachments.map((file) => file.name).join(", ")}</p>
      )}
      <p className={styles.userText}>{prompt}</p>
    </div>
  );
}

function Answer({ task }: { task: ChatTask }) {
  // O funcionário não vê qual IA respondeu nem o custo (isso é do painel do dono): só a resposta.
  return (
    <article className={styles.answer}>
      {task.notice && <p className={styles.notice}>{task.notice}</p>}
      {task.attachmentsCut && <p className={styles.notice}>{ATTACHMENTS_CUT_NOTICE}</p>}
      <p className={styles.answerText}>{task.answer}</p>
      {task.chart && (
        // O gráfico (ou a imagem criada pela IA) vai dentro de uma imagem: assim, nada dele roda na nossa página.
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.chart} src={task.chart} alt={task.answer ?? "Gráfico feito pela IA"} />
      )}
      {task.deliveries.length > 0 && (
        <ul className={styles.downloads}>
          {task.deliveries.map((file) => (
            <li key={file.id}>
              <a className={styles.download} href={fileUrl(file.id)} download={file.name}>
                Baixar {file.name}
              </a>
            </li>
          ))}
        </ul>
      )}
      {task.answer?.trim() && (
        <div className={styles.answerTools}>
          <SpeakButton text={task.answer} />
        </div>
      )}
    </article>
  );
}

/** Botão "Ouvir": pede o áudio da resposta (TTS no servidor) e toca. Clicar de novo para. */
function SpeakButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  async function toggle() {
    if (state === "playing") {
      cleanup();
      setState("idle");
      return;
    }
    if (state === "loading") return;
    setState("loading");
    try {
      const res = await fetch("/api/ock/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        setState("idle");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        cleanup();
        setState("idle");
      };
      audio.onerror = () => {
        cleanup();
        setState("idle");
      };
      await audio.play();
      setState("playing");
    } catch {
      cleanup();
      setState("idle");
    }
  }

  return (
    <button
      type="button"
      className={styles.speakBtn}
      onClick={() => void toggle()}
      disabled={state === "loading"}
      title={state === "playing" ? "Parar" : "Ouvir a resposta"}
      aria-label={state === "playing" ? "Parar a leitura" : "Ouvir a resposta"}
    >
      {state === "playing" ? <StopIcon /> : <SpeakerIcon />}
      <span className={styles.speakLabel}>
        {state === "loading" ? "Gerando…" : state === "playing" ? "Parar" : "Ouvir"}
      </span>
    </button>
  );
}

function SpeakerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8" />
    </svg>
  );
}

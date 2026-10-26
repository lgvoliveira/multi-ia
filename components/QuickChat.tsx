"use client";

// O chat da tarefa rápida: as conversas ao lado, as mensagens e a caixa de escrever, com anexos. A pessoa pede, o
// Chefe escolhe a IA, e cada resposta mostra quem fez e quanto custou (no chat não há estimativa antes de mandar,
// decisão do Luis de 25/10/2026, issue #39). Mandar e anexar levam o id de quem abriu a página: se o login do navegador
// mudou em outra aba, o servidor não faz nada e a tela mostra o aviso (F34). Com o chat vazio, as receitas prontas
// aparecem como sugestão: escolher uma abre a receita na aba Receitas.

import { useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { AiDot } from "@/components/AiDot";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENTS_CUT_NOTICE,
  ATTACHMENTS_ONLY_PROMPT,
  EFFORT_LABEL,
  MAX_ATTACHMENTS,
  MAX_MESSAGE_CHARS,
  TIER_LABEL,
  type ChatConversation,
  type ChatFile,
  type ChatTask,
  type MonthSpending,
} from "@/lib/ock/chat";
import { fileUrl, loadConversation, sendMessage, uploadAttachment } from "@/lib/ock/chat-client";
import { formatBRL } from "@/lib/ock/pricing";
import { getProviderInfo } from "@/lib/providers/catalog";
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
  const [problem, setProblem] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Cada conversa aberta ganha um número: a resposta de uma conversa que a pessoa já trocou é ignorada.
  const openTicket = useRef(0);
  const pendingCounter = useRef(0);

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
      task.status === "finished" ? `Resposta pronta. ${costLabel(task.costCents)}.` : (task.answer ?? "A resposta não veio."),
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter manda; Shift + Enter pula linha. Durante a escrita com acento (IME), o Enter não conta.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  }

  const canSend = !sending && uploading === 0 && (message.trim().length > 0 || attached.length > 0);
  const atLimit = message.length >= MAX_MESSAGE_CHARS;
  const inputId = `${ids}-message`;
  const counterId = `${ids}-counter`;

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
            aria-describedby={counterId}
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
            <span id={counterId} className={styles.counter} data-full={atLimit}>
              {formatNumber(message.length)}/{formatNumber(MAX_MESSAGE_CHARS)} caracteres
            </span>
            <button type="submit" className={styles.send} disabled={!canSend}>
              {sending ? "Respondendo…" : "Enviar"}
            </button>
          </div>
          <p className={styles.hint}>PDF, texto (.txt, .csv, .md, .json) ou imagem, até 5 arquivos de 10 MB.</p>
        </form>

        <p className={styles.visuallyHidden} aria-live="polite">
          {announcement}
        </p>
      </section>
    </div>
  );
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
        Peça em português normal: o Chefe escolhe a IA que resolve melhor pelo menor custo, e cada resposta mostra quanto
        custou. Dá para anexar um arquivo e pedir um PDF, uma planilha, um gráfico ou um projeto em .zip.
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
  // O pedido de imagem não passou por nenhuma IA: não tem "feito por".
  const madeByAi = task.action !== "imagem";
  return (
    <article className={styles.answer}>
      <div className={styles.byline}>
        {madeByAi && (
          <span className={styles.who}>
            <AiDot provider={task.provider} size="large" />
            <span>
              {task.reason ? "O Chefe escolheu " : "Feito por "}
              <strong>{getProviderInfo(task.provider).name}</strong> ({TIER_LABEL[task.tier]}, esforço{" "}
              {EFFORT_LABEL[task.effort]})
            </span>
          </span>
        )}
        <span className={styles.cost}>{costLabel(task.costCents)}</span>
      </div>
      {task.reason && <p className={styles.reason}>{task.reason}</p>}
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
    </article>
  );
}

function costLabel(cents: number): string {
  return cents > 0 ? `Custou ${formatBRL(cents)}` : "Sem custo";
}

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

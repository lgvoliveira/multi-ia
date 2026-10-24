"use client";

// Os botões do cartão de cada funcionário no painel do dono: mudar o teto, gerar um link novo (para quem não aceitou o
// convite ou perdeu a senha) e desativar ou reativar. Cada ação é conferida de novo no servidor (app/dono/actions.ts).

import { useActionState, useState } from "react";
import { newLinkAction, setStatusAction, updateBudgetAction } from "@/app/dono/actions";
import { firstName } from "@/lib/auth/member";
import type { MemberActionState } from "@/lib/ock/team-forms";
import { InviteLinkPanel } from "./InviteLinkPanel";
import styles from "./TeamForms.module.css";

const IDLE: MemberActionState = { status: "idle" };

interface MemberActionsProps {
  memberId: string;
  name: string;
  status: "active" | "disabled";
  /** O teto atual como aparece no campo ("50,00"; vazio = sem teto). */
  budgetInput: string;
}

type Mode = "buttons" | "budget" | "disable" | "link";

export function MemberActions({ memberId, name, status, budgetInput }: MemberActionsProps) {
  const [mode, setMode] = useState<Mode>("buttons");
  const back = () => setMode("buttons");

  if (mode === "budget") return <BudgetForm memberId={memberId} budgetInput={budgetInput} onDone={back} />;
  if (mode === "disable") return <DisableConfirm memberId={memberId} name={name} onDone={back} />;
  if (mode === "link") return <NewLink memberId={memberId} name={name} onDone={back} />;

  return (
    <div className={styles.buttons}>
      <button type="button" className={styles.smallButton} onClick={() => setMode("budget")}>
        Mudar teto
      </button>
      {status === "active" ? (
        <>
          <button type="button" className={styles.smallButton} onClick={() => setMode("link")}>
            Gerar link novo
          </button>
          <button type="button" className={styles.smallButton} onClick={() => setMode("disable")}>
            Desativar
          </button>
        </>
      ) : (
        <Reactivate memberId={memberId} />
      )}
    </div>
  );
}

function ErrorMessage({ state }: { state: MemberActionState }) {
  return state.status === "error" ? (
    <p className={styles.error} role="alert">
      {state.message}
    </p>
  ) : null;
}

function BudgetForm({ memberId, budgetInput, onDone }: { memberId: string; budgetInput: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(async (previous: MemberActionState, formData: FormData) => {
    const result = await updateBudgetAction(previous, formData);
    if (result.status === "done") onDone();
    return result;
  }, IDLE);
  const inputId = `budget-${memberId}`;

  return (
    <form className={styles.inlineForm} action={formAction} noValidate>
      <input type="hidden" name="memberId" value={memberId} />
      <div className={styles.field}>
        <label htmlFor={inputId} className={styles.label}>
          Teto do mês (R$)
        </label>
        <input
          id={inputId}
          name="budget"
          className={styles.input}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={budgetInput}
          aria-describedby={`${inputId}-hint`}
          autoFocus
        />
        <p id={`${inputId}-hint`} className={styles.hint}>
          Vazio = sem teto. Vale para os gastos deste mês, desde o dia 1º.
        </p>
      </div>
      <ErrorMessage state={state} />
      <div className={styles.buttons}>
        <button type="submit" className={styles.smallPrimary} disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </button>
        <button type="button" className={styles.smallButton} onClick={onDone}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function DisableConfirm({ memberId, name, onDone }: { memberId: string; name: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(async (previous: MemberActionState, formData: FormData) => {
    const result = await setStatusAction(previous, formData);
    if (result.status === "done") onDone();
    return result;
  }, IDLE);
  const first = firstName(name);

  return (
    <form className={styles.inlineForm} action={formAction}>
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="status" value="disabled" />
      <p className={styles.confirmText}>
        Desativar {first}? O acesso para na hora. O que já foi feito e gasto continua registrado, e dá para reativar
        depois.
      </p>
      <ErrorMessage state={state} />
      <div className={styles.buttons}>
        <button type="submit" className={styles.smallDanger} disabled={pending}>
          {pending ? "Desativando…" : `Desativar ${first}`}
        </button>
        <button type="button" className={styles.smallButton} onClick={onDone}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function NewLink({ memberId, name, onDone }: { memberId: string; name: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(newLinkAction, IDLE);

  if (state.status === "link") return <InviteLinkPanel name={name} link={state.link} kind={state.kind} onClose={onDone} />;

  return (
    <form className={styles.inlineForm} action={formAction}>
      <input type="hidden" name="memberId" value={memberId} />
      <p className={styles.confirmText}>
        Gerar um link novo para {firstName(name)}? Serve para quem não aceitou o convite a tempo ou perdeu a senha. O
        link anterior para de valer; a senha atual continua valendo até o link novo ser usado.
      </p>
      <ErrorMessage state={state} />
      <div className={styles.buttons}>
        <button type="submit" className={styles.smallPrimary} disabled={pending}>
          {pending ? "Gerando…" : "Gerar o link"}
        </button>
        <button type="button" className={styles.smallButton} onClick={onDone}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Reactivate({ memberId }: { memberId: string }) {
  const [state, formAction, pending] = useActionState(setStatusAction, IDLE);
  return (
    <form action={formAction} className={styles.inlineForm}>
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="status" value="active" />
      <button type="submit" className={styles.smallButton} disabled={pending}>
        {pending ? "Reativando…" : "Reativar"}
      </button>
      <ErrorMessage state={state} />
    </form>
  );
}

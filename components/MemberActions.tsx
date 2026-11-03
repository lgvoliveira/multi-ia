"use client";

// Os botões do cartão de cada funcionário no painel do dono: mudar o teto, gerar um link novo (para quem não aceitou o
// convite ou perdeu a senha) e desativar ou reativar. Cada ação é conferida de novo no servidor (app/dono/actions.ts).

import { useActionState, useState } from "react";
import { newLinkAction, setStatusAction, updateBudgetAction } from "@/app/dono/actions";
import { firstName } from "@/lib/auth/member";
import { PAGE_OWNER_FIELD, type MemberActionState } from "@/lib/ock/team-forms";
import { InviteLinkPanel } from "./InviteLinkPanel";
import styles from "./TeamForms.module.css";

const IDLE: MemberActionState = { status: "idle" };

/** A pessoa do cartão e o dono que abriu o painel (o servidor confere se o login do navegador ainda é o dele). */
interface Ids {
  memberId: string;
  ownerId: string;
}

interface MemberActionsProps extends Ids {
  name: string;
  status: "active" | "disabled";
  /** O teto atual como aparece no campo ("50,00"; vazio = sem teto). */
  budgetInput: string;
}

type Mode = "buttons" | "budget" | "disable" | "link";

export function MemberActions({ memberId, ownerId, name, status, budgetInput }: MemberActionsProps) {
  const [mode, setMode] = useState<Mode>("buttons");
  const back = () => setMode("buttons");
  const ids = { memberId, ownerId };

  if (mode === "budget") return <BudgetForm ids={ids} budgetInput={budgetInput} onDone={back} />;
  if (mode === "disable") return <DisableConfirm ids={ids} name={name} onDone={back} />;
  if (mode === "link") return <NewLink ids={ids} name={name} onDone={back} />;

  return (
    <div className={styles.buttons}>
      <button type="button" className={styles.smallButton} onClick={() => setMode("budget")}>
        Mudar teto
      </button>
      {status === "active" ? (
        <>
          <button type="button" className={styles.smallButton} onClick={() => setMode("link")}>
            Gerar senha nova
          </button>
          <button type="button" className={styles.smallButton} onClick={() => setMode("disable")}>
            Desativar
          </button>
        </>
      ) : (
        <Reactivate ids={ids} />
      )}
    </div>
  );
}

function HiddenIds({ ids }: { ids: Ids }) {
  return (
    <>
      <input type="hidden" name="memberId" value={ids.memberId} />
      <input type="hidden" name={PAGE_OWNER_FIELD} value={ids.ownerId} />
    </>
  );
}

function ErrorMessage({ state }: { state: MemberActionState }) {
  return state.status === "error" ? (
    <p className={styles.error} role="alert">
      {state.message}
    </p>
  ) : null;
}

function BudgetForm({ ids, budgetInput, onDone }: { ids: Ids; budgetInput: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(async (previous: MemberActionState, formData: FormData) => {
    const result = await updateBudgetAction(previous, formData);
    if (result.status === "done") onDone();
    return result;
  }, IDLE);
  const inputId = `budget-${ids.memberId}`;

  return (
    <form className={styles.inlineForm} action={formAction} noValidate>
      <HiddenIds ids={ids} />
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

function DisableConfirm({ ids, name, onDone }: { ids: Ids; name: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(async (previous: MemberActionState, formData: FormData) => {
    const result = await setStatusAction(previous, formData);
    if (result.status === "done") onDone();
    return result;
  }, IDLE);
  const first = firstName(name);

  return (
    <form className={styles.inlineForm} action={formAction}>
      <HiddenIds ids={ids} />
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

function NewLink({ ids, name, onDone }: { ids: Ids; name: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(newLinkAction, IDLE);

  if (state.status === "credentials") {
    return <InviteLinkPanel name={name} email={state.email} tempPassword={state.tempPassword} reset onClose={onDone} />;
  }

  return (
    <form className={styles.inlineForm} action={formAction}>
      <HiddenIds ids={ids} />
      <p className={styles.confirmText}>
        Gerar uma senha temporária nova para {firstName(name)}? Serve para quem perdeu a senha. A senha atual deixa de
        valer, e a pessoa cria uma própria no primeiro acesso.
      </p>
      <ErrorMessage state={state} />
      <div className={styles.buttons}>
        <button type="submit" className={styles.smallPrimary} disabled={pending}>
          {pending ? "Gerando…" : "Gerar a senha"}
        </button>
        <button type="button" className={styles.smallButton} onClick={onDone}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Reactivate({ ids }: { ids: Ids }) {
  const [state, formAction, pending] = useActionState(setStatusAction, IDLE);
  return (
    <form action={formAction} className={styles.inlineForm}>
      <HiddenIds ids={ids} />
      <input type="hidden" name="status" value="active" />
      <button type="submit" className={styles.smallButton} disabled={pending}>
        {pending ? "Reativando…" : "Reativar"}
      </button>
      <ErrorMessage state={state} />
    </form>
  );
}

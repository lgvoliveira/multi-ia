// Convites dos funcionários (decisão do Luis, 24/10/2026): o dono gera um link que vale 24 horas e funciona uma vez
// só, e manda para a pessoa (ex.: pelo WhatsApp). Ela abre, cria a própria senha e entra. Não depende de e-mail, e só
// ela conhece a senha (F12). O mesmo caminho serve para quem perdeu a senha: o dono gera um link de senha nova.
//
// Tudo aqui usa a chave secreta, porque pela sessão ninguém cria login, pessoa nem convite (migrações 1 e
// member_invites). Quem chama confere antes que é o dono daquela empresa (app/dono/actions.ts). SÓ do servidor.

import { supabaseAdmin } from "@/lib/runs/supabase-server";
import { hashInviteToken, INVITE_TTL_MS, looksLikeInviteToken, newInviteToken, type InviteKind } from "./invite-token";

const UNIQUE_VIOLATION = "23505";

/** Cria (ou troca) o convite da pessoa e devolve o código para o link. O link anterior dela para de valer. */
export async function issueInvite(input: { memberId: string; companyId: string; kind: InviteKind }): Promise<string> {
  const token = newInviteToken();
  const now = new Date();
  const { error } = await supabaseAdmin()
    .from("member_invites")
    .upsert(
      {
        member_id: input.memberId,
        company_id: input.companyId,
        kind: input.kind,
        token_hash: hashInviteToken(token),
        expires_at: new Date(now.getTime() + INVITE_TTL_MS).toISOString(),
        created_at: now.toISOString(),
      },
      { onConflict: "member_id" },
    );
  if (error) throw new Error(`Não deu para criar o convite: ${error.message}`);
  return token;
}

export type InviteEmployeeResult =
  | { ok: true; token: string }
  | { ok: false; reason: "already-in-team" | "email-taken" | "email-invalid" };

/**
 * Convida um funcionário: cria o login dele no Supabase Auth (com o e-mail, ainda sem senha), a pessoa na empresa e o
 * convite. Nenhum e-mail é mandado: o dono leva o link. Se algo falhar no meio, desfaz o login criado.
 */
export async function inviteEmployee(input: {
  companyId: string;
  name: string;
  email: string;
  budgetCents: number | null;
}): Promise<InviteEmployeeResult> {
  const db = supabaseAdmin();

  const { data: existing, error: lookupError } = await db
    .from("members")
    .select("id")
    .eq("company_id", input.companyId)
    .eq("email", input.email)
    .maybeSingle();
  if (lookupError) throw new Error(`Não deu para procurar a pessoa na equipe: ${lookupError.message}`);
  if (existing) return { ok: false, reason: "already-in-team" };

  // O e-mail fica marcado como confirmado porque é só o nome de entrada: quem prova o convite é o link (F32).
  const { data: created, error: userError } = await db.auth.admin.createUser({
    email: input.email,
    email_confirm: true,
  });
  if (userError || !created.user) {
    if (userError?.code === "email_exists") return { ok: false, reason: "email-taken" };
    if (userError?.code === "email_address_invalid" || userError?.code === "validation_failed") {
      return { ok: false, reason: "email-invalid" };
    }
    throw new Error(`Não deu para criar o login do funcionário: ${userError?.code ?? "sem usuário"}`);
  }

  const userId = created.user.id;
  const { data: member, error: memberError } = await db
    .from("members")
    .insert({
      company_id: input.companyId,
      user_id: userId,
      name: input.name,
      email: input.email,
      role: "employee",
      monthly_budget_cents: input.budgetCents,
    })
    .select("id")
    .single();
  if (memberError || !member) {
    // Sem a pessoa na empresa, o login não serve para nada: apaga para o e-mail poder ser convidado de novo.
    const { error: deleteError } = await db.auth.admin.deleteUser(userId);
    if (deleteError) console.error("[convite] Sobrou um login sem pessoa:", userId, deleteError.code);
    if (memberError?.code === UNIQUE_VIOLATION) return { ok: false, reason: "already-in-team" };
    throw new Error(`Não deu para pôr o funcionário na equipe: ${memberError?.message ?? "sem resposta"}`);
  }

  const token = await issueInvite({ memberId: member.id, companyId: input.companyId, kind: "invite" });
  return { ok: true, token };
}

/**
 * Link novo para um funcionário: continua sendo convite se a pessoa ainda não criou a senha (o convite anterior não
 * foi usado), e vira link de senha nova se ela já entrou alguma vez.
 */
export async function issueNewLink(input: { memberId: string; companyId: string }): Promise<{
  token: string;
  kind: InviteKind;
}> {
  const { data: current, error } = await supabaseAdmin()
    .from("member_invites")
    .select("kind")
    .eq("member_id", input.memberId)
    .maybeSingle();
  if (error) throw new Error(`Não deu para ler o convite atual: ${error.message}`);
  const kind: InviteKind = current?.kind === "invite" ? "invite" : "reset";
  return { token: await issueInvite({ ...input, kind }), kind };
}

export type InviteLookup =
  | { status: "not-found" }
  | { status: "expired" }
  | { status: "disabled" }
  | {
      status: "valid";
      memberId: string;
      kind: InviteKind;
      expiresAt: string;
      name: string;
      email: string;
      companyName: string;
    };

interface InviteRow {
  member_id: string;
  company_id: string;
  kind: InviteKind;
  token_hash: string;
  expires_at: string;
  created_at: string;
}

interface InvitedMember {
  name: string;
  email: string;
  status: string;
  user_id: string | null;
  companies: { name: string } | { name: string }[] | null;
}

async function readInvitedMember(memberId: string): Promise<InvitedMember> {
  const { data, error } = await supabaseAdmin()
    .from("members")
    .select("name, email, status, user_id, companies (name)")
    .eq("id", memberId)
    .single();
  if (error || !data) throw new Error(`Não deu para ler a pessoa do convite: ${error?.message ?? "sem resposta"}`);
  return data as InvitedMember;
}

/** Para a página do convite: só mostra, não gasta o convite (a prévia do link no WhatsApp também abre a página). */
export async function findInvite(token: string, now = new Date()): Promise<InviteLookup> {
  if (!looksLikeInviteToken(token)) return { status: "not-found" };

  const { data, error } = await supabaseAdmin()
    .from("member_invites")
    .select("member_id, kind, expires_at")
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle();
  if (error) throw new Error(`Não deu para procurar o convite: ${error.message}`);
  if (!data) return { status: "not-found" };
  const invite = data as Pick<InviteRow, "member_id" | "kind" | "expires_at">;
  if (Date.parse(invite.expires_at) <= now.getTime()) return { status: "expired" };

  const member = await readInvitedMember(invite.member_id);
  if (member.status !== "active") return { status: "disabled" };
  const company = Array.isArray(member.companies) ? member.companies[0] : member.companies;

  return {
    status: "valid",
    memberId: invite.member_id,
    kind: invite.kind,
    expiresAt: invite.expires_at,
    name: member.name,
    email: member.email,
    companyName: company?.name ?? "",
  };
}

export type AcceptInviteResult =
  | { ok: true; email: string }
  | { ok: false; reason: "not-found" | "disabled" | "weak-password" };

/**
 * Aceita o convite: gasta o código e grava a senha que a pessoa criou. O código é apagado ANTES de a senha mudar, na
 * mesma operação que confere o prazo, então dois envios ao mesmo tempo não usam o mesmo link. Se a senha não puder ser
 * gravada (falha do Supabase), o convite volta, para a pessoa tentar de novo com o mesmo link.
 */
export async function acceptInvite(token: string, password: string, now = new Date()): Promise<AcceptInviteResult> {
  if (!looksLikeInviteToken(token)) return { ok: false, reason: "not-found" };
  const db = supabaseAdmin();

  const { data: consumed, error } = await db
    .from("member_invites")
    .delete()
    .eq("token_hash", hashInviteToken(token))
    .gt("expires_at", now.toISOString())
    .select("member_id, company_id, kind, token_hash, expires_at, created_at");
  if (error) throw new Error(`Não deu para conferir o convite: ${error.message}`);
  const invite = (consumed ?? [])[0] as InviteRow | undefined;
  if (!invite) return { ok: false, reason: "not-found" };

  const member = await readInvitedMember(invite.member_id);
  if (member.status !== "active") return { ok: false, reason: "disabled" };
  if (!member.user_id) throw new Error("A pessoa do convite está sem login.");

  const { error: passwordError } = await db.auth.admin.updateUserById(member.user_id, { password });
  if (passwordError) {
    // Devolve o convite como estava (se o dono não tiver gerado outro nesse meio-tempo).
    const { error: restoreError } = await db
      .from("member_invites")
      .upsert(invite, { onConflict: "member_id", ignoreDuplicates: true });
    if (restoreError) console.error("[convite] Não deu para devolver o convite:", restoreError.code);
    if (passwordError.code === "weak_password") return { ok: false, reason: "weak-password" };
    throw new Error(`Não deu para gravar a senha: ${passwordError.code ?? passwordError.status}`);
  }

  return { ok: true, email: member.email };
}

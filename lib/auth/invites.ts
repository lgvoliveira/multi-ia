// Convites dos funcionários (decisão do Luis, 24/10/2026): o dono gera um link que vale 24 horas e funciona uma vez
// só, e manda para a pessoa (ex.: pelo WhatsApp). Ela abre, cria a própria senha e entra. Não depende de e-mail, e só
// ela conhece a senha (F12). O mesmo caminho serve para quem perdeu a senha: o dono gera um link de senha nova.
//
// Tudo aqui usa a chave secreta, porque pela sessão ninguém cria login, pessoa nem convite (migrações 1 e
// member_invites). Quem chama confere antes que é o dono daquela empresa (app/dono/actions.ts). SÓ do servidor.

import { randomInt } from "node:crypto";
import { supabaseAdmin } from "@/lib/runs/supabase-server";
import { hashInviteToken, INVITE_TTL_MS, looksLikeInviteToken, newInviteToken, type InviteKind } from "./invite-token";

const UNIQUE_VIOLATION = "23505";

// Alfabeto sem caracteres que se confundem (0/O, 1/l/I), para a senha temporária ser fácil de ditar/passar.
const PASSWORD_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Uma senha temporária aleatória que o dono entrega ao funcionário (ele troca no primeiro acesso). */
export function newTempPassword(length = 10): string {
  let out = "";
  for (let i = 0; i < length; i += 1) out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  return out;
}

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

export type CreateEmployeeResult =
  | { ok: true; email: string; tempPassword: string }
  | { ok: false; reason: "already-in-team" | "email-taken" | "email-invalid" };

/**
 * O dono cria um funcionário: faz o login dele no Supabase Auth com uma SENHA TEMPORÁRIA e o põe na empresa, marcado
 * para trocar a senha no primeiro acesso. Devolve o e-mail e a senha para o dono entregar à pessoa. Nenhum e-mail é
 * mandado. Se algo falhar no meio, desfaz o login criado.
 */
export async function inviteEmployee(input: {
  companyId: string;
  name: string;
  email: string;
  budgetCents: number | null;
}): Promise<CreateEmployeeResult> {
  const db = supabaseAdmin();

  const { data: existing, error: lookupError } = await db
    .from("members")
    .select("id")
    .eq("company_id", input.companyId)
    .eq("email", input.email)
    .maybeSingle();
  if (lookupError) throw new Error(`Não deu para procurar a pessoa na equipe: ${lookupError.message}`);
  if (existing) return { ok: false, reason: "already-in-team" };

  const tempPassword = newTempPassword();
  // O e-mail nasce confirmado: a pessoa entra direto com a senha temporária e troca por uma própria no primeiro acesso.
  const { data: created, error: userError } = await db.auth.admin.createUser({
    email: input.email,
    password: tempPassword,
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
      must_change_password: true,
    })
    .select("id")
    .single();
  if (memberError || !member) {
    // Sem a pessoa na empresa, o login não serve para nada: apaga para o e-mail poder ser usado de novo.
    const { error: deleteError } = await db.auth.admin.deleteUser(userId);
    if (deleteError) console.error("[funcionário] Sobrou um login sem pessoa:", userId, deleteError.code);
    if (memberError?.code === UNIQUE_VIOLATION) return { ok: false, reason: "already-in-team" };
    throw new Error(`Não deu para pôr o funcionário na equipe: ${memberError?.message ?? "sem resposta"}`);
  }

  return { ok: true, email: input.email, tempPassword };
}

export type ResetPasswordResult = { ok: true; email: string; tempPassword: string } | { ok: false; reason: "not-found" };

/**
 * Gera uma SENHA TEMPORÁRIA nova para um funcionário (quem perdeu a senha). Marca para trocar de novo no próximo acesso.
 * Devolve o e-mail e a senha para o dono entregar. Só funciona com uma pessoa da empresa do dono que tenha login.
 */
export async function issueNewLink(input: { memberId: string; companyId: string }): Promise<ResetPasswordResult> {
  const db = supabaseAdmin();
  const { data: member, error } = await db
    .from("members")
    .select("email, user_id")
    .eq("id", input.memberId)
    .eq("company_id", input.companyId)
    .maybeSingle();
  if (error) throw new Error(`Não deu para ler a pessoa: ${error.message}`);
  if (!member || !member.user_id) return { ok: false, reason: "not-found" };

  const tempPassword = newTempPassword();
  const { error: passwordError } = await db.auth.admin.updateUserById(member.user_id as string, { password: tempPassword });
  if (passwordError) throw new Error(`Não deu para gerar a senha nova: ${passwordError.code ?? passwordError.status}`);
  const { error: flagError } = await db.from("members").update({ must_change_password: true }).eq("id", input.memberId);
  if (flagError) throw new Error(`Não deu para marcar a troca de senha: ${flagError.message}`);
  return { ok: true, email: member.email as string, tempPassword };
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

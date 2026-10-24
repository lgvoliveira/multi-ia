// Quem está vendo a página: ninguém, uma pessoa sem empresa, uma pessoa desativada ou alguém da empresa.
// Toda página e rota protegida passa por aqui (requireMember), no servidor. O cookie sozinho não basta: o login é
// conferido pela assinatura e o cadastro é lido do banco a cada pedido, então desativar alguém vale na hora.

import { redirect } from "next/navigation";
import { cache } from "react";
import { supabaseAdmin } from "@/lib/runs/supabase-server";
import { homePathFor, parseMemberRow, type CurrentMember, type MemberRole } from "./member";
import { createSessionClient } from "./session";

export type Viewer =
  | { status: "signed-out" }
  /** Logou, mas não há empresa ligada ao login (ex.: o cadastro da empresa falhou no meio). */
  | { status: "no-company" }
  /** Foi desativado pelo dono: o banco já não mostra nada da empresa para ele. */
  | { status: "disabled" }
  | { status: "member"; member: CurrentMember };

/** Lê quem está logado. `cache` faz o topo e a página, no mesmo pedido, consultarem o banco uma vez só. */
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createSessionClient();
  if (!supabase) return { status: "signed-out" };

  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return { status: "signed-out" };

  // Com a sessão: as regras de acesso devolvem o próprio cadastro (e, para o dono, os da empresa; daí o filtro).
  const { data: row, error } = await supabase
    .from("members")
    .select("id, company_id, name, email, role, companies (name)")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Não deu para ler o cadastro de quem está logado: ${error.message}`);
  if (row) return { status: "member", member: parseMemberRow(row) };

  // Nada visível: ou a pessoa foi desativada (as regras escondem tudo dela), ou ainda não tem empresa.
  // Só o servidor enxerga o cadastro desativado; daqui sai apenas a situação, nenhum dado.
  const { data: hidden, error: hiddenError } = await supabaseAdmin()
    .from("members")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();
  if (hiddenError) throw new Error(`Não deu para conferir a situação do cadastro: ${hiddenError.message}`);
  return hidden ? { status: "disabled" } : { status: "no-company" };
});

/**
 * Para páginas protegidas: devolve quem está logado ou manda embora. Sem login vai para "Entrar"; sem empresa ou
 * desativado, para a entrada, que explica o que houve; papel errado (funcionário no painel do dono), para a sua página.
 */
export async function requireMember(role?: MemberRole): Promise<CurrentMember> {
  const viewer = await getViewer();
  if (viewer.status === "signed-out") redirect("/entrar");
  if (viewer.status !== "member") redirect("/");
  if (role && viewer.member.role !== role) redirect(homePathFor(viewer.member.role));
  return viewer.member;
}

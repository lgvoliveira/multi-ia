// Confere se quem pede ainda é a pessoa que abriu a página (F34). As abas normais de um navegador dividem o mesmo
// login: se outra aba entrar com outra conta, os botões desta aba passam a pedir com esse login. Cada tela que muda
// alguma coisa manda, junto do pedido, o id de quem a abriu; se o login mudou, nada é feito e a tela explica o que
// houve. O id que vem da tela só serve para recusar: quem pode o quê continua sendo decidido pelo login e pelo banco.
// Só dados e funções puras. (O painel do dono tem a sua versão, checkPageOwner, em lib/ock/team-forms.ts.)

import type { CurrentMember } from "./member";
import type { Viewer } from "./viewer";

/** O nome do campo, no pedido, com o id de quem abriu a página. */
export const PAGE_MEMBER_FIELD = "pageMemberId";

export type PageMemberCheck =
  | { ok: true; me: CurrentMember }
  /** `status`: 401 sem ninguém conectado, 403 sem acesso à empresa, 409 com outra conta conectada. */
  | { ok: false; status: 401 | 403 | 409; message: string };

export function checkPageMember(viewer: Viewer, pageMemberId: unknown): PageMemberCheck {
  if (viewer.status === "member" && viewer.member.id === pageMemberId) return { ok: true, me: viewer.member };
  if (viewer.status === "member") {
    return {
      ok: false,
      status: 409,
      message:
        `Nada foi feito. Neste navegador, quem está conectado agora é ${viewer.member.name}: as abas do navegador ` +
        "dividem o mesmo login, e outra aba entrou com essa conta. Para continuar com a sua conta, clique em Sair, " +
        "no topo, e entre de novo.",
    };
  }
  if (viewer.status === "signed-out") {
    return {
      ok: false,
      status: 401,
      message:
        "Nada foi feito. A sua conta não está mais conectada neste navegador (ela pode ter saído em outra aba). " +
        "Entre de novo para continuar.",
    };
  }
  return { ok: false, status: 403, message: "Nada foi feito. A sua conta não tem mais acesso a esta empresa." };
}

import type { Metadata } from "next";
import { AcceptInviteForm } from "@/components/AcceptInviteForm";
import { InviteProblem } from "@/components/InviteProblem";
import { findInvite } from "@/lib/auth/invites";
import { getViewer } from "@/lib/auth/viewer";
import { deadlineText } from "@/lib/ock/team";

// O título é genérico de propósito: é ele que aparece na prévia do link no WhatsApp.
export const metadata: Metadata = {
  title: "Convite para a equipe",
  description: "Crie a sua senha para entrar na equipe da sua empresa.",
  // O código do convite está no endereço: não vai para outros sites nem para buscadores.
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

// Abrir esta página só mostra o convite; quem gasta o convite é o botão (app/convite/actions.ts).
export default async function ConvitePage(props: PageProps<"/convite/[token]">) {
  const { token } = await props.params;
  const invite = await findInvite(token);
  if (invite.status !== "valid") return <InviteProblem kind={invite.status} />;

  const viewer = await getViewer();
  const signedInAs = viewer.status === "member" && viewer.member.id !== invite.memberId ? viewer.member.name : null;

  return (
    <AcceptInviteForm
      token={token}
      kind={invite.kind}
      name={invite.name}
      email={invite.email}
      companyName={invite.companyName}
      deadline={deadlineText(invite.expiresAt)}
      signedInAs={signedInAs}
    />
  );
}

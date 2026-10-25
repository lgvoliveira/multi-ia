// POST /api/ock/files (formulário com o arquivo e o id de quem abriu a página): anexa um arquivo para mandar numa
// mensagem do chat. Vai para a pasta fechada da pessoa; a IA só o lê quando a mensagem é enviada. Só para quem é da
// empresa, está ativo e é quem abriu a página (F34). Tipo que a IA não lê é recusado na hora (F44).

import { PAGE_MEMBER_FIELD } from "@/lib/auth/page-member";
import { attachmentMime } from "@/lib/ock/attachments";
import { isReadableAttachment, MAX_ATTACHMENT_BYTES, UNREADABLE_ATTACHMENT } from "@/lib/ock/chat";
import { chatProblem, pageCaller, SERVER_PROBLEM } from "@/lib/ock/chat-request";
import { displayName, storeFile } from "@/lib/ock/files";

export const maxDuration = 60;

/** Folga para o resto do formulário, além do arquivo. */
const FORM_OVERHEAD_BYTES = 64 * 1024;

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("multipart/form-data")) return chatProblem(415, "Formato de envio não aceito.");
  if (Number(request.headers.get("content-length")) > MAX_ATTACHMENT_BYTES + FORM_OVERHEAD_BYTES) {
    return chatProblem(413, tooBig());
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return chatProblem(400, "Não entendemos o arquivo enviado.");
  }

  const caller = await pageCaller(form.get(PAGE_MEMBER_FIELD));
  if (!caller.ok) return caller.response;

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return chatProblem(400, "Escolha um arquivo para anexar.");
  if (file.size > MAX_ATTACHMENT_BYTES) return chatProblem(413, tooBig());
  const name = displayName(file.name);
  if (!isReadableAttachment(name)) return chatProblem(415, UNREADABLE_ATTACHMENT);

  try {
    const stored = await storeFile({
      companyId: caller.me.companyId,
      memberId: caller.me.id,
      kind: "upload",
      name,
      mime: attachmentMime(name),
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    return Response.json({ file: stored }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/ock/files] Falha ao guardar o anexo:", error);
    return chatProblem(500, SERVER_PROBLEM);
  }
}

function tooBig(): string {
  return `O arquivo passou de ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB. Anexe um menor.`;
}

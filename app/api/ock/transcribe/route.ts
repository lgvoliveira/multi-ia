// POST /api/ock/transcribe (formulário com o áudio e o id de quem abriu a página): transcreve o que a pessoa ditou no
// chat e devolve o texto, para ela revisar e enviar. Só com a voz ligada (OCK_AI_TOOLS), para quem é da empresa, está
// ativo e é quem abriu a página (F34). Cobra da carteira da empresa (lib/ock/voice.ts). O áudio não é guardado.

import { PAGE_MEMBER_FIELD } from "@/lib/auth/page-member";
import { chatProblem, pageCaller, SERVER_PROBLEM } from "@/lib/ock/chat-request";
import { MAX_VOICE_BYTES } from "@/lib/ock/chat";
import { audioFileName, transcribeVoice } from "@/lib/ock/voice";
import { aiTools } from "@/lib/providers/mode";

export const maxDuration = 60;

/** Folga para o resto do formulário, além do áudio. */
const FORM_OVERHEAD_BYTES = 64 * 1024;

const TOO_LONG = "O áudio ficou grande demais. Dite em partes de até 2 minutos.";

export async function POST(request: Request): Promise<Response> {
  if (!aiTools().has("voz")) return chatProblem(404, "A voz ainda não está ligada.");

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("multipart/form-data")) return chatProblem(415, "Formato de envio não aceito.");
  if (Number(request.headers.get("content-length")) > MAX_VOICE_BYTES + FORM_OVERHEAD_BYTES) {
    return chatProblem(413, TOO_LONG);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return chatProblem(400, "Não entendemos o áudio enviado.");
  }

  const caller = await pageCaller(form.get(PAGE_MEMBER_FIELD));
  if (!caller.ok) return caller.response;

  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return chatProblem(400, "O áudio veio vazio. Grave de novo.");
  if (audio.size > MAX_VOICE_BYTES) return chatProblem(413, TOO_LONG);
  // O navegador manda o tipo (ex.: audio/webm;codecs=opus); qualquer outra coisa não é áudio.
  if (!audio.type.toLowerCase().startsWith("audio/")) return chatProblem(415, "Isso não é um áudio.");

  try {
    const outcome = await transcribeVoice(caller.me, caller.session, audio, audioFileName(audio.type));
    if (!outcome.ok) return chatProblem(outcome.status, outcome.problem);
    return Response.json(outcome.result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/ock/transcribe] Falha ao transcrever:", error);
    return chatProblem(500, SERVER_PROBLEM);
  }
}

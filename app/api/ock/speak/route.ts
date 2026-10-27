// POST /api/ock/speak  { text }  → áudio (mp3) da resposta lida em voz alta.
// Usa a fala da OpenAI (TTS) com a chave-mãe GPT do servidor. O texto serve só para gerar a voz.
// Só com a voz ligada (OCK_AI_TOOLS) e para quem é da empresa, logado e ativo, como as outras rotas do chat.

import { serverKeys } from "@/lib/keys/server-keys";
import { chatCaller, chatProblem } from "@/lib/ock/chat-request";
import { prepareSpeechText, synthesizeSpeech } from "@/lib/ock/speak";
import { aiTools } from "@/lib/providers/mode";

export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  if (!aiTools().has("voz")) return chatProblem(404, "A voz ainda não está ligada.");

  const caller = await chatCaller();
  if (!caller.ok) return caller.response;

  const keys = serverKeys();
  if (!keys.gpt) return chatProblem(503, "Voz indisponível (sem chave).");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return chatProblem(400, "Pedido inválido.");
  }
  const data = (body ?? {}) as Record<string, unknown>;
  const text = prepareSpeechText(typeof data.text === "string" ? data.text : "");
  if (!text) return chatProblem(400, "Sem texto para ler.");

  try {
    const speech = await synthesizeSpeech(keys.gpt, text);
    return new Response(speech.data, {
      status: 200,
      headers: { "Content-Type": speech.mime, "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[api/ock/speak] falha", error);
    return chatProblem(502, "Não deu para gerar a voz agora.");
  }
}

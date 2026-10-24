// POST /api/ock/speak  { text }  → áudio (mp3) da resposta lida em voz alta.
// Usa a fala da OpenAI (TTS) com a chave-mãe GPT do servidor. O texto serve só para gerar a voz.

import { serverKeys } from "@/lib/keys/server-keys";
import { prepareSpeechText, synthesizeSpeech } from "@/lib/ock/speak";

export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const keys = serverKeys();
  if (!keys.gpt) return Response.json({ problem: "Voz indisponível (sem chave)." }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ problem: "Pedido inválido." }, { status: 400 });
  }
  const raw = typeof (body as Record<string, unknown>)?.text === "string" ? ((body as Record<string, unknown>).text as string) : "";
  const text = prepareSpeechText(raw);
  if (!text) return Response.json({ problem: "Sem texto para ler." }, { status: 400 });

  try {
    const speech = await synthesizeSpeech(keys.gpt, text);
    return new Response(speech.data, {
      status: 200,
      headers: { "Content-Type": speech.mime, "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[api/ock/speak] falha", error);
    return Response.json({ problem: "Não deu para gerar a voz agora." }, { status: 502 });
  }
}

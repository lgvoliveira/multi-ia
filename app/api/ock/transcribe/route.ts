// POST /api/ock/transcribe  (áudio em multipart) → texto transcrito.
// Usa a transcrição da OpenAI (Whisper) com a chave-mãe GPT do servidor. O áudio é usado só para transcrever.

import { serverKeys } from "@/lib/keys/server-keys";

export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const keys = serverKeys();
  if (!keys.gpt) return Response.json({ problem: "Transcrição indisponível (sem chave)." }, { status: 503 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ problem: "Áudio inválido." }, { status: 400 });
  }
  const file = form.get("audio");
  if (!(file instanceof File)) return Response.json({ problem: "Envie um áudio." }, { status: 400 });

  const out = new FormData();
  out.append("file", file, file.name || "audio.webm");
  out.append("model", "whisper-1");
  out.append("language", "pt");

  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${keys.gpt}` },
      body: out,
    });
    if (!res.ok) {
      console.error("[api/ock/transcribe] erro", res.status, (await res.text()).slice(0, 200));
      return Response.json({ problem: `Não deu para transcrever (${res.status}).` }, { status: 502 });
    }
    const data = (await res.json()) as { text?: string };
    return Response.json({ text: data.text ?? "" });
  } catch (error) {
    console.error("[api/ock/transcribe] falha", error);
    return Response.json({ problem: "Não deu para transcrever agora." }, { status: 502 });
  }
}

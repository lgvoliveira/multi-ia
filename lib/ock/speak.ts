// Converte o texto de uma resposta em ÁUDIO (voz) com a fala da OpenAI (TTS).
// Usa a chave-mãe GPT do servidor; a chave nunca vai ao navegador. Só o servidor usa.

/** Teto de caracteres que a API de fala aceita por chamada. */
export const SPEECH_MAX_CHARS = 4000;

/**
 * Limpa o texto para a voz soar natural: tira marcas de markdown (**negrito**, # título,
 * `código`, links) que a IA às vezes usa, junta espaços/linhas e corta no teto de caracteres.
 */
export function prepareSpeechText(text: string, max = SPEECH_MAX_CHARS): string {
  const clean = text
    .replace(/```[\s\S]*?```/g, " ") // blocos de código
    .replace(/`([^`]+)`/g, "$1") // código em linha
    .replace(/!?\[([^\]]+)\]\([^)]*\)/g, "$1") // links/imagens → só o texto visível
    .replace(/[*_#>]+/g, " ") // ênfase, títulos, citações
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
  return clean.length > max ? clean.slice(0, max) : clean;
}

export interface Speech {
  data: ArrayBuffer;
  mime: string;
}

/** Gera o áudio (mp3) da fala com a OpenAI. Lança em caso de erro (para o chamador tratar). */
export async function synthesizeSpeech(gptKey: string, text: string): Promise<Speech> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${gptKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      voice: "alloy",
      input: text,
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    throw new Error(`fala ${res.status}: ${detail}`);
  }
  const data = await res.arrayBuffer();
  return { data, mime: "audio/mpeg" };
}

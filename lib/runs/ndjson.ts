// Como a narração viaja do servidor até o navegador: uma linha de texto por evento, cada linha um JSON
// (formato conhecido como "NDJSON"). O servidor manda cada linha assim que o evento acontece,
// e o navegador usa cada uma assim que ela chega inteira.

const encoder = new TextEncoder();

export interface NdjsonStreamOptions {
  /** Chamado se quem recebe desistir no meio (ex.: a pessoa fechou a página ou cancelou). */
  onCancel?: () => void;
}

/**
 * Transforma uma sequência de objetos no corpo de uma resposta HTTP, uma linha por objeto.
 * Só pede o próximo objeto quando o anterior já saiu, então nada se acumula no servidor.
 */
export function toNdjsonStream<T>(
  source: AsyncIterable<T>,
  options: NdjsonStreamOptions = {},
): ReadableStream<Uint8Array> {
  const iterator = source[Symbol.asyncIterator]();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await iterator.next();
      if (done) {
        controller.close();
      } else {
        controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      }
    },
    async cancel() {
      options.onCancel?.();
      await iterator.return?.();
    },
  });
}

/** Lê as linhas que chegam e devolve cada objeto assim que a linha dele está completa. */
export async function* readNdjson<T>(stream: ReadableStream<Uint8Array>): AsyncGenerator<T> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      // `stream: true` guarda uma letra acentuada que chegou partida entre dois pedaços.
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split("\n");
      // A última parte pode ser uma linha pela metade: espera o resto dela chegar.
      pending = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) yield JSON.parse(line) as T;
      }
    }
    pending += decoder.decode();
    if (pending.trim()) yield JSON.parse(pending) as T;
  } finally {
    // Parou de ler antes do fim (ou deu erro): avisa o outro lado que não precisa mandar mais nada.
    await reader.cancel().catch(() => undefined);
  }
}

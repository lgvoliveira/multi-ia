import { describe, expect, it, vi } from "vitest";
import { readNdjson, toNdjsonStream } from "./ndjson";

async function* fromList<T>(items: T[]): AsyncGenerator<T> {
  yield* items;
}

async function collect<T>(items: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of items) result.push(item);
  return result;
}

/** Um fluxo que entrega o texto em pedaços de `size` bytes, como pode acontecer na internet. */
function streamInPieces(text: string, size: number): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.slice(i, i + size));
      controller.close();
    },
  });
}

describe("transporte da narração em linhas", () => {
  it("o que sai do servidor chega igual ao navegador, na mesma ordem", async () => {
    const events = [
      { type: "step-text", text: "Olá, confeitaria!" },
      { type: "step-text", text: "linha 1\nlinha 2 com <html> e \"aspas\"" },
      { type: "run-finished" },
    ];

    expect(await collect(readNdjson(toNdjsonStream(fromList(events))))).toEqual(events);
  });

  it("junta linhas que chegam quebradas, mesmo no meio de uma letra acentuada", async () => {
    // Pedaços de 3 bytes: "ã", "ç" e "ú" ocupam 2 bytes cada e ficam divididos entre pedaços.
    const stream = streamInPieces('{"text":"pão de açúcar"}\n{"text":"ç"}\n', 3);

    expect(await collect(readNdjson(stream))).toEqual([{ text: "pão de açúcar" }, { text: "ç" }]);
  });

  it("aceita a última linha sem a quebra de linha no fim e ignora linhas vazias", async () => {
    const stream = streamInPieces('{"a":1}\n\n{"b":2}', 4);

    expect(await collect(readNdjson(stream))).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("se quem recebe desistir no meio, avisa e encerra a sequência", async () => {
    let sourceClosed = false;
    async function* source() {
      try {
        yield* [1, 2, 3];
      } finally {
        sourceClosed = true;
      }
    }
    const onCancel = vi.fn();
    const reader = toNdjsonStream(source(), { onCancel }).getReader();

    await reader.read();
    await reader.cancel();

    expect(onCancel).toHaveBeenCalledOnce();
    expect(sourceClosed).toBe(true);
  });
});

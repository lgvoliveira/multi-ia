import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEventBuffer } from "./event-buffer";
import type { PublicRunEvent } from "./public-events";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function recorder() {
  const batches: PublicRunEvent[][] = [];
  const write = vi.fn(async (events: PublicRunEvent[]) => {
    batches.push(events);
  });
  return { batches, write };
}

describe("fila da narração (grava aos poucos, enquanto a fase roda)", () => {
  it("manda a fila sozinha depois do intervalo, sem esperar a fase acabar", async () => {
    const { batches, write } = recorder();
    const buffer = createEventBuffer(write, 500);

    buffer.push({ type: "step-started", stepId: "brief", provider: "claude" });
    expect(write).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(batches).toEqual([[{ type: "step-started", stepId: "brief", provider: "claude" }]]);
  });

  it("junta os pedaços de texto de cada etapa num evento só, mesmo com as etapas em paralelo", async () => {
    const { batches, write } = recorder();
    const buffer = createEventBuffer(write, 500);

    buffer.push({ type: "step-text", stepId: "front", text: "<h1>" });
    buffer.push({ type: "step-text", stepId: "back", text: "body {" });
    buffer.push({ type: "step-text", stepId: "front", text: "Doce" });
    buffer.push({ type: "step-text", stepId: "back", text: " }" });
    buffer.push({ type: "step-text", stepId: "front", text: "!", round: 2 });
    await buffer.flush();

    expect(batches).toEqual([
      [
        { type: "step-text", stepId: "front", text: "<h1>Doce" },
        { type: "step-text", stepId: "back", text: "body { }" },
        { type: "step-text", stepId: "front", text: "!", round: 2 },
      ],
    ]);
  });

  it("não junta texto por cima de outro tipo de evento (ex.: tentando de novo, que apaga o texto)", async () => {
    const { batches, write } = recorder();
    const buffer = createEventBuffer(write, 500);

    buffer.push({ type: "step-text", stepId: "front", text: "metade" });
    buffer.push({ type: "step-retrying", stepId: "front", attempt: 2 });
    buffer.push({ type: "step-text", stepId: "front", text: "de novo" });
    buffer.push({ type: "step-finished", stepId: "front", durationMs: 10 });
    await buffer.flush();

    expect(batches).toEqual([
      [
        { type: "step-text", stepId: "front", text: "metade" },
        { type: "step-retrying", stepId: "front", attempt: 2 },
        { type: "step-text", stepId: "front", text: "de novo" },
        { type: "step-finished", stepId: "front", durationMs: 10 },
      ],
    ]);
  });

  it("os envios saem um depois do outro, na ordem da narração", async () => {
    const order: string[] = [];
    let release: () => void = () => {};
    const write = vi.fn(async (events: PublicRunEvent[]) => {
      if (order.length === 0) await new Promise<void>((resolve) => (release = resolve));
      order.push(events.map((event) => event.type).join(","));
    });
    const buffer = createEventBuffer(write, 500);

    buffer.push({ type: "stage-started", stageId: "brief", round: 1 });
    await vi.advanceTimersByTimeAsync(500); // 1º envio começa e fica esperando
    buffer.push({ type: "step-finished", stepId: "brief", durationMs: 10 });
    const done = buffer.flush(); // 2º envio entra na fila atrás do 1º
    release();
    await done;

    expect(order).toEqual(["stage-started", "step-finished"]);
  });

  it("flush sem nada na fila não grava nada", async () => {
    const { write } = recorder();
    await createEventBuffer(write, 500).flush();
    expect(write).not.toHaveBeenCalled();
  });

  it("se um envio falhar, os próximos não vão e o flush lança o erro", async () => {
    const write = vi.fn(async () => {
      throw new Error("sem conexão");
    });
    const buffer = createEventBuffer(write, 500);

    buffer.push({ type: "stage-started", stageId: "brief", round: 1 });
    await vi.advanceTimersByTimeAsync(500);
    buffer.push({ type: "step-finished", stepId: "brief", durationMs: 10 });

    await expect(buffer.flush()).rejects.toThrow("sem conexão");
    expect(write).toHaveBeenCalledTimes(1);
  });
});

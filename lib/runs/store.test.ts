import { afterEach, describe, expect, it, vi } from "vitest";

// Nunca falamos com o Supabase de verdade nos testes: trocamos o cliente de serviço por um dublê encadeável.
// Cada chamada guarda a tabela, a operação e os filtros; o `.then` resolve com o resultado que o teste combinou.

const calls = vi.hoisted(() => [] as Array<Record<string, unknown>>);
// O resultado que o próximo `await` de uma consulta vai receber ({ data, error }), por tabela.
const nextResult = vi.hoisted(() => ({ value: { data: null as unknown, error: null as unknown } }));

vi.mock("@/lib/runs/supabase-server", () => {
  function makeChain(record: Record<string, unknown>): unknown {
    const chain: Record<string, unknown> = {};
    const methods = [
      "insert",
      "update",
      "delete",
      "select",
      "eq",
      "in",
      "or",
      "gt",
      "order",
      "single",
      "maybeSingle",
    ];
    for (const method of methods) {
      chain[method] = (...args: unknown[]) => {
        record.ops = [...((record.ops as unknown[]) ?? []), { method, args }];
        return chain;
      };
    }
    // Torna o encadeamento "aguardável" em qualquer ponto (ex.: depois de .order() ou de .single()).
    chain.then = (resolve: (value: unknown) => unknown) => resolve(nextResult.value);
    return chain;
  }
  return {
    supabaseAdmin: () => ({
      from: (table: string) => {
        const record: Record<string, unknown> = { table };
        calls.push(record);
        return makeChain(record);
      },
    }),
  };
});

import { claimRun, createRun, loadEventsAfter } from "./store";

afterEach(() => {
  calls.length = 0;
  nextResult.value = { data: null, error: null };
});

describe("store da execução persistida (com cliente dublê)", () => {
  it("createRun insere na tabela certa, já na fila, e devolve o id gerado", async () => {
    nextResult.value = { data: { id: "run-123" }, error: null };

    const id = await createRun({
      owner_token: "hash",
      recipe_id: "create-site",
      request: "um site",
      team: { frontend: "claude" },
      plan: [],
    });

    expect(id).toBe("run-123");
    expect(calls[0].table).toBe("runs");
    const ops = calls[0].ops as Array<{ method: string; args: unknown[] }>;
    const insert = ops.find((op) => op.method === "insert");
    expect(insert?.args[0]).toMatchObject({
      status: "queued",
      cursor: { stageIndex: 0, round: 1 },
      recipe_id: "create-site",
    });
  });

  it("claimRun só reivindica quem está na fila ou rodando, com a reserva vencida, somando 1 na tentativa", async () => {
    // 1ª consulta: lê o attempt atual. 2ª consulta: a troca condicional devolve a linha reivindicada.
    nextResult.value = { data: { attempt: 2 }, error: null };
    const claimed = await claimRun("run-123");

    // Com o dublê, ambas as consultas veem o mesmo resultado; o que importa são os filtros montados.
    expect(claimed).toEqual({ attempt: 2 });
    const update = calls[1];
    const ops = update.ops as Array<{ method: string; args: unknown[] }>;
    expect(ops.find((op) => op.method === "update")?.args[0]).toMatchObject({ status: "running", attempt: 3 });
    expect(ops.some((op) => op.method === "in")).toBe(true);
    expect(ops.some((op) => op.method === "or")).toBe(true);
  });

  it("claimRun devolve null quando a execução não existe", async () => {
    nextResult.value = { data: null, error: null };
    expect(await claimRun("sumiu")).toBeNull();
  });

  it("loadEventsAfter traz os eventos com a posição (seq), em ordem", async () => {
    nextResult.value = {
      data: [
        { id: 5, event: { type: "step-finished", stepId: "brief", durationMs: 10 } },
        { id: 6, event: { type: "run-finished", result: "ok", durationMs: 20 } },
      ],
      error: null,
    };

    const events = await loadEventsAfter("run-123", 4);
    expect(events).toEqual([
      { seq: 5, event: { type: "step-finished", stepId: "brief", durationMs: 10 } },
      { seq: 6, event: { type: "run-finished", result: "ok", durationMs: 20 } },
    ]);
    const ops = calls[0].ops as Array<{ method: string; args: unknown[] }>;
    expect(ops.find((op) => op.method === "gt")?.args).toEqual(["id", 4]);
  });
});

import { describe, expect, it, vi } from "vitest";
import type { ProviderId } from "@/lib/providers/types";
import { SAMPLE_FINAL_SITE } from "@/lib/recipes/create-site.samples";
import { OFFLINE_PROBLEM, SERVER_PROBLEM, startRun } from "@/lib/runs/client";
import type { PublicRunEvent } from "@/lib/runs/public-events";
import { POST } from "./route";

// Guarda o "botão de parar" que cada IA recebeu, para conferir se ela foi mandada parar.
const providerSignals = vi.hoisted(() => [] as (AbortSignal | undefined)[]);

// Na rota de verdade a IA simulada "digita" devagar; aqui ela responde na hora.
vi.mock("@/lib/providers/registry", async () => {
  const { createMockProvider } = await import("@/lib/providers/mock");
  return {
    getProvider: (id: ProviderId) => {
      const provider = createMockProvider({ id, chunkDelayMs: 0 });
      return {
        id,
        generate: (request: Parameters<typeof provider.generate>[0]) => {
          providerSignals.push(request.signal);
          return provider.generate(request);
        },
      };
    },
  };
});

const BODY = { recipeId: "create-site", request: "Quero um site para minha confeitaria." };

/** O navegador falando direto com a rota, sem rede no meio. */
const callRoute: typeof fetch = (input, init) =>
  POST(new Request(new URL(String(input), "http://localhost"), init));

function post(body: string, contentType = "application/json"): Promise<Response> {
  return POST(
    new Request("http://localhost/api/runs", {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
    }),
  );
}

async function collect(events: AsyncIterable<PublicRunEvent>): Promise<PublicRunEvent[]> {
  const result: PublicRunEvent[] = [];
  for await (const event of events) result.push(event);
  return result;
}

describe("rota POST /api/runs", () => {
  it("narra a execução inteira, do time escolhido até o resultado final", async () => {
    const start = await startRun({ ...BODY, team: { programmer: "claude" } }, { fetch: callRoute });
    if (!start.ok) throw new Error(start.problems.join(" "));
    const events = await collect(start.events);

    expect(events[0]).toEqual({
      type: "run-started",
      steps: [
        { stepId: "plan", provider: "claude" },
        { stepId: "code", provider: "claude" },
        { stepId: "review", provider: "gemini" },
        { stepId: "consolidate", provider: "claude" },
      ],
    });
    const finished = events.filter((event) => event.type === "step-finished");
    expect(finished.map((event) => event.stepId)).toEqual(["plan", "code", "review", "consolidate"]);
    expect(events.at(-1)).toEqual({
      type: "run-finished",
      result: SAMPLE_FINAL_SITE,
      durationMs: expect.any(Number),
    });
  });

  it("responde uma linha de JSON por evento, sem guardar cópia e sem os dados internos", async () => {
    const response = await post(JSON.stringify(BODY));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/x-ndjson; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-cache, no-transform");
    expect(text.split("\n").at(-1)).toBe(""); // toda linha termina com a quebra de linha
    expect(text).not.toMatch(/"(model|usage|inputTokens|outputTokens|errorMessage)"/);
  });

  it("recusa pedido inválido na hora, com a mensagem em português", async () => {
    const response = await post(JSON.stringify({ ...BODY, request: "   " }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ problems: ["Escreva o que você quer que o time faça."] });
  });

  it("a tela recebe os problemas que o servidor apontou", async () => {
    const start = await startRun({ ...BODY, request: "a".repeat(4001) }, { fetch: callRoute });

    expect(start).toEqual({
      ok: false,
      problems: ["O pedido passou do limite de 4.000 caracteres (tem 4.001)."],
    });
  });

  it("recusa o que não chega como JSON", async () => {
    const notJson = await post(JSON.stringify(BODY), "text/plain");
    expect(notJson.status).toBe(415);
    expect(await notJson.json()).toEqual({ problems: ["Formato de pedido não aceito."] });

    const broken = await post("{ isto não é JSON");
    expect(broken.status).toBe(400);
    expect(await broken.json()).toEqual({ problems: ["Não entendemos o pedido enviado."] });
  });

  it("recusa corpo grande demais", async () => {
    const response = await post(JSON.stringify({ ...BODY, request: "a".repeat(70_000) }));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ problems: ["O pedido é grande demais."] });
  });

  it("se a pessoa cancelar, a IA que estava trabalhando é mandada parar", async () => {
    const controller = new AbortController();
    const start = await startRun(BODY, { fetch: callRoute, signal: controller.signal });
    if (!start.ok) throw new Error(start.problems.join(" "));

    const events: PublicRunEvent[] = [];
    for await (const event of start.events) {
      events.push(event);
      if (event.type === "step-text") controller.abort();
    }

    expect(events.at(-1)).toEqual({ type: "run-cancelled", stepId: "plan" });
    expect(providerSignals.at(-1)?.aborted).toBe(true);
  });

  it("se a conexão cair no meio, a IA que estava trabalhando é mandada parar", async () => {
    const response = await post(JSON.stringify(BODY));
    const reader = response.body!.getReader();

    await reader.read();
    await reader.read();
    await reader.cancel();

    expect(providerSignals.at(-1)?.aborted).toBe(true);
  });

  it("sem resposta no formato combinado ou sem internet, a tela mostra uma mensagem simples", async () => {
    const crashed = await startRun(BODY, {
      fetch: async () => new Response("Internal Server Error", { status: 500 }),
    });
    expect(crashed).toEqual({ ok: false, problems: [SERVER_PROBLEM] });

    const offline = await startRun(BODY, {
      fetch: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    expect(offline).toEqual({ ok: false, problems: [OFFLINE_PROBLEM] });
  });
});

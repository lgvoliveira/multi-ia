import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_PROPOSAL_FINAL } from "@/lib/recipes/commercial-proposal.samples";
import { SAMPLE_FINAL_SITE } from "@/lib/recipes/create-site.samples";
import type { OwnRun } from "@/lib/runs/store";
import { GET } from "./route";

// A execução, lida com a sessão de quem está logado (dublê).

const RUN_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const state = vi.hoisted(() => ({ signedIn: true, run: null as OwnRun | null }));

vi.mock("@/lib/auth/session", () => ({ signedInSession: async () => (state.signedIn ? {} : null) }));
vi.mock("@/lib/runs/store", () => ({ loadOwnRun: async () => state.run }));

function get(id = RUN_ID): Promise<Response> {
  return GET(new Request(`http://localhost/api/runs/${id}/document`), { params: Promise.resolve({ id }) });
}

function run(overrides: Partial<OwnRun> = {}): OwnRun {
  return {
    id: RUN_ID,
    recipe_id: "commercial-proposal",
    request: "Uma proposta para a Clínica Sorriso.",
    status: "finished",
    plan: [],
    cursor: { stageIndex: 4, round: 1 },
    result: SAMPLE_PROPOSAL_FINAL,
    duration_ms: 20_000,
    estimate_cents: 120,
    ...overrides,
  };
}

beforeEach(() => {
  state.signedIn = true;
  state.run = run();
});

describe("rota GET /api/runs/[id]/document (o resultado em Word)", () => {
  it("baixa a proposta pronta como anexo Word, com o nome da receita", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      `attachment; filename="Proposta-comercial.docx"; filename*=UTF-8''Proposta-comercial.docx`,
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    const zip = await JSZip.loadAsync(await response.arrayBuffer());
    expect(await zip.file("word/document.xml")!.async("string")).toContain("Proposta comercial — Clínica Sorriso");
  });

  it("sem login, 401; de outra pessoa ou com id estranho, 404", async () => {
    state.signedIn = false;
    expect((await get()).status).toBe(401);

    state.signedIn = true;
    state.run = null;
    expect((await get()).status).toBe(404);
    expect((await get("nao-e-um-id")).status).toBe(404);
  });

  it("execução que não terminou, receita que termina num site ou receita que não existe: 404", async () => {
    state.run = run({ status: "running", result: null });
    expect((await get()).status).toBe(404);

    state.run = run({ recipe_id: "create-site", result: SAMPLE_FINAL_SITE });
    expect((await get()).status).toBe(404);

    state.run = run({ recipe_id: "nao-existe" });
    expect((await get()).status).toBe(404);
  });
});

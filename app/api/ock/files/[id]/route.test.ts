import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/viewer";
import type { FileRow } from "@/lib/ock/files";
import { GET } from "./route";

// Baixar: o arquivo é procurado com a sessão de quem está logado (o banco só devolve o que a pessoa pode ver) e a
// pessoa vai para um link que só baixa.

const FILE_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const state = vi.hoisted(() => ({ viewer: { status: "signed-out" } as Viewer, file: null as FileRow | null }));

vi.mock("@/lib/auth/viewer", () => ({ getViewer: async () => state.viewer }));
vi.mock("@/lib/auth/session", () => ({ signedInSession: async () => ({}) }));
vi.mock("@/lib/ock/files", () => ({
  loadVisibleFile: async (_session: unknown, id: string) => (state.file?.id === id ? state.file : null),
  downloadLink: async (file: FileRow) => `https://armazem.example/${file.storage_path}?download=${file.name}`,
}));

function get(id = FILE_ID): Promise<Response> {
  return GET(new Request(`http://localhost/api/ock/files/${id}`), { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  state.viewer = {
    status: "member",
    member: { id: "m1", companyId: "c1", companyName: "Doce Encanto", name: "Carla", email: "c@example.com", role: "employee" },
  };
  state.file = {
    id: FILE_ID,
    member_id: "m1",
    kind: "delivery",
    name: "relatorio.pdf",
    storage_path: "c1/m1/x-relatorio.pdf",
    mime_type: "application/pdf",
    size_bytes: 100,
    task_id: null,
    created_at: "2026-10-25T10:00:00Z",
  };
});

describe("rota GET /api/ock/files/[id] (baixar)", () => {
  it("manda para o link de baixar, sem guardar a resposta", async () => {
    const response = await get();
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://armazem.example/c1/m1/x-relatorio.pdf?download=relatorio.pdf");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("arquivo que a pessoa não pode ver (ou id estranho) é 'não encontrado'; sem login, 401", async () => {
    state.file = null;
    expect((await get()).status).toBe(404);
    expect((await get("../../segredo")).status).toBe(404);
    state.viewer = { status: "signed-out" };
    expect((await get()).status).toBe(401);
  });
});

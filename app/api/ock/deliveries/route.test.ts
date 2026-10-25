import { describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/lib/auth/viewer";
import { GET } from "./route";

// As entregas são só as da própria pessoa: o dono, que pela sessão enxerga as da empresa toda, também vê só as dele.

const state = vi.hoisted(() => ({ viewer: { status: "signed-out" } as Viewer, asked: [] as string[] }));

vi.mock("@/lib/auth/viewer", () => ({ getViewer: async () => state.viewer }));
vi.mock("@/lib/auth/session", () => ({ signedInSession: async () => ({}) }));
vi.mock("@/lib/ock/files", () => ({
  listOwnDeliveries: async (_session: unknown, memberId: string) => {
    state.asked.push(memberId);
    return [{ id: "a1", name: "relatorio.pdf", createdAt: "2026-10-25T10:00:00Z" }];
  },
}));

describe("rota GET /api/ock/deliveries", () => {
  it("lista as entregas de quem está logado, mesmo quando é o dono", async () => {
    state.viewer = {
      status: "member",
      member: { id: "dona", companyId: "c1", companyName: "Doce Encanto", name: "Marina", email: "m@example.com", role: "owner" },
    };
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      deliveries: [{ id: "a1", name: "relatorio.pdf", createdAt: "2026-10-25T10:00:00Z" }],
    });
    expect(state.asked).toEqual(["dona"]);
  });

  it("sem login, 401", async () => {
    state.viewer = { status: "signed-out" };
    expect((await GET()).status).toBe(401);
  });
});

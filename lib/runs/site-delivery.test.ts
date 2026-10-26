import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRecipe } from "@/lib/recipes/catalog";
import { SAMPLE_FINAL_SITE } from "@/lib/recipes/create-site.samples";
import type { Recipe } from "@/lib/recipes/types";
import { finalSite, saveSiteDelivery } from "./site-delivery";

// A pasta e a tabela dos arquivos são dublês: só se anota o que seria guardado.
const files = vi.hoisted(() => ({
  hasRunDelivery: vi.fn<(runId: string) => Promise<boolean>>(async () => false),
  storeFile: vi.fn<(file: unknown) => Promise<{ id: string; name: string }>>(async () => ({ id: "a1", name: "site.html" })),
}));
vi.mock("@/lib/ock/files", () => files);

const RUN = { id: "run-1", company_id: "empresa-1", member_id: "pessoa-1" };
const recipe = getRecipe("create-site")!;

beforeEach(() => {
  vi.clearAllMocks();
  files.hasRunDelivery.mockResolvedValue(false);
});

describe("o site pronto vira entrega (F47)", () => {
  it("o resultado de uma receita que termina num site é o site", () => {
    expect(finalSite(recipe, SAMPLE_FINAL_SITE)).toBe(SAMPLE_FINAL_SITE);
    expect(finalSite(recipe, null)).toBeNull();
    expect(finalSite(recipe, "")).toBeNull();
  });

  it("uma receita que termina em texto não guarda site nenhum", () => {
    const lastStage = recipe.stages.at(-1)!;
    const textRecipe: Recipe = {
      ...recipe,
      stages: [
        ...recipe.stages.slice(0, -1),
        lastStage.kind === "review"
          ? { ...lastStage, step: { ...lastStage.step, format: "text" } }
          : { ...lastStage, steps: lastStage.steps.map((step) => ({ ...step, format: "text" as const })) },
      ],
    };
    expect(finalSite(textRecipe, "Um texto qualquer")).toBeNull();
  });

  it("guarda o .html na pasta de quem pediu, ligado à execução, com o nome tirado do título", async () => {
    await saveSiteDelivery(RUN, SAMPLE_FINAL_SITE);

    expect(files.storeFile).toHaveBeenCalledTimes(1);
    const stored = files.storeFile.mock.calls[0][0] as Record<string, unknown>;
    expect(stored).toMatchObject({
      companyId: "empresa-1",
      memberId: "pessoa-1",
      kind: "delivery",
      name: "doce-encanto-confeitaria.html",
      mime: "text/html",
      runId: "run-1",
    });
    expect(new TextDecoder().decode(stored.bytes as Uint8Array)).toBe(SAMPLE_FINAL_SITE);
  });

  it("se a execução já guardou o site (o servidor caiu e retomou), não guarda de novo", async () => {
    files.hasRunDelivery.mockResolvedValue(true);
    await saveSiteDelivery(RUN, SAMPLE_FINAL_SITE);

    expect(files.hasRunDelivery).toHaveBeenCalledWith("run-1");
    expect(files.storeFile).not.toHaveBeenCalled();
  });
});

import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRecipe } from "@/lib/recipes/catalog";
import { SAMPLE_PROPOSAL_FINAL } from "@/lib/recipes/commercial-proposal.samples";
import { SAMPLE_FINAL_SITE } from "@/lib/recipes/create-site.samples";
import { finalDelivery, finalDocument, finalSite, saveRunDelivery } from "./delivery";

// A pasta e a tabela dos arquivos são dublês: só se anota o que seria guardado.
const files = vi.hoisted(() => ({
  hasRunDelivery: vi.fn<(runId: string) => Promise<boolean>>(async () => false),
  storeFile: vi.fn<(file: unknown) => Promise<{ id: string; name: string }>>(async () => ({ id: "a1", name: "site.html" })),
}));
vi.mock("@/lib/ock/files", () => files);

const RUN = { id: "run-1", company_id: "empresa-1", member_id: "pessoa-1" };
const site = getRecipe("create-site")!;
const proposal = getRecipe("commercial-proposal")!;

beforeEach(() => {
  vi.clearAllMocks();
  files.hasRunDelivery.mockResolvedValue(false);
});

describe("o resultado da receita vira entrega (F47)", () => {
  it("o resultado de uma receita que termina num site é o site", () => {
    expect(finalSite(site, SAMPLE_FINAL_SITE)).toBe(SAMPLE_FINAL_SITE);
    expect(finalSite(site, null)).toBeNull();
    expect(finalSite(site, "")).toBeNull();
  });

  it("uma receita que termina em texto não guarda site nenhum, e uma que termina num site não vira Word", async () => {
    expect(finalSite(proposal, SAMPLE_PROPOSAL_FINAL)).toBeNull();
    expect(await finalDocument(site, SAMPLE_FINAL_SITE)).toBeNull();
    expect(await finalDocument(proposal, null)).toBeNull();
  });

  it("o site vira o .html, com o nome tirado do título", async () => {
    const delivery = await finalDelivery(site, SAMPLE_FINAL_SITE);
    expect(delivery).toMatchObject({ name: "doce-encanto-confeitaria.html", mime: "text/html" });
    expect(new TextDecoder().decode(delivery!.bytes)).toBe(SAMPLE_FINAL_SITE);
  });

  it("o texto vira um Word com o nome da receita, nunca com o pedido", async () => {
    const delivery = await finalDelivery(proposal, SAMPLE_PROPOSAL_FINAL);
    expect(delivery).toMatchObject({
      name: "Proposta-comercial.docx",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const xml = await (await JSZip.loadAsync(delivery!.bytes)).file("word/document.xml")!.async("string");
    expect(xml).toContain("Proposta comercial — Clínica Sorriso");
  });

  it("sem resultado, não há entrega", async () => {
    expect(await finalDelivery(site, null)).toBeNull();
    expect(await finalDelivery(proposal, "")).toBeNull();
  });

  it("guarda a entrega na pasta de quem pediu, ligada à execução", async () => {
    const delivery = (await finalDelivery(proposal, SAMPLE_PROPOSAL_FINAL))!;
    await saveRunDelivery(RUN, delivery);

    expect(files.storeFile).toHaveBeenCalledTimes(1);
    expect(files.storeFile.mock.calls[0][0]).toEqual({
      companyId: "empresa-1",
      memberId: "pessoa-1",
      kind: "delivery",
      name: "Proposta-comercial.docx",
      mime: delivery.mime,
      bytes: delivery.bytes,
      runId: "run-1",
    });
  });

  it("se a execução já guardou a entrega (o servidor caiu e retomou), não guarda de novo", async () => {
    files.hasRunDelivery.mockResolvedValue(true);
    await saveRunDelivery(RUN, (await finalDelivery(site, SAMPLE_FINAL_SITE))!);

    expect(files.hasRunDelivery).toHaveBeenCalledWith("run-1");
    expect(files.storeFile).not.toHaveBeenCalled();
  });
});

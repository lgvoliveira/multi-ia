// O site pronto vira uma entrega da pessoa (F47): quando a receita termina, o servidor guarda o .html na pasta fechada,
// ligado à execução. Assim ele aparece na aba Entregas de quem pediu e no painel do dono, que não lê a execução (decisão
// 2 do Luis, 24/10/2026). SÓ do servidor. Como todo arquivo da pasta, ele só sai por um link que sempre baixa e nunca
// abre como página do nosso endereço (AGENTS.md, seção 6).

import { hasRunDelivery, storeFile } from "@/lib/ock/files";
import { siteFileName } from "@/lib/ock/site-file";
import { stageSteps, type Recipe } from "@/lib/recipes/types";
import type { RunRow } from "./store";

/** O site do resultado final, se a última etapa da receita escreve um site (formato html). Senão, null. */
export function finalSite(recipe: Recipe, result: string | null): string | null {
  const lastStage = recipe.stages.at(-1);
  const lastStep = lastStage ? stageSteps(lastStage).at(-1) : undefined;
  return lastStep?.format === "html" && result ? result : null;
}

/** Guarda o site como entrega de quem pediu. Se a execução já guardou (o servidor caiu e retomou), não guarda de novo. */
export async function saveSiteDelivery(
  run: Pick<RunRow, "id" | "company_id" | "member_id">,
  html: string,
): Promise<void> {
  if (await hasRunDelivery(run.id)) return;
  await storeFile({
    companyId: run.company_id,
    memberId: run.member_id,
    kind: "delivery",
    name: siteFileName(html),
    mime: "text/html",
    bytes: new TextEncoder().encode(html),
    runId: run.id,
  });
}

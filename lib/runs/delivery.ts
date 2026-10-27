// O resultado de uma receita vira uma entrega da pessoa (F47): quando a receita termina, o servidor guarda o arquivo na
// pasta fechada, ligado à execução. Um site vira o .html; um texto (ex.: a proposta comercial), um arquivo Word. Assim
// ele aparece na aba Entregas de quem pediu e no painel do dono, que não lê a execução (decisão 2 do Luis, 24/10/2026).
// SÓ do servidor. Como todo arquivo da pasta, ele só sai por um link que sempre baixa e nunca abre como página do nosso
// endereço (AGENTS.md, seção 6).

import { textDocument, type GeneratedDoc } from "@/lib/ock/document";
import { hasRunDelivery, storeFile } from "@/lib/ock/files";
import { siteFileName } from "@/lib/ock/site-file";
import { finalStep, type Recipe } from "@/lib/recipes/types";
import type { RunRow } from "./store";

/** O site do resultado final, se a última etapa da receita escreve um site (formato html). Senão, null. */
export function finalSite(recipe: Recipe, result: string | null): string | null {
  return finalStep(recipe)?.format === "html" && result ? result : null;
}

/**
 * O resultado em texto num arquivo Word, se a última etapa da receita escreve texto. Senão (um site, ou nada), null.
 * O nome do arquivo vem da receita, nunca do pedido (F49).
 */
export async function finalDocument(recipe: Recipe, result: string | null): Promise<GeneratedDoc | null> {
  if (finalStep(recipe)?.format !== "text" || !result) return null;
  return textDocument(recipe.documentName ?? recipe.name, result);
}

/** O arquivo que a execução entrega: o site ou o Word. Null quando não há resultado. */
export async function finalDelivery(recipe: Recipe, result: string | null): Promise<GeneratedDoc | null> {
  const site = finalSite(recipe, result);
  if (site !== null) return { name: siteFileName(site), mime: "text/html", bytes: new TextEncoder().encode(site) };
  return finalDocument(recipe, result);
}

/** Guarda a entrega de quem pediu. Se a execução já guardou (o servidor caiu e retomou), não guarda de novo. */
export async function saveRunDelivery(
  run: Pick<RunRow, "id" | "company_id" | "member_id">,
  delivery: GeneratedDoc,
): Promise<void> {
  if (await hasRunDelivery(run.id)) return;
  await storeFile({
    companyId: run.company_id,
    memberId: run.member_id,
    kind: "delivery",
    name: delivery.name,
    mime: delivery.mime,
    bytes: delivery.bytes,
    runId: run.id,
  });
}

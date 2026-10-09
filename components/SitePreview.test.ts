import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SAMPLE_FINAL_SITE } from "@/lib/recipes/create-site.samples";
import { SitePreview } from "./SitePreview";

/** Desenha a prévia como o servidor desenharia e devolve a etiqueta <iframe>. */
function renderFrameTag(html: string): string {
  const markup = renderToStaticMarkup(createElement(SitePreview, { html }));
  const frames = markup.match(/<iframe[^>]*>/g) ?? [];
  expect(frames).toHaveLength(1);
  return frames[0] ?? "";
}

describe("moldura da prévia", () => {
  it("só deixa o site rodar o próprio JavaScript: nada de allow-same-origin, formulários ou janelas novas", () => {
    const frame = renderFrameTag(SAMPLE_FINAL_SITE);

    expect(frame).toContain('sandbox="allow-scripts"');
    expect(frame).not.toContain("allow-same-origin");
  });

  it("o site vai escrito dentro da moldura, já com as regras de segurança na frente", () => {
    const frame = renderFrameTag(SAMPLE_FINAL_SITE);

    expect(frame).toMatch(/srcDoc="&lt;!DOCTYPE html&gt;\s*&lt;meta http-equiv=&quot;Content-Security-Policy&quot;/i);
    // Nada de carregar o site de um endereço (src): ele rodaria com a origem da nossa página.
    expect(frame).not.toMatch(/\ssrc=/);
  });
});

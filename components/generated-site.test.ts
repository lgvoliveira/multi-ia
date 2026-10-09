import { describe, expect, it } from "vitest";
import { SAMPLE_FINAL_SITE } from "@/lib/recipes/create-site.samples";
import { buildPreviewDocument, PREVIEW_POLICY, siteFileName } from "./generated-site";

const POLICY_TAG = `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_POLICY}">`;

describe("site na prévia", () => {
  it("as regras de segurança entram logo depois do <!DOCTYPE>, antes de qualquer coisa do site", () => {
    const preview = buildPreviewDocument(SAMPLE_FINAL_SITE);

    expect(preview.startsWith(`<!DOCTYPE html>\n${POLICY_TAG}\n`)).toBe(true);
    // Tudo o que as IAs escreveram vem depois das regras, sem mudar nada.
    expect(preview.endsWith(SAMPLE_FINAL_SITE.slice("<!DOCTYPE html>".length))).toBe(true);
    expect(preview.indexOf(POLICY_TAG)).toBeLessThan(preview.indexOf("<html"));
    expect(preview.indexOf(POLICY_TAG)).toBeLessThan(preview.indexOf("<script>"));
  });

  it("sem <!DOCTYPE>, as regras vão na primeira linha", () => {
    const preview = buildPreviewDocument("<script>fetch('https://exemplo.com')</script>");

    expect(preview.trimStart().startsWith(POLICY_TAG)).toBe(true);
  });

  it("acha o <!DOCTYPE> escrito de qualquer jeito, com espaços antes", () => {
    const preview = buildPreviewDocument('\n  <!doctype HTML>\n<html lang="pt-BR"></html>');

    expect(preview.trimStart().startsWith(`<!doctype HTML>\n${POLICY_TAG}`)).toBe(true);
  });

  it("um <!DOCTYPE> no meio do texto não engana: as regras continuam na frente", () => {
    const preview = buildPreviewDocument("<script>1</script><!DOCTYPE html>");

    expect(preview.trimStart().startsWith(POLICY_TAG)).toBe(true);
  });

  it("a regra barra tudo o que vem de fora e libera só o que está escrito no próprio arquivo", () => {
    const directives = PREVIEW_POLICY.split("; ");

    expect(directives[0]).toBe("default-src 'none'");
    // Nenhuma linha libera endereços da internet nem a nossa própria página.
    for (const directive of directives) {
      expect(directive).not.toMatch(/https?:|\*|'self'|ws:|wss:/);
    }
    expect(directives).toContain("form-action 'none'");
  });

  it("links internos (#cardapio) resolvem dentro da prévia, e não no endereço da nossa página", () => {
    expect(buildPreviewDocument(SAMPLE_FINAL_SITE)).toContain('<base href="about:srcdoc">');
  });
});

describe("nome do arquivo para baixar", () => {
  it("vem do título do site, sem acentos e com hífens", () => {
    expect(siteFileName(SAMPLE_FINAL_SITE)).toBe("doce-encanto-confeitaria.html");
    expect(siteFileName("<title>Café &amp; Cia. — São Paulo</title>")).toBe("cafe-cia-sao-paulo.html");
  });

  it("sem título, ou com um título só de símbolos, vira meu-site.html", () => {
    expect(siteFileName("<h1>Oi</h1>")).toBe("meu-site.html");
    expect(siteFileName("<title> ★ ★ </title>")).toBe("meu-site.html");
  });

  it("um título muito comprido é cortado", () => {
    const name = siteFileName(`<title>${"Confeitaria ".repeat(20)}</title>`);

    expect(name.length).toBeLessThanOrEqual(60 + ".html".length);
    expect(name).toMatch(/^confeitaria-[a-z-]*[a-z]\.html$/);
  });
});

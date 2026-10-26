import { describe, expect, it } from "vitest";
import { SAMPLE_FINAL_SITE } from "@/lib/recipes/create-site.samples";
import { siteFileName } from "./site-file";

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

import { describe, expect, it } from "vitest";
import { PROVIDERS, getProviderInfo, isProviderId } from "./catalog";
import { getProvider } from "./registry";

describe("catálogo de IAs", () => {
  it("tem Claude, GPT e Gemini, nessa ordem", () => {
    expect(PROVIDERS.map((provider) => provider.name)).toEqual(["Claude", "GPT", "Gemini"]);
  });

  it("reconhece só os identificadores válidos", () => {
    expect(isProviderId("claude")).toBe(true);
    expect(isProviderId("gemini")).toBe(true);
    expect(isProviderId("llama")).toBe(false);
    expect(isProviderId(undefined)).toBe(false);
  });

  it("devolve o nome de cada IA", () => {
    expect(getProviderInfo("gpt").name).toBe("GPT");
  });

  it("entrega uma IA pronta para cada identificador", () => {
    for (const { id } of PROVIDERS) {
      expect(getProvider(id).id).toBe(id);
    }
  });
});

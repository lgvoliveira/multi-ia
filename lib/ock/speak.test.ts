import { describe, expect, it } from "vitest";
import { prepareSpeechText, SPEECH_MAX_CHARS } from "./speak";

describe("prepareSpeechText", () => {
  it("remove marcas de ênfase e código em linha", () => {
    expect(prepareSpeechText("**Oi** _mundo_ `x`")).toBe("Oi mundo x");
  });

  it("mantém só o texto visível de um link", () => {
    expect(prepareSpeechText("veja [o site](https://x.com)")).toBe("veja o site");
  });

  it("tira blocos de código e junta as linhas", () => {
    expect(prepareSpeechText("antes\n```\ncode\n```\ndepois")).toBe("antes\ndepois");
  });

  it("corta no teto de caracteres", () => {
    const long = "a".repeat(SPEECH_MAX_CHARS + 100);
    expect(prepareSpeechText(long).length).toBe(SPEECH_MAX_CHARS);
  });

  it("devolve vazio para texto só de marcas", () => {
    expect(prepareSpeechText("###  ** **")).toBe("");
  });
});

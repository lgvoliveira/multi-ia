import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptKeys, encryptKeys } from "./crypto";

// Uma chave de teste qualquer (hex de 32 bytes). Nada real.
const TEST_SECRET = "1".repeat(64);

describe("crypto das chaves do usuário", () => {
  beforeEach(() => {
    process.env.RUN_KEY_SECRET = TEST_SECRET;
  });
  afterEach(() => {
    delete process.env.RUN_KEY_SECRET;
  });

  it("vai e volta: o que criptografa é o que descriptografa", () => {
    const keys = { claude: "sk-ant-abc", gpt: "sk-openai-xyz" };
    const blob = encryptKeys(keys);

    // O blob guardado não deixa a chave à mostra.
    expect(blob).not.toContain("sk-ant-abc");
    expect(decryptKeys(blob)).toEqual(keys);
  });

  it("cada criptografia usa um vetor novo: o mesmo conteúdo gera blobs diferentes", () => {
    const keys = { claude: "sk-ant-abc" };
    expect(encryptKeys(keys)).not.toBe(encryptKeys(keys));
  });

  it("um blob adulterado não descriptografa: lança", () => {
    const blob = encryptKeys({ claude: "sk-ant-abc" });
    const raw = Buffer.from(blob, "base64");
    // Vira um bit do meio do texto cifrado.
    raw[15] ^= 0x01;
    const tampered = raw.toString("base64");

    expect(() => decryptKeys(tampered)).toThrow();
  });

  it("sem a chave secreta certa, não descriptografa", () => {
    const blob = encryptKeys({ claude: "sk-ant-abc" });
    process.env.RUN_KEY_SECRET = "2".repeat(64);
    expect(() => decryptKeys(blob)).toThrow();
  });

  it("exige uma chave secreta em formato válido", () => {
    process.env.RUN_KEY_SECRET = "muito-curta";
    expect(() => encryptKeys({ claude: "sk-ant-abc" })).toThrow();
  });
});

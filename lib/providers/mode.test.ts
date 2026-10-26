import { describe, expect, it } from "vitest";
import { aiMode } from "./mode";

describe("interruptor OCK_AI_MODE", () => {
  it("com o valor escrito, vale o que foi pedido, em qualquer lugar", () => {
    expect(aiMode({ OCK_AI_MODE: "real", NODE_ENV: "development" })).toBe("real");
    expect(aiMode({ OCK_AI_MODE: "simulada", NODE_ENV: "production" })).toBe("simulada");
    expect(aiMode({ OCK_AI_MODE: " Real ", NODE_ENV: "test" })).toBe("real");
  });

  it("vazio: simulada no computador de desenvolvimento e nos testes", () => {
    expect(aiMode({ NODE_ENV: "development" })).toBe("simulada");
    expect(aiMode({ OCK_AI_MODE: "", NODE_ENV: "test" })).toBe("simulada");
  });

  it("vazio fora do computador (o site no ar): real, para nunca cair na simulada por esquecimento", () => {
    expect(aiMode({ NODE_ENV: "production" })).toBe("real");
    expect(aiMode({})).toBe("real");
  });

  it("valor que não dá para entender é erro", () => {
    expect(() => aiMode({ OCK_AI_MODE: "verdade" })).toThrow(/OCK_AI_MODE/);
  });
});

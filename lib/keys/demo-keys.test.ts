import { describe, expect, it } from "vitest";
import { demoKeys, demoKeysStatus, hasAnyDemoKey, writeDemoKeys } from "./demo-keys";

// Em teste (NODE_ENV=test) o modo raio-x está desligado: a tela de chaves de teste não vale e não toca em arquivo
// nenhum. (O comportamento com o modo raio-x ligado é conferido à mão no navegador, pela própria tela.)
describe("chaves de teste (raio-x) desligadas fora do modo raio-x", () => {
  it("não lê chave nenhuma", () => {
    expect(demoKeys()).toEqual({});
    expect(hasAnyDemoKey()).toBe(false);
    expect(demoKeysStatus()).toEqual({ claude: false, gpt: false, gemini: false });
  });

  it("recusa gravar", () => {
    expect(() => writeDemoKeys({ claude: "qualquer-coisa" })).toThrow();
  });
});

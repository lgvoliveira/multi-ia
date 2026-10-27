import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEMO_ACCOUNTS, isDemoMode, isDemoView } from "./demo";

const ORIGINAL_FLAG = process.env.OCK_DEMO_MODE;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

function setNodeEnv(value: string): void {
  // NODE_ENV é read-only no tipo; aqui, só para o teste, trocamos o valor.
  (process.env as Record<string, string>).NODE_ENV = value;
}

beforeEach(() => {
  delete process.env.OCK_DEMO_MODE;
  setNodeEnv("development");
});

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.OCK_DEMO_MODE;
  else process.env.OCK_DEMO_MODE = ORIGINAL_FLAG;
  setNodeEnv(ORIGINAL_NODE_ENV ?? "test");
});

describe("isDemoMode (trava dupla)", () => {
  it("liga só com a variável igual a 1 e fora de produção", () => {
    process.env.OCK_DEMO_MODE = "1";
    setNodeEnv("development");
    expect(isDemoMode()).toBe(true);
  });

  it("fica desligado sem a variável", () => {
    expect(isDemoMode()).toBe(false);
  });

  it("fica desligado com qualquer valor que não seja exatamente 1", () => {
    for (const value of ["0", "true", "sim", ""]) {
      process.env.OCK_DEMO_MODE = value;
      expect(isDemoMode()).toBe(false);
    }
  });

  it("NUNCA liga em produção, mesmo com a variável ligada", () => {
    process.env.OCK_DEMO_MODE = "1";
    setNodeEnv("production");
    expect(isDemoMode()).toBe(false);
  });
});

describe("isDemoView", () => {
  it("aceita só os dois lados conhecidos", () => {
    expect(isDemoView("chefe")).toBe(true);
    expect(isDemoView("funcionario")).toBe(true);
    expect(isDemoView("dono")).toBe(false);
    expect(isDemoView(undefined)).toBe(false);
    expect(isDemoView(1)).toBe(false);
  });
});

describe("DEMO_ACCOUNTS", () => {
  it("tem um dono e um funcionário, cada um com os papéis certos", () => {
    expect(DEMO_ACCOUNTS.chefe.role).toBe("owner");
    expect(DEMO_ACCOUNTS.funcionario.role).toBe("employee");
    // Toda conta de teste precisa de e-mail e senha para o login automático.
    for (const account of Object.values(DEMO_ACCOUNTS)) {
      expect(account.email).toContain("@");
      expect(account.password.length).toBeGreaterThan(0);
    }
  });
});

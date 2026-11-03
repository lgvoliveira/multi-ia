import { describe, expect, it } from "vitest";
import { isUuid, parseSendBody } from "./chat-request";

const FILE_A = "0f8fad5b-d9cb-469f-a165-70867728950e";
const FILE_B = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

describe("conferência de uma mensagem enviada", () => {
  it("aceita a mensagem, a conversa e os anexos, sem espaços nas pontas e sem anexo repetido", () => {
    expect(parseSendBody({ message: "  Oi  ", conversationId: FILE_A, fileIds: [FILE_B, FILE_B] })).toEqual({
      ok: true,
      input: { message: "Oi", conversationId: FILE_A, fileIds: [FILE_B], agentId: null },
    });
    expect(parseSendBody({ message: "Oi" })).toEqual({
      ok: true,
      input: { message: "Oi", conversationId: null, fileIds: [], agentId: null },
    });
  });

  it("só anexos, sem texto, também vale", () => {
    expect(parseSendBody({ fileIds: [FILE_A] }).ok).toBe(true);
  });

  it("recusa mensagem vazia sem anexos, longa demais, conversa ou anexo estranhos e anexos demais", () => {
    const problem = (body: unknown) => {
      const result = parseSendBody(body);
      return result.ok ? null : result.problem;
    };
    expect(problem({ message: "   " })).toContain("Escreva o que você precisa");
    expect(problem({ message: "a".repeat(4001) })).toContain("passou de 4.000 caracteres");
    expect(problem({ message: "a".repeat(4000) })).toBeNull();
    expect(problem({ message: "Oi", conversationId: "abc" })).toContain("conversa não foi encontrada");
    expect(problem({ message: "Oi", fileIds: ["abc"] })).toContain("arquivos anexados não foi encontrado");
    expect(problem({ message: "Oi", fileIds: FILE_A })).toContain("arquivos anexados");
    const six = Array.from({ length: 6 }, (_, index) => `0f8fad5b-d9cb-469f-a165-7086772895${String(index).padStart(2, "0")}`);
    expect(problem({ message: "Oi", fileIds: six })).toContain("até 5 arquivos");
    expect(problem({ message: 42 })).toContain("Não entendemos a mensagem");
    expect(problem(null)).toContain("Não entendemos o pedido");
    expect(problem([])).toContain("Não entendemos o pedido");
  });

  it("reconhece ids do banco", () => {
    expect(isUuid(FILE_A)).toBe(true);
    expect(isUuid("../etc")).toBe(false);
    expect(isUuid(1)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { attachmentMime, readAttachment } from "./attachments";
import { ATTACHMENT_ACCEPT, fileExtension, isReadableAttachment } from "./chat";

describe("anexos do chat", () => {
  it("só aceita os tipos que a IA lê, pela extensão do nome (F44)", () => {
    expect(isReadableAttachment("Relatório.PDF")).toBe(true);
    expect(isReadableAttachment("notas.txt")).toBe(true);
    expect(isReadableAttachment("foto.jpeg")).toBe(true);
    expect(isReadableAttachment("contrato.docx")).toBe(false);
    expect(isReadableAttachment("planilha.xlsx")).toBe(false);
    expect(isReadableAttachment("sem-extensao")).toBe(false);
    expect(fileExtension("a.b.CSV")).toBe("csv");
    expect(ATTACHMENT_ACCEPT).toContain(".pdf");
    expect(ATTACHMENT_ACCEPT).not.toContain(".docx");
  });

  it("texto vira texto; imagem vai para a IA enxergar; outro tipo não chega à IA", async () => {
    const bytes = new TextEncoder().encode("Olá, mundo");
    expect(await readAttachment("nota.md", bytes)).toEqual({ kind: "text", text: "Olá, mundo" });
    expect(await readAttachment("foto.png", new Uint8Array([1, 2, 3]))).toEqual({
      kind: "image",
      mime: "image/png",
      base64: "AQID",
    });
    expect(await readAttachment("contrato.docx", bytes)).toBeNull();
  });

  it("um PDF que não dá para ler vira um aviso, não um erro", async () => {
    const result = await readAttachment("quebrado.pdf", new TextEncoder().encode("isto não é um PDF"));
    expect(result).toEqual({ kind: "text", text: "[Não consegui ler o conteúdo deste PDF.]" });
  });

  it("o tipo guardado vem da extensão, não do navegador", () => {
    expect(attachmentMime("a.pdf")).toBe("application/pdf");
    expect(attachmentMime("a.csv")).toBe("text/csv");
    expect(attachmentMime("a.jpg")).toBe("image/jpeg");
    expect(attachmentMime("a.html")).toBe("application/octet-stream");
  });
});

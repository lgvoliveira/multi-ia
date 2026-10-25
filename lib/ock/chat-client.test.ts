import { describe, expect, it } from "vitest";
import { OFFLINE_PROBLEM, SERVER_PROBLEM, sendMessage, uploadAttachment } from "./chat-client";

const PAGE_MEMBER = "11111111-1111-4111-8111-111111111111";

describe("o chat no navegador", () => {
  it("manda a mensagem com o id de quem abriu a página e devolve a resposta", async () => {
    let sent: { url: string; body: unknown } | null = null;
    const fake = (async (url: string, init: RequestInit) => {
      sent = { url, body: JSON.parse(String(init.body)) };
      return Response.json({ task: { id: "t1" } });
    }) as typeof fetch;
    const result = await sendMessage({ message: "Oi", conversationId: null, fileIds: [], pageMemberId: PAGE_MEMBER }, fake);
    expect(result).toEqual({ ok: true, data: { task: { id: "t1" } } });
    expect(sent).toEqual({
      url: "/api/ock",
      body: { message: "Oi", conversationId: null, fileIds: [], pageMemberId: PAGE_MEMBER },
    });
  });

  it("mostra o problema que o servidor mandou; sem formato ou sem internet, uma frase genérica", async () => {
    const refusing = (async () => Response.json({ problem: "Sem saldo." }, { status: 402 })) as unknown as typeof fetch;
    const broken = (async () => new Response("<html>erro</html>", { status: 500 })) as unknown as typeof fetch;
    const offline = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const body = { message: "Oi", conversationId: null, fileIds: [], pageMemberId: PAGE_MEMBER };
    expect(await sendMessage(body, refusing)).toEqual({ ok: false, problem: "Sem saldo." });
    expect(await sendMessage(body, broken)).toEqual({ ok: false, problem: SERVER_PROBLEM });
    expect(await sendMessage(body, offline)).toEqual({ ok: false, problem: OFFLINE_PROBLEM });
  });

  it("um anexo de tipo que a IA não lê, ou grande demais, nem é enviado", async () => {
    const never = (async () => {
      throw new Error("não devia enviar");
    }) as unknown as typeof fetch;
    const docx = await uploadAttachment(new File(["x"], "contrato.docx"), PAGE_MEMBER, never);
    expect(docx).toMatchObject({ ok: false, problem: expect.stringContaining("ainda não lê") });
    const big = await uploadAttachment(new File([new Uint8Array(10 * 1024 * 1024 + 1)], "a.pdf"), PAGE_MEMBER, never);
    expect(big).toMatchObject({ ok: false, problem: expect.stringContaining("10 MB") });
  });
});

// GET /api/ock/summary?memberId=X → "o que esse funcionário fez hoje?": a IA resume o dia dele (para o dono).

import { serverKeys } from "@/lib/keys/server-keys";
import { createGetProvider } from "@/lib/providers/registry";
import { runProvider } from "@/lib/ock/chief";
import { getMember, memberTasksSince } from "@/lib/ock/company";

export const maxDuration = 120;

const SUMMARY_SYSTEM = `Você resume o DIA DE TRABALHO de um funcionário para o chefe. A partir da lista de tarefas (pedido + o que foi entregue), escreva um resumo claro e curto em português do Brasil: o que a pessoa fez hoje, em tópicos, agrupando por tema e destacando as entregas. Direto ao ponto, sem enrolação.`;

export async function GET(request: Request): Promise<Response> {
  const memberId = new URL(request.url).searchParams.get("memberId") ?? "";
  if (!memberId) return Response.json({ problem: "Funcionário inválido." }, { status: 400 });
  try {
    const member = await getMember(memberId);
    if (!member) return Response.json({ problem: "Funcionário não encontrado." }, { status: 404 });

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const tasks = await memberTasksSince(memberId, start.toISOString());
    if (tasks.length === 0) {
      return Response.json({ summary: `${member.name} não realizou nenhuma tarefa hoje.` }, { headers: { "Cache-Control": "no-store" } });
    }

    const list = tasks
      .map((t, i) => `${i + 1}. Pedido: ${t.prompt}\n   Entrega: ${(t.answer ?? "").slice(0, 300)}`)
      .join("\n");
    const input = `Funcionário: ${member.name}\nTarefas de hoje (${tasks.length}):\n${list}`;

    const getProvider = createGetProvider(serverKeys());
    const work = await runProvider(getProvider("claude"), SUMMARY_SYSTEM, input, 1500, "medium", "padrao", []);
    return Response.json({ summary: work.text, taskCount: tasks.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/ock/summary] Falha:", error);
    return Response.json({ problem: "Não deu para gerar o resumo agora." }, { status: 500 });
  }
}

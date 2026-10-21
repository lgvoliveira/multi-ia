// GET /api/ock/deliveries?memberId=X → as ENTREGAS do funcionário (arquivos que a IA produziu) com link.
// Usado pelo funcionário (as próprias) e pelo dono (as de cada funcionário).

import { listDeliveries } from "@/lib/ock/files";

export async function GET(request: Request): Promise<Response> {
  const memberId = new URL(request.url).searchParams.get("memberId") ?? "";
  if (!memberId) return Response.json({ problem: "Funcionário inválido." }, { status: 400 });
  try {
    const deliveries = await listDeliveries(memberId);
    return Response.json({ deliveries }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/ock/deliveries] Falha:", error);
    return Response.json({ problem: "Algo deu errado do nosso lado." }, { status: 500 });
  }
}

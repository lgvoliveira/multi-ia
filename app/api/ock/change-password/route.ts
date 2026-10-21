// POST /api/ock/change-password { email, currentPassword, newPassword }
// O funcionário cria a própria senha (no 1º acesso). Depois disso, o dono não vê nem consegue entrar.

import { changePassword } from "@/lib/ock/company";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ problem: "Pedido inválido." }, { status: 400 });
  }
  const data = (body ?? {}) as Record<string, unknown>;
  const email = typeof data.email === "string" ? data.email : "";
  const currentPassword = typeof data.currentPassword === "string" ? data.currentPassword : "";
  const newPassword = typeof data.newPassword === "string" ? data.newPassword : "";
  if (!email || !currentPassword || !newPassword) {
    return Response.json({ problem: "Preencha todos os campos." }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return Response.json({ problem: "A nova senha precisa de pelo menos 6 caracteres." }, { status: 400 });
  }
  try {
    const ok = await changePassword(email, currentPassword, newPassword);
    if (!ok) return Response.json({ problem: "Email ou senha atual incorretos." }, { status: 401 });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[api/ock/change-password] Falha ao trocar senha:", error);
    return Response.json({ problem: "Algo deu errado do nosso lado." }, { status: 500 });
  }
}

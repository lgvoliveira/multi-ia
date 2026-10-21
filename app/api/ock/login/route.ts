// POST /api/ock/login { email, password } → entra como funcionário. Devolve o id para abrir o workspace.
// Teste: sem sessão de verdade ainda; o id na URL é o "estar logado". Produção: sessão + senha com hash.

import { findMemberByLogin } from "@/lib/ock/company";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ problem: "Pedido inválido." }, { status: 400 });
  }
  const data = (body ?? {}) as Record<string, unknown>;
  const email = typeof data.email === "string" ? data.email : "";
  const password = typeof data.password === "string" ? data.password : "";
  if (!email || !password) return Response.json({ problem: "Preencha email e senha." }, { status: 400 });

  try {
    const member = await findMemberByLogin(email, password);
    if (!member) return Response.json({ problem: "Email ou senha incorretos." }, { status: 401 });
    return Response.json({
      member: { id: member.id, name: member.name, mustChangePassword: member.mustChangePassword },
    });
  } catch (error) {
    console.error("[api/ock/login] Falha ao entrar:", error);
    return Response.json({ problem: "Algo deu errado do nosso lado." }, { status: 500 });
  }
}

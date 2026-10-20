// POST /api/ock/files  (multipart: file, memberId) → sobe um arquivo para a pasta do funcionário.
// GET  /api/ock/files?member=<id>                 → lista os arquivos do funcionário.

import { getMember, loadCompany } from "@/lib/ock/company";
import { listMemberFiles, uploadFile } from "@/lib/ock/files";

export const maxDuration = 60;

const MAX_FILE = 10 * 1024 * 1024; // 10 MB

export async function GET(request: Request): Promise<Response> {
  const memberId = new URL(request.url).searchParams.get("member") ?? "";
  if (!memberId) return Response.json({ problem: "Funcionário inválido." }, { status: 400 });
  try {
    const files = await listMemberFiles(memberId);
    return Response.json({ files }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/ock/files] Falha ao listar:", error);
    return Response.json({ problem: "Algo deu errado do nosso lado." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ problem: "Envio inválido." }, { status: 400 });
  }
  const memberId = typeof form.get("memberId") === "string" ? (form.get("memberId") as string) : "";
  const file = form.get("file");
  if (!memberId) return Response.json({ problem: "Funcionário inválido." }, { status: 400 });
  if (!(file instanceof File)) return Response.json({ problem: "Nenhum arquivo enviado." }, { status: 400 });
  if (file.size > MAX_FILE) return Response.json({ problem: "Arquivo grande demais (máx. 10 MB)." }, { status: 413 });

  try {
    const member = await getMember(memberId);
    if (!member) return Response.json({ problem: "Funcionário não encontrado." }, { status: 404 });
    const company = await loadCompany("demo");
    if (!company) return Response.json({ problem: "Empresa não encontrada." }, { status: 404 });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const stored = await uploadFile(company, member, {
      name: file.name || "arquivo",
      mime: file.type || null,
      bytes,
    });
    return Response.json({ file: stored });
  } catch (error) {
    console.error("[api/ock/files] Falha ao subir:", error);
    return Response.json({ problem: "Não deu para subir o arquivo agora." }, { status: 500 });
  }
}

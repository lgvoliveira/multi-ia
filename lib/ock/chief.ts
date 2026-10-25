// O Chefe do OCK: lê o pedido do funcionário e DECIDE a melhor IA, o nível e o esforço para a tarefa
// (otimizando tempo/custo/qualidade). É o coração do diferencial: o funcionário só descreve o que quer; o Chefe
// escolhe quem faz e como. Se a decisão por IA falhar, cai numa regra simples. Quem executa é lib/ock/run-task.ts.

import { isProviderId } from "@/lib/providers/catalog";
import type { Effort, GenerateRequest, ModelTier, ProviderId } from "@/lib/providers/types";

export type RouteMode = "rapido" | "projeto";
/** O que o Chefe vai fazer: responder, imagem, código, pesquisa, arquivo, gráfico, ou um PROJETO (.zip). */
export type RouteAction = "responder" | "imagem" | "codigo" | "pesquisa" | "documento" | "grafico" | "projeto";

export interface Route {
  provider: ProviderId;
  effort: Effort;
  tier: ModelTier;
  mode: RouteMode;
  action: RouteAction;
  reason: string;
}

const ROUTE_SYSTEM = `Você é o Chefe de um time de IAs numa plataforma que otimiza custo e tempo. Escolha a AÇÃO, a IA, o NÍVEL do modelo e o esforço — SEMPRE o mais barato que resolve bem.

Guia (do estudo "Melhor IA por função"):
- Tarefa SIMPLES (resumir, classificar, extrair dados, pergunta direta, título, tradução curta) → ia "claude" nível "economico" (Haiku), esforço "low". Rápido e baratíssimo.
- Texto geral, e-mail, post, planejar, e FAZER SITE / visual / HTML/CSS → ia "gpt" nível "padrao" (melhor por dólar). Esforço "medium" (ou "high" se for o visual de um site).
- CÓDIGO, back-end, lógica, API, SQL, algoritmo → ia "claude" nível "padrao" (Sonnet), esforço "high".
- Tarefa MUITO DIFÍCIL (arquitetura, projeto grande, raciocínio pesado, análise complexa) → ia "claude" nível "potente" (Opus), esforço "high". Use SÓ quando realmente precisa.
- O "gemini" fica para as ações "pesquisa" e "codigo" (abaixo), não para as tarefas de texto acima.

Ações: "responder" (texto), "imagem" (CRIAR/GERAR imagem → use ia "gpt"), "codigo" (EXECUTAR/RODAR cálculo ou código → use ia "gemini"), "pesquisa" (informação ATUAL da internet: notícias, preços, fatos recentes → use ia "gemini"), "documento" (GERAR UM ARQUIVO para baixar: PDF, planilha, CSV, relatório, lista exportada → use ia "claude" nível "padrao", esforço "high"; a OCK transforma o conteúdo no arquivo), "grafico" (montar um GRÁFICO/visualização de dados: barra, linha, pizza → use ia "claude" nível "padrao"; a OCK desenha o gráfico), "projeto" (GERAR CÓDIGO/um projeto/app/site em vários ARQUIVOS para baixar em .zip → use ia "claude" nível "padrao", esforço "high"; a OCK compacta os arquivos).
Esforço: "low" (simples/direto), "medium" (padrão), "high" (difícil).
Tipo: "rapido" (resposta direta) ou "projeto" (grande, várias partes).
Responda APENAS com um JSON, sem explicação, nesta forma:
{"acao":"responder|imagem|codigo|pesquisa|documento|grafico|projeto","ia":"claude|gpt|gemini","nivel":"economico|padrao|potente","esforco":"low|medium|high","tipo":"rapido|projeto","motivo":"frase curta"}`;

/** A IA barata e rápida que o Chefe usa só para DECIDIR a rota (não para fazer a tarefa), e como ela é chamada. */
export const ROUTER = {
  provider: "gpt",
  tier: "economico",
  effort: "low",
  maxOutputTokens: 300,
} as const satisfies { provider: ProviderId; tier: ModelTier; effort: Effort; maxOutputTokens: number };

/**
 * O pedido para o Chefe decidir a rota. `context` é a conversa recente: ajuda a classificar pedidos de continuação
 * ("deixe mais curto"). Se a decisão não vier no formato combinado, quem chama usa a regra simples (heuristicRoute),
 * que olha só a mensagem atual, para não se confundir com o assunto do contexto.
 */
export function routerRequest(message: string, context = ""): GenerateRequest {
  const input = context ? `Conversa recente (contexto):
${context}

Mensagem a classificar: ${message}` : message;
  return {
    systemPrompt: ROUTE_SYSTEM,
    input,
    maxOutputTokens: ROUTER.maxOutputTokens,
    effort: ROUTER.effort,
    tier: ROUTER.tier,
  };
}

/** Lê o JSON que o Chefe devolveu. Null se não veio no formato combinado. */
export function parseRoute(text: string): Route | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let data: unknown;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const obj = data as Record<string, unknown>;
  const provider = obj.ia;
  const effort = obj.esforco;
  const mode = obj.tipo;
  if (!isProviderId(provider)) return null;
  if (effort !== "low" && effort !== "medium" && effort !== "high") return null;
  const acao = obj.acao;
  const action: RouteAction =
    acao === "imagem" ||
    acao === "codigo" ||
    acao === "pesquisa" ||
    acao === "documento" ||
    acao === "grafico" ||
    acao === "projeto"
      ? acao
      : "responder";
  const nivel = obj.nivel;
  const tier: ModelTier = nivel === "economico" || nivel === "potente" ? nivel : "padrao";
  return {
    provider,
    effort,
    tier,
    mode: mode === "projeto" ? "projeto" : "rapido",
    action,
    reason: typeof obj.motivo === "string" ? obj.motivo : "",
  };
}

/** Regra simples de reserva, para quando a decisão por IA não está disponível. */
export function heuristicRoute(message: string): Route {
  const text = message.toLowerCase();
  const wantsImage =
    /\b(imagem|foto|ilustra|logotipo|logo|desenho|figura|banner|p[ôo]ster|wallpaper|arte)/.test(text) &&
    /\b(cri|ger|fa[çz]|desenh|produz|quero|preciso)/.test(text);
  const wantsCode = /\b(execut|rode|rodar|calcul|compil|rodando)/.test(text);
  const wantsSearch =
    /\b(pesquis|busqu|busca|procur|not[íi]cia|cota[çc][ãa]o|[úu]ltim|agora|hoje|atual|recent|quem ganhou|quem venceu|resultado d)/.test(
      text,
    );
  const wantsChart = /\b(gr[áa]fico|chart|visualiza|pizza|barras?|plotar?|plot)\b/.test(text);
  const wantsProject =
    /\b(projeto|aplicativo|app|site|programa|sistema|c[óo]digo|script)\b/.test(text) &&
    /\b(zip|arquivos|baixar|download|gere|cria|monta|entreg|pasta|pronto)\b/.test(text);
  const wantsDoc =
    /\b(pdf|planilha|csv|excel|xlsx|documento|relat[óo]rio|arquivo|docx?)\b/.test(text) &&
    /\b(ger|cri|fa[çzc]|monta|produz|export|quero|preciso|baix|transform|organiz)/.test(text);
  const isSite = /\b(site|landing|p[áa]gina|html|css)\b/.test(text);
  const isCode = /\b(c[óo]digo|program|bug|fun[çc][ãa]o|api|script|sql|javascript|python|algoritmo)/.test(text);
  const isBig = message.length > 500 || /\b(arquitetura|relat[óo]ri|an[áa]lise completa|an[áa]lise detalhada|passo a passo|projeto grande)/.test(text);
  const isWriting = /\b(escrev|redi[jg]|texto|email|e-mail|post|legenda|planej)/.test(text);

  // Ordem segue o doc "Melhor IA por função": do mais específico ao mais geral.
  if (wantsImage) return { provider: "gpt", effort: "medium", tier: "padrao", mode: "rapido", action: "imagem", reason: "Imagem: gerar com o GPT." };
  if (wantsChart) return { provider: "claude", effort: "medium", tier: "padrao", mode: "rapido", action: "grafico", reason: "Gráfico: a IA modela os dados e a OCK desenha." };
  if (wantsProject) return { provider: "claude", effort: "high", tier: "padrao", mode: "projeto", action: "projeto", reason: "Projeto: a IA escreve os arquivos e a OCK compacta em .zip." };
  if (wantsDoc) return { provider: "claude", effort: "high", tier: "padrao", mode: "rapido", action: "documento", reason: "Gerar arquivo: a IA monta o conteúdo e a OCK renderiza o documento." };
  if (wantsSearch) return { provider: "gemini", effort: "low", tier: "economico", mode: "rapido", action: "pesquisa", reason: "Informação atual: buscar na web (Gemini)." };
  if (wantsCode) return { provider: "gemini", effort: "medium", tier: "padrao", mode: "rapido", action: "codigo", reason: "Rodar código: ambiente seguro do Gemini." };
  if (isBig) return { provider: "claude", effort: "high", tier: "potente", mode: "projeto", action: "responder", reason: "Tarefa difícil: Claude Opus (potente)." };
  if (isCode) return { provider: "claude", effort: "high", tier: "padrao", mode: "rapido", action: "responder", reason: "Código: Claude Sonnet (padrão)." };
  if (isSite) return { provider: "gpt", effort: "high", tier: "padrao", mode: "rapido", action: "responder", reason: "Visual/site: GPT Sol (melhor por dólar)." };
  if (isWriting) return { provider: "gpt", effort: "medium", tier: "padrao", mode: "rapido", action: "responder", reason: "Texto geral: GPT Sol (padrão)." };
  return { provider: "claude", effort: "low", tier: "economico", mode: "rapido", action: "responder", reason: "Tarefa simples: Claude Haiku (econômico)." };
}

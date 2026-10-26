// Contrato que toda IA cumpre. O motor só conhece este contrato, nunca uma IA específica:
// trocar a IA simulada por uma real é trocar o adaptador, sem mexer no motor.

/** As IAs disponíveis na plataforma. */
export type ProviderId = "claude" | "gpt" | "gemini";

/**
 * Quanto a IA "pensa" antes de responder. É a maior alavanca de custo e de tempo:
 * - low: vai direto ao ponto, sem raciocínio extra. Mais rápido e barato (tarefas simples/montagem).
 * - medium: um pouco de raciocínio. Bom padrão.
 * - high: raciocina bastante antes de escrever. Mais caro e lento (casos difíceis, back-end, revisão a fundo).
 * O Chefe pode ajustar isso por etapa (otimização de tempo+tokens).
 */
export type Effort = "low" | "medium" | "high";

/**
 * Nível do MODELO dentro de uma mesma IA, do mais barato ao mais forte:
 * - economico: modelo pequeno/barato (tarefas simples). Ex.: Claude Haiku.
 * - padrao: modelo equilibrado (a maioria das tarefas). Ex.: Claude Sonnet.
 * - potente: modelo top (tarefas difíceis, só quando precisa). Ex.: Claude Opus.
 */
export type ModelTier = "economico" | "padrao" | "potente";

/** Nível usado quando a etapa não escolhe outro. As receitas ainda não escolhem: todas rodam no padrão. */
export const DEFAULT_TIER: ModelTier = "padrao";

/** O que o motor manda para uma IA em cada etapa. */
export interface GenerateRequest {
  /** Instrução do papel (prompt de sistema). */
  systemPrompt: string;
  /** Texto de entrada da etapa: o pedido do usuário e o que as etapas anteriores produziram. */
  input: string;
  /** Tamanho máximo da resposta, em tokens. Controla o custo. */
  maxOutputTokens: number;
  /** Quanto a IA deve "pensar" nesta etapa. Sem valor, o adaptador usa "medium". */
  effort?: Effort;
  /** Nível do modelo (econômico/padrão/potente). Sem valor, o adaptador usa "padrao". */
  tier?: ModelTier;
  /** Imagens para a IA "enxergar" (visão). Cada uma com o tipo (ex.: image/png) e o conteúdo em base64. */
  images?: { mime: string; base64: string }[];
  /**
   * Exemplo de resposta definido na receita. Só a IA simulada usa;
   * os adaptadores das IAs reais ignoram este campo.
   */
  sampleResponse?: string;
  /** Permite cancelar a geração no meio. */
  signal?: AbortSignal;
}

/** Consumo da IA numa etapa, em tokens. É a base do custo. */
export interface Usage {
  /** Toda a entrada, contando a que veio do cache e a que foi gravada nele. */
  inputTokens: number;
  /** Toda a saída, contando o "pensamento" (as empresas cobram os dois). */
  outputTokens: number;
  /** Quanto da entrada veio do cache da empresa da IA (sai mais barato). Sem valor: nada. */
  cachedInputTokens?: number;
  /** Quanto da entrada foi gravado no cache nesta chamada (na OpenAI, sai mais caro). Sem valor: nada. */
  cacheWriteTokens?: number;
}

/** Cada pedaço que a IA devolve enquanto escreve. */
export type GenerateChunk =
  | { type: "text"; text: string }
  | {
      type: "done";
      usage: Usage;
      /** Modelo exato usado (vai para o histórico interno). */
      model: string;
      /** true quando a resposta foi cortada por atingir maxOutputTokens. */
      truncated: boolean;
    };

/** Uma IA: recebe um pedido e devolve a resposta em pedaços, terminando com um "done". */
export interface AiProvider {
  id: ProviderId;
  generate(request: GenerateRequest): AsyncIterable<GenerateChunk>;
}

/**
 * Erro de uma IA. `retryable` diz se vale a pena tentar de novo (ex.: IA sobrecarregada).
 * `model`, quando o conector sabe, é o modelo exato que falhou, e `usage`, o consumo que a empresa da IA informou antes
 * de a resposta cair: vão para o registro interno do custo (F26), que sem eles conta pelo tamanho do texto.
 */
export class ProviderError extends Error {
  readonly retryable: boolean;
  readonly model?: string;
  readonly usage?: Usage;

  constructor(message: string, options: { retryable: boolean; model?: string; usage?: Usage }) {
    super(message);
    this.name = "ProviderError";
    this.retryable = options.retryable;
    this.model = options.model;
    this.usage = options.usage;
  }
}

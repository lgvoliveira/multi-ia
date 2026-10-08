// Contrato que toda IA cumpre. O motor só conhece este contrato, nunca uma IA específica:
// trocar a IA simulada por uma real é trocar o adaptador, sem mexer no motor.

/** As IAs disponíveis na plataforma. */
export type ProviderId = "claude" | "gpt" | "gemini";

/** O que o motor manda para uma IA em cada etapa. */
export interface GenerateRequest {
  /** Instrução do papel (prompt de sistema). */
  systemPrompt: string;
  /** Texto de entrada da etapa: o pedido do usuário e o que as etapas anteriores produziram. */
  input: string;
  /** Tamanho máximo da resposta, em tokens. Controla o custo. */
  maxOutputTokens: number;
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
  inputTokens: number;
  outputTokens: number;
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

/** Erro de uma IA. `retryable` diz se vale a pena tentar de novo (ex.: IA sobrecarregada). */
export class ProviderError extends Error {
  readonly retryable: boolean;

  constructor(message: string, options: { retryable: boolean }) {
    super(message);
    this.name = "ProviderError";
    this.retryable = options.retryable;
  }
}

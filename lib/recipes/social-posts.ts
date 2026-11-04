// Receita "Posts para redes sociais": o Estrategista define o público e três ângulos; dois Redatores, de IAs
// diferentes, escrevem AO MESMO TEMPO um post para cada ângulo; o Editor fica com a melhor versão de cada ângulo e
// entrega três opções prontas, que viram um arquivo Word.
// Os textos de systemPrompt e instruction são as instruções que cada IA recebe.

import {
  SAMPLE_POSTS_BRIEF,
  SAMPLE_POSTS_DRAFT_1,
  SAMPLE_POSTS_DRAFT_2,
  SAMPLE_POSTS_FINAL,
} from "./social-posts.samples";
import { NO_MADE_UP_DATA, TEXT_FORMAT_RULES } from "./text-format";
import { soloStage, type Recipe, type Step } from "./types";

/** O que vale para quem escreve os posts: os redatores e o editor. */
export const POST_RULES = `Regras dos posts:
- Escreva para a rede que o pedido citar; se não citar nenhuma, para o Instagram.
- Instagram e Facebook: texto curto (até umas 120 palavras), emojis com moderação e de 3 a 5 hashtags.
- LinkedIn: tom profissional, poucos emojis e no máximo 3 hashtags.
- WhatsApp (status ou lista de transmissão): curto e direto, sem hashtags.
- A chamada para ação diz o que fazer depois de ler (ex.: pedir pelo WhatsApp, visitar a loja, comentar).
- Nada de promessa que a empresa não pode cumprir ou provar, como "o melhor da cidade" ou "resultado garantido", principalmente em saúde, beleza e dinheiro.`;

const WRITER_PROMPT = `Você é redator de redes sociais de pequenas e médias empresas brasileiras.
Você escreve textos curtos, naturais e fáceis de ler no celular, que soam como gente e não como anúncio.
Escreva sempre em português do Brasil.`;

/** A etapa de um dos dois redatores. Os dois recebem a mesma tarefa; a diferença está na IA de cada um. */
function draftStep(id: string, roleId: string, name: string, sampleOutput: string): Step {
  return {
    id,
    roleId,
    name,
    summary: "Vai escrever um post para cada ângulo",
    doneSummary: "Escreveu um post para cada ângulo da estratégia",
    instruction: `Nesta etapa, escreva 3 posts, um para cada ângulo da estratégia. Outro redator escreve os mesmos 3 ângulos ao mesmo tempo, e o editor vai ficar com a melhor versão de cada um.

Para cada post, escreva:
- O ângulo (o nome que a estratégia deu).
- Chamada: a primeira frase, a que prende a atenção.
- Legenda: o resto do texto do post, terminando com a chamada para ação.
- Hashtags (só se a rede usa).
- Ideia de imagem: o que fotografar ou criar para acompanhar o post.

${POST_RULES}

${NO_MADE_UP_DATA}

Entregue só os 3 posts, sem comentários.`,
    inputs: [
      { from: "request", label: "Pedido" },
      { from: "step", stepId: "brief", label: "Estratégia" },
    ],
    maxOutputTokens: 1500,
    // Textos curtos não pedem "pensamento": esforço baixo, mais rápido e barato.
    effort: "low",
    sampleOutput,
    format: "text",
  };
}

export const socialPostsRecipe: Recipe = {
  id: "social-posts",
  name: "Posts para redes sociais",
  description:
    "Um estrategista planeja, duas IAs escrevem ao mesmo tempo e um editor escolhe as melhores. Você recebe 3 opções em Word.",
  requestPlaceholder:
    "Ex.: Posts para o Instagram da Pão Quente, nossa padaria em Campinas, divulgando o novo café da manhã de sábado, das 7h às 11h. Tom leve e acolhedor.",
  resultTitle: "Seus posts estão prontos",
  documentName: "Posts para redes sociais",

  roles: [
    {
      id: "strategist",
      name: "Estrategista",
      description: "Define o público, o tom e três ângulos para os posts",
      suggestedProvider: "claude",
      backupProvider: "gpt",
      systemPrompt: `Você é estrategista de redes sociais de pequenas e médias empresas brasileiras.
Você sabe o que faz um post ser lido, lembrado e compartilhado, e pensa no público antes de pensar no texto.
Escreva sempre em português do Brasil.`,
    },
    // A reserva dos dois redatores é o Gemini: se um falhar, os dois continuam sendo de IAs diferentes.
    {
      id: "writer1",
      name: "Redator 1",
      description: "Escreve um post para cada ângulo, ao mesmo tempo que o Redator 2",
      suggestedProvider: "gpt",
      backupProvider: "gemini",
      systemPrompt: WRITER_PROMPT,
    },
    {
      id: "writer2",
      name: "Redator 2",
      description: "Escreve um post para cada ângulo, ao mesmo tempo que o Redator 1",
      suggestedProvider: "claude",
      backupProvider: "gemini",
      systemPrompt: WRITER_PROMPT,
    },
    {
      id: "editor",
      name: "Editor",
      description: "Fica com a melhor versão de cada ângulo, acerta o tom e entrega 3 opções prontas",
      suggestedProvider: "gpt",
      backupProvider: "claude",
      systemPrompt: `Você é o editor de redes sociais de pequenas e médias empresas brasileiras.
Você compara textos, fica com o melhor, corta o que sobra, acerta o tom e deixa cada post pronto para publicar.
Escreva sempre em português do Brasil.`,
    },
  ],

  // A estratégia, depois os dois redatores ao mesmo tempo, depois o editor.
  stages: [
    soloStage({
      id: "brief",
      roleId: "strategist",
      name: "Estrategista",
      summary: "Vai definir o público, o tom e três ângulos para os posts",
      doneSummary: "Definiu o público, o tom e três ângulos para os posts",
      instruction: `Nesta etapa, monte a estratégia dos posts para os redatores seguirem. Não escreva os posts.

Organize assim:
1. Objetivo: o que os posts precisam conseguir (vender, divulgar uma novidade, trazer gente para a loja...).
2. Público: quem vai ler e o que essa pessoa valoriza.
3. Rede: a que o pedido citou (se não citou nenhuma, o Instagram). Se citou mais de uma, a principal e o que muda nas outras.
4. Três ângulos: três jeitos diferentes de contar a mesma coisa, um por post, cada um com um nome curto e o que destacar.
5. Tom de voz: como a empresa fala e o que evitar.
6. Chamada para ação: o que a pessoa deve fazer depois de ler.
7. Informações que faltam: o que o pedido não informou e os posts vão precisar (preço, endereço, contato, datas).

${NO_MADE_UP_DATA}

Seja direto: no máximo meia página, em tópicos.`,
      inputs: [{ from: "request", label: "Pedido" }],
      maxOutputTokens: 1000,
      effort: "medium",
      sampleOutput: SAMPLE_POSTS_BRIEF,
      format: "text",
    }),
    {
      id: "drafts",
      kind: "parallel",
      steps: [
        draftStep("draft1", "writer1", "Redator 1", SAMPLE_POSTS_DRAFT_1),
        draftStep("draft2", "writer2", "Redator 2", SAMPLE_POSTS_DRAFT_2),
      ],
    },
    soloStage({
      id: "final",
      roleId: "editor",
      name: "Editor",
      summary: "Vai ficar com a melhor versão de cada ângulo e entregar 3 opções prontas",
      doneSummary: "Ficou com a melhor versão de cada ângulo, acertou o tom e entregou 3 opções prontas",
      instruction: `Nesta etapa, você (o editor) entrega a versão final: 3 posts prontos para publicar, um para cada ângulo da estratégia.

Para cada ângulo, compare a versão dos dois redatores e fique com a melhor, ou junte o melhor das duas. Acerte o tom de acordo com a estratégia, corrija o português e confira as regras abaixo. Não cite os redatores no texto.

Escreva assim:
- A primeira linha é o título, com a rede e o assunto (ex.: "# Posts para o Instagram — Café da manhã de sábado").
- Cada post começa com "## Opção 1 — " (depois 2 e 3) e o ângulo, em poucas palavras.
- Em seguida, numa linha, **Chamada:** e a primeira frase do post.
- Depois, o resto do texto do post, em parágrafos curtos, terminando com a chamada para ação.
- Depois, numa linha, **Hashtags:** e as hashtags (só se a rede usa).
- Por fim, numa linha, **Ideia de imagem:** e o que fotografar ou criar para acompanhar o post.
- Se a estratégia citar mais de uma rede, diga em cada opção, numa linha, como adaptá-la para as outras.
- Se usou marcadores entre colchetes, termine com a seção "## Antes de publicar", listando o que a pessoa precisa preencher.

${POST_RULES}

${NO_MADE_UP_DATA}

${TEXT_FORMAT_RULES}`,
      inputs: [
        { from: "request", label: "Pedido" },
        { from: "step", stepId: "brief", label: "Estratégia" },
        { from: "step", stepId: "draft1", label: "Posts do Redator 1" },
        { from: "step", stepId: "draft2", label: "Posts do Redator 2" },
      ],
      maxOutputTokens: 2000,
      // Comparar e escolher pede um pouco de "pensamento": esforço médio.
      effort: "medium",
      sampleOutput: SAMPLE_POSTS_FINAL,
      format: "text",
    }),
  ],
};

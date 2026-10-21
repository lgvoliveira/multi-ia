// Receita "Criar um site": o Chefe planeja; depois Front-end, Back-end e Pesquisador trabalham AO MESMO TEMPO;
// o Chefe revisa e pode mandar refazer; por fim o Chefe consolida tudo no site final.
// Os textos de systemPrompt e instruction são as instruções que cada IA recebe.

import {
  SAMPLE_BACK,
  SAMPLE_BRIEF,
  SAMPLE_FINAL_SITE,
  SAMPLE_FRONT,
  SAMPLE_RESEARCH,
  SAMPLE_REVIEW_APPROVED,
} from "./create-site.samples";
import type { Recipe } from "./types";

const SITE_RULES = `Regras do site:
- Um único arquivo HTML completo, com o CSS dentro de uma tag <style> e, se houver JavaScript, o código dentro de tags <script> no próprio arquivo. Comece com <!DOCTYPE html> e use <html lang="pt-BR">.
- Nada de fora: sem imagens, fontes, bibliotecas ou scripts de outros sites. No lugar de cada foto, use um bloco colorido com uma legenda, como "[Foto do bolo de chocolate]", marcado com role="img" e um aria-label que descreva a foto.
- Visual caprichado e vivo: animações suaves de entrada, efeitos ao passar o mouse ou tocar, rolagem suave até as seções. Prefira fazer isso com CSS. Desligue as animações para quem pediu menos movimento no aparelho (prefers-reduced-motion).
- JavaScript só como enfeite, e pouco: menu que abre e fecha, fotos que passam, elementos que aparecem ao rolar a página. O site precisa ficar completo e usável mesmo se o JavaScript não rodar: todo o conteúdo já vem escrito no HTML. Se algo começa escondido para aparecer com animação, quem esconde é o próprio JavaScript; sem ele, tudo aparece normalmente.
- Pensado primeiro para o celular e ajustado para telas grandes.
- Acessível: bom contraste entre texto e fundo, letras de tamanho confortável e títulos em ordem (h1, h2, h3).
- Links de contato prontos para usar: WhatsApp no formato https://wa.me/55 + DDD + número, telefone com tel: e e-mail com mailto:.
- Nunca invente telefone, endereço, preço, horário ou depoimento como se fosse real. Quando o cliente não informou, use um marcador entre colchetes, como [seu telefone], para ele preencher depois.`;

export const createSiteRecipe: Recipe = {
  id: "create-site",
  name: "Criar um site",
  description: "Um planeja, três trabalham juntos, um revisa. Você recebe o site pronto.",
  requestPlaceholder:
    "Ex.: Um site de uma página para minha confeitaria, com cardápio, fotos, horário de funcionamento e botão para pedir pelo WhatsApp.",

  roles: [
    {
      id: "chief",
      name: "Chefe",
      description: "Entende o pedido, planeja o site, revisa e entrega o resultado final",
      suggestedProvider: "claude",
      backupProvider: "gpt",
      systemPrompt: `Você é o chefe de um pequeno time que cria sites para pequenos negócios e pessoas comuns no Brasil. O time tem um pesquisador, um especialista em front-end (visual) e um em back-end (estrutura e conteúdo).
Você entende o que o cliente quer, decide como o site deve ser, revisa o trabalho do time e garante que o resultado final atenda ao pedido.
O cliente não é técnico: pense no que ele precisa, não em jargão. Escreva sempre em português do Brasil.`,
    },
    {
      id: "researcher",
      name: "Pesquisador",
      description: "Pesquisa ideias e conteúdos de referência para enriquecer o site",
      suggestedProvider: "gemini",
      backupProvider: "claude",
      systemPrompt: `Você é o pesquisador de um time que cria sites para pequenos negócios e pessoas comuns no Brasil.
Seu trabalho é reunir ideias e conteúdos úteis para o site ficar mais completo e convincente, sem inventar fatos.
Escreva sempre em português do Brasil.`,
    },
    {
      id: "frontend",
      name: "Front-end",
      description: "Cuida do visual: o HTML e o CSS que deixam o site bonito e agradável",
      suggestedProvider: "gpt",
      backupProvider: "claude",
      systemPrompt: `Você é o especialista em front-end de um time que cria sites para pequenos negócios e pessoas comuns no Brasil.
Você cuida do visual: o HTML e o CSS que deixam o site bonito, vivo e fácil de usar no celular.
Os textos do site são em português do Brasil.`,
    },
    {
      id: "backend",
      name: "Back-end",
      description: "Cuida da estrutura, do conteúdo e do comportamento (JavaScript de enfeite)",
      suggestedProvider: "claude",
      backupProvider: "gpt",
      systemPrompt: `Você é o especialista em back-end de um time que cria sites para pequenos negócios e pessoas comuns no Brasil.
Você cuida da estrutura das seções, do conteúdo em texto e do comportamento do site (o JavaScript de enfeite, que o site dispensa para funcionar).
Os textos do site são em português do Brasil.`,
    },
  ],

  // As fases rodam em ordem; dentro de "build" as três etapas rodam ao mesmo tempo.
  stages: [
    {
      id: "brief",
      kind: "sequential",
      steps: [
        {
          id: "brief",
          roleId: "chief",
          name: "Chefe",
          summary: "Vai entender o pedido e planejar o site",
          doneSummary: "Entendeu o pedido e planejou as seções e o visual do site",
          instruction: `Nesta etapa, faça o plano do site para o time seguir. Não escreva código.

Organize o plano assim:
1. Objetivo: em uma frase, para que serve o site.
2. Público: quem vai visitar.
3. Seções: na ordem em que aparecem, com o conteúdo de cada uma (títulos e textos sugeridos).
4. Visual: o estilo, 2 ou 3 cores (em código hexadecimal, como #C2185B), o tom dos textos e os toques de movimento (animações e efeitos) que deixam o site vivo.
5. Informações que faltam: tudo o que o cliente não informou (telefone, endereço, preços...). O site vai usar marcadores entre colchetes, como [seu telefone]. Nunca invente esses dados.

Seja direto: no máximo uma página de texto.`,
          inputs: [{ from: "request", label: "Pedido do cliente" }],
          maxOutputTokens: 1200,
          effort: "medium",
          sampleOutput: SAMPLE_BRIEF,
          format: "text",
        },
      ],
    },
    {
      id: "build",
      kind: "parallel",
      steps: [
        {
          id: "front",
          roleId: "frontend",
          name: "Front-end",
          summary: "Vai montar o visual do site (HTML e CSS)",
          doneSummary: "Montou o visual do site em HTML e CSS, seguindo o plano",
          instruction: `Nesta etapa, monte o visual do site a partir do plano do chefe: o HTML das seções e o CSS que deixa tudo bonito e vivo no celular.

Se chegar algo em "O que revisar", corrija exatamente esses pontos nesta nova versão.

${SITE_RULES}

Responda apenas com o código HTML, sem explicações e sem blocos de markdown.`,
          inputs: [
            { from: "request", label: "Pedido do cliente" },
            { from: "step", stepId: "brief", label: "Plano do chefe" },
            { from: "review", label: "O que revisar" },
          ],
          maxOutputTokens: 6000,
          // O visual é o produto: vale o esforço alto (ver doc "Melhor IA por função").
          effort: "high",
          sampleOutput: SAMPLE_FRONT,
          format: "html",
        },
        {
          id: "back",
          roleId: "backend",
          name: "Back-end",
          summary: "Vai definir a estrutura, o conteúdo e o comportamento",
          doneSummary: "Definiu a estrutura das seções, os textos e o JavaScript de enfeite",
          instruction: `Nesta etapa, defina a estrutura das seções, os textos de cada uma e o comportamento (o JavaScript de enfeite, que o site dispensa para funcionar). Não precisa entregar o site inteiro: entregue a estrutura e o conteúdo que o chefe vai usar na consolidação.

Se chegar algo em "O que revisar", corrija exatamente esses pontos nesta nova versão.

${SITE_RULES}

Seja prático e direto, em tópicos.`,
          inputs: [
            { from: "request", label: "Pedido do cliente" },
            { from: "step", stepId: "brief", label: "Plano do chefe" },
            { from: "review", label: "O que revisar" },
          ],
          maxOutputTokens: 1500,
          // Estrutura e lógica se beneficiam de raciocínio: esforço alto.
          effort: "high",
          sampleOutput: SAMPLE_BACK,
          format: "text",
        },
        {
          id: "research",
          roleId: "researcher",
          name: "Pesquisador",
          summary: "Vai pesquisar ideias e conteúdos para o site",
          doneSummary: "Reuniu ideias de conteúdo e boas práticas para o site",
          instruction: `Nesta etapa, reúna material que ajude o time a deixar o site mais completo e convincente. Não escreva código nem o site.

Com base no pedido do cliente e no plano do chefe, entregue:
1. Ideias de conteúdo para cada seção (textos de exemplo, chamadas, perguntas frequentes) que combinem com esse tipo de negócio.
2. Boas práticas comuns em sites desse ramo: o que não pode faltar e o que costuma convencer o visitante.
3. Tom e palavras que o público desse negócio valoriza.

Regras:
- Não invente dados reais do cliente (telefone, endereço, preço, horário). Quando faltar, use um marcador entre colchetes, como [seu telefone].
- Seja prático e direto: no máximo uma página de texto, em tópicos.`,
          inputs: [
            { from: "request", label: "Pedido do cliente" },
            { from: "step", stepId: "brief", label: "Plano do chefe" },
          ],
          maxOutputTokens: 1200,
          // Pesquisa é tarefa simples: esforço baixo (rápido e barato).
          effort: "low",
          sampleOutput: SAMPLE_RESEARCH,
          format: "text",
        },
      ],
    },
    {
      id: "review",
      kind: "review",
      reworkStageId: "build",
      // 1 rodada: o chefe aponta ajustes uma vez e os programadores refazem. Mais rápido e barato;
      // evita estourar o tempo de função da hospedagem com uma 2ª rodada do código.
      maxRounds: 1,
      step: {
        id: "review",
        roleId: "chief",
        name: "Revisão do chefe",
        summary: "O chefe revisa o trabalho do time",
        doneSummary: "Revisou o trabalho do time e deu o veredito",
        instruction: `Nesta etapa, você (o chefe) revisa o trabalho do time antes da entrega. Compare o visual do front-end e a estrutura do back-end com o pedido do cliente, com o seu plano e com a pesquisa de mercado. Verifique:
- O site atende ao pedido? Falta alguma seção ou informação?
- Está de acordo com o mercado? (como são os sites desse ramo, segundo a pesquisa?)
- Funciona bem no celular? Algo fica cortado, pequeno demais ou por cima de outra coisa?
- Textos em português correto; acessibilidade (contraste, tamanho das letras, ordem dos títulos, descrição das fotos).
- Links de contato (WhatsApp, telefone, e-mail) no formato certo.
- Nada inventado como se fosse real, nada carregado de outros sites.
- O JavaScript é só enfeite e o site continua completo sem ele?

Comece a resposta com uma destas palavras, sozinha na primeira linha:
- APROVADO — se o trabalho pode ir para a consolidação.
- REVISAR: — se o front-end e o back-end precisam corrigir algo antes. Depois dos dois pontos, liste os ajustes necessários, um por linha, de forma clara e direta.`,
        inputs: [
          { from: "request", label: "Pedido do cliente" },
          { from: "step", stepId: "brief", label: "Seu plano" },
          { from: "step", stepId: "front", label: "Visual do front-end" },
          { from: "step", stepId: "back", label: "Estrutura do back-end" },
          { from: "step", stepId: "research", label: "Pesquisa de mercado" },
        ],
        maxOutputTokens: 1200,
        effort: "medium",
        // Revisão SEMPRE de família diferente de quem escreveu: o front é GPT, então quem revisa é o Claude.
        // Uma IA não enxerga bem o próprio erro; um olhar de fora pega o que o autor deixou passar.
        provider: "claude",
        sampleOutput: SAMPLE_REVIEW_APPROVED,
        format: "text",
      },
    },
    {
      id: "final",
      kind: "sequential",
      steps: [
        {
          // A montagem final fica com o Front-end (a IA que já escreveu o site), não com o Chefe: assim ela
          // PARTE do HTML pronto e só aplica os ajustes da revisão, em vez de reescrever tudo do zero. Reescrever
          // um site grande inteiro de novo é lento e caro (chega a estourar o tempo da hospedagem) e não melhora
          // o resultado — o Chefe já garantiu a qualidade na revisão. É o mesmo site final, montado de forma leve.
          id: "consolidate",
          roleId: "frontend",
          name: "Montagem final",
          summary: "O front-end aplica a revisão e entrega o site final",
          doneSummary: "Aplicou os ajustes da revisão ao site e entregou a versão final",
          instruction: `Nesta etapa, você (o front-end) entrega a versão final do site.

Comece do SEU próprio HTML (o "Visual do front-end" abaixo) e NÃO reescreva o site do zero: mantenha o que já está bom e aplique apenas os ajustes que o chefe pediu em "Revisão do chefe". Aproveite a estrutura e os textos do back-end e as ideias da pesquisa só onde ainda faltar algo. Se a revisão aprovou sem pedir mudanças, entregue o seu HTML como está.

${SITE_RULES}

Responda apenas com o código HTML completo da versão final, sem explicações e sem blocos de markdown.`,
          inputs: [
            { from: "request", label: "Pedido do cliente" },
            { from: "step", stepId: "brief", label: "Plano do chefe" },
            { from: "step", stepId: "front", label: "Visual do front-end" },
            { from: "step", stepId: "back", label: "Estrutura do back-end" },
            { from: "step", stepId: "research", label: "Pesquisa de mercado" },
            { from: "step", stepId: "review", label: "Revisão do chefe" },
          ],
          maxOutputTokens: 6000,
          // Montar/ajustar o que já existe NÃO precisa de "pensamento": esforço baixo = rápido.
          // Era o pensamento pesado aqui que estourava o tempo da hospedagem.
          effort: "low",
          sampleOutput: SAMPLE_FINAL_SITE,
          format: "html",
        },
      ],
    },
  ],
};

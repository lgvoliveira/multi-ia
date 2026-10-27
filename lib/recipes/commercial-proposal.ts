// Receita "Proposta comercial": o Consultor entende o pedido e monta o roteiro; o Redator escreve a proposta; o Cliente
// exigente lê como quem vai recebê-la e aponta o que melhorar; o Redator aplica os apontamentos e entrega a versão
// final, que vira um arquivo Word. Quem critica é de outra família de IA (uma IA não enxerga bem o próprio erro).
// Os textos de systemPrompt e instruction são as instruções que cada IA recebe.

import {
  SAMPLE_PROPOSAL_BRIEF,
  SAMPLE_PROPOSAL_CRITIQUE,
  SAMPLE_PROPOSAL_DRAFT,
  SAMPLE_PROPOSAL_FINAL,
} from "./commercial-proposal.samples";
import { NO_MADE_UP_DATA, TEXT_FORMAT_RULES } from "./text-format";
import { soloStage, type Recipe } from "./types";

export const commercialProposalRecipe: Recipe = {
  id: "commercial-proposal",
  name: "Proposta comercial",
  description: "Um consultor planeja, um redator escreve e um cliente exigente critica. Você recebe a proposta em Word.",
  requestPlaceholder:
    "Ex.: Proposta para a Clínica Sorriso, que pediu a gestão do Instagram dela por 3 meses: 12 posts por mês, stories e um relatório mensal. Somos a Agência Ponto, de Campinas.",
  resultTitle: "Sua proposta está pronta",
  documentName: "Proposta comercial",

  roles: [
    {
      id: "consultant",
      name: "Consultor",
      description: "Entende o pedido do cliente e monta o roteiro da proposta",
      suggestedProvider: "claude",
      backupProvider: "gpt",
      systemPrompt: `Você é um consultor comercial experiente, que ajuda pequenas e médias empresas brasileiras a preparar propostas para os clientes delas.
Você entende o que o cliente precisa, o que a empresa oferece e como mostrar o valor do trabalho sem exagero.
Escreva sempre em português do Brasil.`,
    },
    {
      id: "writer",
      name: "Redator",
      description: "Escreve a proposta e entrega a versão final",
      suggestedProvider: "gpt",
      backupProvider: "claude",
      systemPrompt: `Você é o redator de propostas comerciais de pequenas e médias empresas brasileiras.
Você escreve com clareza, de forma profissional e direta, no tom de quem quer ganhar a confiança do cliente, sem jargão e sem exagero.
Escreva sempre em português do Brasil.`,
    },
    {
      id: "client",
      name: "Cliente exigente",
      description: "Lê a proposta como o cliente que vai recebê-la e aponta o que melhorar",
      suggestedProvider: "claude",
      backupProvider: "gpt",
      systemPrompt: `Você faz o papel do cliente que recebe uma proposta comercial: uma pessoa ocupada, exigente e cuidadosa com o dinheiro.
Você lê a proposta procurando o que está vago, o que parece caro sem explicação, o que promete demais e o que falta para decidir.
Escreva sempre em português do Brasil.`,
    },
  ],

  // As quatro fases rodam uma depois da outra, cada uma com uma etapa só.
  stages: [
    soloStage({
      id: "brief",
      roleId: "consultant",
      name: "Consultor",
      summary: "Vai entender o pedido e montar o roteiro da proposta",
      doneSummary: "Entendeu o pedido e montou o roteiro da proposta",
      instruction: `Nesta etapa, monte o roteiro da proposta para o redator seguir. Não escreva a proposta.

Organize o roteiro assim:
1. Cliente e necessidade: quem é o cliente e o que ele precisa, em poucas linhas.
2. O que a empresa vai oferecer: o que será feito, os entregáveis e o que fica de fora.
3. Argumentos: por que esta empresa e esta solução valem a pena para esse cliente.
4. Seções da proposta: na ordem, com o que cada uma deve dizer.
5. Informações que faltam: tudo o que o pedido não informou (valores, prazos, dados da empresa, forma de pagamento, validade da proposta).

${NO_MADE_UP_DATA}

Seja direto: no máximo uma página, em tópicos.`,
      inputs: [{ from: "request", label: "Pedido" }],
      maxOutputTokens: 1200,
      effort: "medium",
      sampleOutput: SAMPLE_PROPOSAL_BRIEF,
      format: "text",
    }),
    soloStage({
      id: "draft",
      roleId: "writer",
      name: "Redator",
      summary: "Vai escrever a proposta",
      doneSummary: "Escreveu a proposta seguindo o roteiro do consultor",
      instruction: `Nesta etapa, escreva a proposta comercial completa, seguindo o roteiro do consultor.

Uma boa proposta tem, nesta ordem (adapte ao caso):
- O título, com o nome do cliente.
- Apresentação: uma ou duas frases sobre a empresa e o motivo da proposta.
- O que entendemos da sua necessidade.
- A solução proposta: o que será feito, os entregáveis e o que não está incluído.
- Prazo e etapas.
- Investimento e forma de pagamento.
- Validade da proposta e próximos passos.

${NO_MADE_UP_DATA}

${TEXT_FORMAT_RULES}`,
      inputs: [
        { from: "request", label: "Pedido" },
        { from: "step", stepId: "brief", label: "Roteiro do consultor" },
      ],
      maxOutputTokens: 2500,
      effort: "medium",
      sampleOutput: SAMPLE_PROPOSAL_DRAFT,
      format: "text",
    }),
    soloStage({
      id: "critique",
      roleId: "client",
      name: "Cliente exigente",
      summary: "Vai ler a proposta como o cliente e apontar o que melhorar",
      doneSummary: "Leu a proposta como o cliente e apontou o que melhorar",
      instruction: `Nesta etapa, leia a proposta como se você fosse o cliente que vai recebê-la. Verifique:
- Ela atende ao que o cliente pediu? Falta alguma informação para ele decidir?
- Está claro o que será entregue, em quanto tempo e o que não está incluído?
- O valor está justificado pelo que é entregue? Há promessas exageradas ou arriscadas?
- Algum dado foi inventado como se fosse real, em vez de ficar num marcador entre colchetes?
- O texto está em português correto, profissional e fácil de ler?

Não reescreva a proposta. Liste os ajustes, um por linha, de forma clara e direta. Se ela já pode ir para o cliente como está, diga isso em uma frase.`,
      inputs: [
        { from: "request", label: "Pedido" },
        { from: "step", stepId: "draft", label: "Proposta" },
      ],
      maxOutputTokens: 1000,
      effort: "medium",
      sampleOutput: SAMPLE_PROPOSAL_CRITIQUE,
      format: "text",
    }),
    soloStage({
      // A versão final fica com o Redator (quem escreveu): ele parte da própria proposta e só aplica os apontamentos,
      // em vez de reescrever tudo. Mais rápido e mais barato, e o estilo continua o mesmo.
      id: "final",
      roleId: "writer",
      name: "Versão final",
      summary: "O redator aplica os apontamentos e entrega a proposta final",
      doneSummary: "Aplicou os apontamentos do cliente exigente e entregou a versão final",
      instruction: `Nesta etapa, você (o redator) entrega a versão final da proposta.

Comece da SUA proposta e não reescreva do zero: mantenha o que já está bom e aplique os ajustes que o cliente exigente apontou. Se ele disse que a proposta já pode ir como está, entregue-a como está.

${NO_MADE_UP_DATA}

${TEXT_FORMAT_RULES}`,
      inputs: [
        { from: "request", label: "Pedido" },
        { from: "step", stepId: "draft", label: "Sua proposta" },
        { from: "step", stepId: "critique", label: "Apontamentos do cliente exigente" },
      ],
      maxOutputTokens: 2500,
      // Aplicar ajustes no que já existe não pede "pensamento": esforço baixo, mais rápido e barato.
      effort: "low",
      sampleOutput: SAMPLE_PROPOSAL_FINAL,
      format: "text",
    }),
  ],
};

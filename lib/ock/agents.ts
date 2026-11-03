// Os agentes prontos do OCK: assistentes de IA já montados para uma função, organizados por área (ex.: TI tem agentes
// devs). O funcionário escolhe um e conversa com ele no chat; cada agente responde "no personagem" dele, com a persona
// que o servidor injeta (lib/ock/agent-persona.ts). Este arquivo é só DADOS da tela (nome, função, chamadas de partida),
// NUNCA a instrução da IA — essa fica no servidor, como as outras instruções das IAs (lib/ock/quick-task.ts).

/** Uma área de trabalho, com os agentes dela. */
export interface AgentArea {
  id: string;
  name: string;
  /** Uma frase curta do que a área cobre. */
  blurb: string;
  agents: AgentSummary[];
}

/** Um agente, do jeito que a tela mostra. A persona (instrução da IA) NÃO vem aqui: fica no servidor. */
export interface AgentSummary {
  id: string;
  areaId: string;
  /** O "apelido" do agente ("Dani"). */
  name: string;
  /** A função, curta ("Dev full-stack"). */
  role: string;
  /** Uma linha do que ele faz, para o cartão. */
  tagline: string;
  /** Perguntas de partida que o chat oferece ao abrir o agente. */
  starters: string[];
}

type AreaDef = Omit<AgentArea, "agents"> & { agents: Omit<AgentSummary, "areaId">[] };

const AREAS: AreaDef[] = [
  {
    id: "ti",
    name: "Tecnologia e dados",
    blurb: "Agentes devs e de dados: código, telas, APIs, banco e consultas.",
    agents: [
      {
        id: "ti-fullstack",
        name: "Dani",
        role: "Dev full-stack",
        tagline: "Tira dúvidas de código, monta telas e APIs e explica a solução passo a passo.",
        starters: [
          "Como estruturo uma API REST para um cadastro de clientes?",
          "Revise este trecho de código e aponte os problemas.",
          "Qual banco de dados usar para um app de agendamento?",
        ],
      },
      {
        id: "ti-front",
        name: "Fael",
        role: "Front-end",
        tagline: "HTML, CSS, React e telas que funcionam bem no celular.",
        starters: [
          "Como deixo este layout responsivo no celular?",
          "Explique a diferença entre flexbox e grid.",
          "Crie um componente de botão acessível em React.",
        ],
      },
      {
        id: "ti-dados",
        name: "Sol",
        role: "Dados e SQL",
        tagline: "Consultas SQL, limpeza de dados e relatórios a partir dos seus números.",
        starters: [
          "Escreva uma consulta SQL para o total de vendas por mês.",
          "Como removo linhas duplicadas de uma planilha?",
          "Explique o que é um JOIN em SQL com um exemplo.",
        ],
      },
    ],
  },
  {
    id: "marketing",
    name: "Marketing e conteúdo",
    blurb: "Agentes de conteúdo: posts, anúncios, e-mails e textos para o Google.",
    agents: [
      {
        id: "mkt-social",
        name: "Mel",
        role: "Redes sociais",
        tagline: "Posts, legendas e calendário de conteúdo para as redes.",
        starters: [
          "Escreva 3 legendas para um post de lançamento.",
          "Monte um calendário de posts para a semana.",
          "Dê ideias de conteúdo para o Instagram da loja.",
        ],
      },
      {
        id: "mkt-copy",
        name: "Téo",
        role: "Textos e anúncios",
        tagline: "Textos de venda, anúncios e e-mails que convencem.",
        starters: [
          "Escreva um anúncio curto para o Google.",
          "Crie um e-mail de promoção para a base de clientes.",
          "Melhore este texto de venda deixando mais claro.",
        ],
      },
      {
        id: "mkt-seo",
        name: "Gi",
        role: "SEO e blog",
        tagline: "Artigos e textos pensados para aparecer no Google.",
        starters: [
          "Sugira títulos de blog sobre o meu produto.",
          "Escreva um artigo de 500 palavras sobre um tema.",
          "Que palavras-chave usar para uma loja de bolos?",
        ],
      },
    ],
  },
  {
    id: "vendas",
    name: "Vendas e atendimento",
    blurb: "Agentes de venda e de pós-venda: propostas, abordagem e suporte ao cliente.",
    agents: [
      {
        id: "vendas-propostas",
        name: "Vince",
        role: "Vendas e propostas",
        tagline: "Propostas, follow-up e argumentos para fechar negócio.",
        starters: [
          "Escreva uma proposta comercial para um serviço.",
          "Crie uma mensagem de follow-up para um cliente.",
          "Como responder à objeção “está caro”?",
        ],
      },
      {
        id: "vendas-suporte",
        name: "Cacá",
        role: "Atendimento ao cliente",
        tagline: "Respostas de suporte claras, educadas e no tom certo.",
        starters: [
          "Responda a um cliente insatisfeito com o atraso.",
          "Escreva uma resposta padrão para dúvidas de troca.",
          "Deixe esta resposta num tom mais gentil.",
        ],
      },
      {
        id: "vendas-sdr",
        name: "Sam",
        role: "Prospecção (pré-venda)",
        tagline: "Primeiro contato, qualificação e abordagem de novos clientes.",
        starters: [
          "Escreva uma mensagem de primeiro contato no WhatsApp.",
          "Monte perguntas para qualificar um lead.",
          "Crie um roteiro curto de abordagem por e-mail.",
        ],
      },
    ],
  },
  {
    id: "gestao",
    name: "Gestão e finanças",
    blurb: "Agentes de apoio ao dia a dia: planilhas, RH e documentos simples.",
    agents: [
      {
        id: "gestao-financeiro",
        name: "Fin",
        role: "Financeiro e planilhas",
        tagline: "Contas, planilhas e controle de caixa sem complicação.",
        starters: [
          "Monte uma planilha de fluxo de caixa mensal.",
          "Explique como calcular a margem de lucro.",
          "Organize estes gastos por categoria.",
        ],
      },
      {
        id: "gestao-rh",
        name: "Rô",
        role: "RH e vagas",
        tagline: "Vagas, entrevistas e comunicados internos.",
        starters: [
          "Escreva um anúncio de vaga para vendedor.",
          "Crie 5 perguntas de entrevista para a vaga.",
          "Redija um comunicado interno sobre o feriado.",
        ],
      },
      {
        id: "gestao-juridico",
        name: "Léo",
        role: "Jurídico básico",
        tagline: "Explica termos e rascunha documentos simples (não substitui um advogado).",
        starters: [
          "Explique o que é um contrato de prestação de serviço.",
          "Rascunhe um recibo simples de pagamento.",
          "O que deve ter num termo de confidencialidade?",
        ],
      },
    ],
  },
];

/** As áreas com os agentes, para a tela montar a prateleira por área. */
export const AGENT_AREAS: AgentArea[] = AREAS.map((area) => ({
  id: area.id,
  name: area.name,
  blurb: area.blurb,
  agents: area.agents.map((agent) => ({ ...agent, areaId: area.id })),
}));

/** Todos os agentes, achatados (para buscar por id). */
export const AGENTS: AgentSummary[] = AGENT_AREAS.flatMap((area) => area.agents);

/** Um agente pelo id, ou null se não existe. */
export function findAgent(id: string): AgentSummary | null {
  return AGENTS.find((agent) => agent.id === id) ?? null;
}

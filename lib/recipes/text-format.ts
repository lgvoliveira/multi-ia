// Regras de escrita das receitas que terminam num texto (ex.: a proposta comercial). O texto final aparece na tela e
// vira um arquivo Word (lib/ock/rich-text.ts lê estas marcas), então todas as IAs escrevem do mesmo jeito.

/** Como escrever o texto final: as marcas que a tela e o Word entendem. */
export const TEXT_FORMAT_RULES = `Formato do texto (ele aparece na tela e vira um arquivo Word):
- A primeira linha é o título, começando com "# ".
- Cada título de seção fica numa linha própria, começando com "## ".
- Itens de lista começam com "- ".
- Para destacar uma expressão, use **assim**, com moderação.
- Nada de tabelas, blocos de código, linhas de separação ou comentários seus sobre o texto: só o texto pronto.`;

/** A regra de nunca inventar dados, comum às receitas de texto para empresas. */
export const NO_MADE_UP_DATA = `Nunca invente dados como se fossem reais: preço, prazo, nome, telefone, endereço, CNPJ, cliente atendido, número, certificação ou depoimento. Quando faltar, use um marcador entre colchetes, como [valor do serviço], para a pessoa preencher depois.`;

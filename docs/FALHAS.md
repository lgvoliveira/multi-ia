# FALHAS — registro de falhas e riscos

> Lista viva de tudo o que pode dar errado no projeto: negócio, produto, código, segurança e processo.
> **Toda falha percebida entra aqui**, mesmo que pareça pequena. Ninguém apaga uma falha: quando ela for resolvida,
> muda o status e se escreve como foi resolvida. Assim dá para ver, até o fim, o que já foi resolvido e o que não foi.
> Quem anota: qualquer um (Luis, o parceiro, Claude, Codex). O Claude anota sempre que perceber uma falha nova numa conversa.
> Criado em 22/10/2026.

**Status:** Aberta (ainda sem solução) · Decidida (já se sabe o que fazer, falta fazer) ·
Aceita (risco conhecido que escolhemos correr por enquanto) · Resolvida

**Gravidade:** Alta (pode matar o negócio ou expor dados) · Média · Baixa

**Como anotar uma falha nova:** use o próximo número livre (F30, F31…), coloque na tabela-resumo e na seção da
categoria, com a data. Ao mudar o status, escreva a data e o que aconteceu.

## Resumo

| # | Falha | Categoria | Gravidade | Status |
|---|-------|-----------|-----------|--------|
| F01 | Sem as receitas, o produto vira mais um chat com várias IAs | Negócio | Alta | Decidida |
| F02 | Público "empresas pequenas e médias" é amplo demais | Negócio | Média | Aceita |
| F03 | O Chefe escolher a IA mais barata pode entregar um resultado ruim | Produto | Alta | Decidida |
| F04 | Preço e margem não definidos | Negócio | Alta | Aberta |
| F05 | LGPD: o que o dono vê e para onde vão os dados dos clientes | Negócio / Segurança | Alta | Aberta |
| F06 | Vender para empresa é mais lento e trabalhoso | Negócio | Média | Aberta |
| F07 | O resultado precisa ser claramente melhor que "abrir o ChatGPT e pedir" | Negócio | Média | Aberta |
| F08 | As receitas não existem dentro do workspace do funcionário | Produto | Alta | Aberta |
| F09 | Resultado que um leigo não sabe usar (ex.: arquivo .html) | Produto | Média | Aberta |
| F10 | Login de mentira: o código na URL é o "estar logado" | Segurança | Alta | Resolvida |
| F11 | Painel do dono sem login e senhas temporárias expostas | Segurança | Alta | Resolvida |
| F12 | Senha temporária guardada sem criptografia | Segurança | Média | Resolvida |
| F13 | Só existe uma empresa, fixa no código ("demo") | Código | Alta | Resolvida |
| F14 | As tabelas do banco (Supabase) não estão no repositório | Código | Alta | Resolvida |
| F15 | Pacote `xlsx` com falhas de segurança conhecidas | Segurança | Média | Resolvida |
| F16 | Rotas que gastam IA de verdade abertas para qualquer um | Segurança | Alta | Resolvida |
| F17 | Preços das IAs e câmbio fixos no código | Código | Média | Aberta |
| F18 | Prévia de site: o Chrome "aquece" uma conexão antes de bloquear | Segurança | Baixa | Aceita |
| F19 | Testado só no Chrome | Código | Baixa | Aberta |
| F20 | Mudança grande de produto entrou num PR só, sem registro nos documentos | Processo | Média | Decidida |
| F21 | O parceiro usa a conta do GitHub do Luis | Processo / Segurança | Média | Aberta |
| F22 | O OCK nunca rodou no computador do Luis | Processo | Média | Resolvida |
| F23 | Apagar um funcionário devolve o gasto dele ao crédito da empresa | Código | Alta | Resolvida |
| F24 | Gasto e teto falham com pedidos ao mesmo tempo | Código | Média | Resolvida |
| F25 | O próprio dono define o crédito da empresa | Negócio / Segurança | Alta | Resolvida |
| F26 | O custo das tentativas que falharam não fica registrado | Código | Média | Resolvida |
| F27 | Qualquer pessoa pode ler as execuções direto no banco | Segurança | Alta | Resolvida |
| F28 | Apagar um arquivo direto pelo banco deixa o conteúdo guardado | Segurança / LGPD | Baixa | Aberta |
| F29 | O saldo da empresa pode ficar negativo | Negócio | Baixa | Aceita |
| F30 | E-mails do login só chegam para a equipe do Supabase | Código | Média | Aberta |
| F31 | Next.js 16.4.0 com falhas de segurança graves conhecidas | Segurança | Alta | Resolvida |
| F32 | O e-mail do funcionário não é conferido | Segurança / Produto | Baixa | Aberta |
| F33 | O dono consegue entrar na conta de um funcionário pelo link de senha nova | Segurança / LGPD | Média | Aceita |
| F34 | Painel do dono usado com o login de outra aba, sem aviso | Produto / Código | Baixa | Resolvida |
| F35 | O texto das IAs só aparece quando a fase inteira termina | Produto / Código | Média | Resolvida |
| F36 | Execução parada no meio ficava parada para sempre | Código | Média | Resolvida |
| F37 | Cancelar não parava a IA no meio da fase | Código | Média | Resolvida |
| F38 | "Concluído em" mostrava só o tempo da última fase | Produto / Código | Baixa | Resolvida |
| F39 | A chamada interna ia para o endereço que vinha no pedido | Segurança | Média | Resolvida |
| F40 | Os conectores das IAs de verdade medem o consumo pelo tamanho do texto | Código | Alta | Resolvida |
| F41 | "+ Adicionar agente" mostra o agente, mas ele nunca trabalha | Produto / Código | Baixa | Resolvida |
| F42 | Sem a chave de uma IA, o site usa a IA simulada sem avisar | Código | Média | Resolvida |
| F43 | Quedas raras do servidor na hora de cobrar | Código | Baixa | Aceita |
| F44 | Anexos do chat: o texto vai inteiro para a IA, e o que ela não lê é aceito sem aviso | Código / Produto | Média | Resolvida |
| F45 | Sem a pesquisa ou o código de verdade, a IA é instruída a esconder isso | Produto | Média | Resolvida |
| F46 | O PR #40 entrou na `main` sem descrição e antes do teste pelo guia | Processo | Baixa | Resolvida |
| F47 | O site feito pela receita não vira entrega | Produto | Média | Resolvida |
| F48 | O "Gasto do mês" fica menor que o real depois de 1.000 gastos no mês | Código | Baixa | Resolvida |
| F49 | O nome e o título dos documentos do chat saíam do pedido do funcionário | Segurança / LGPD | Média | Resolvida |
| F50 | Os conectores das IAs de verdade mandariam pedidos que as APIs de hoje recusam | Código | Alta | Resolvida |
| F51 | Resposta cortada no meio, ou recusada pela IA, era aceita como resposta completa | Código | Média | Resolvida |
| F52 | O código fala com as IAs sem as bibliotecas oficiais, ao contrário do que diz o AGENTS.md | Processo | Baixa | Aberta |
| F53 | O aviso de "não pesquisou" depende do texto no fim da resposta | Produto / Código | Baixa | Aceita |
| F54 | Uma fase com IA de verdade pode passar do tempo máximo da função na Vercel | Código | Média | Aberta |
| F55 | Com as IAs de verdade por último, o site é montado sem medir custo, tempo e qualidade de verdade | Processo / Produto | Média | Aceita |
| F56 | A tela ao vivo das receitas de texto mostrava "Plano do chefe" | Produto / Código | Baixa | Resolvida |
| F57 | O Editor dos posts é da mesma IA que um dos redatores | Produto | Baixa | Aceita |

## Negócio

### F01 — Sem as receitas, o produto vira mais um chat com várias IAs
- **Gravidade:** Alta · **Status:** Decidida · **Anotada:** 22/10/2026
- **O problema:** um chat com várias IAs e um painel de gastos é fácil de copiar, e os grandes já vendem algo
  parecido para empresas (ChatGPT e Claude têm planos para equipes, o Google inclui o Gemini em muitos planos do
  Workspace, a Microsoft tem o Copilot). Muitas PMEs já pagam algum deles.
- **Decisão (Luis, 22/10):** as receitas ficam no centro do workspace do funcionário, em três modos: receita pronta,
  receita própria e tarefa rápida. Falta construir (ver F08).

### F02 — Público "empresas pequenas e médias" é amplo demais
- **Gravidade:** Média · **Status:** Aceita · **Anotada:** 22/10/2026
- **O problema:** uma agência de marketing, um escritório de contabilidade e uma clínica precisam de receitas
  diferentes. Público amplo dificulta a mensagem de venda e a escolha das receitas.
- **Decisão (Luis, 22/10):** seguir amplo por enquanto, para testar com tipos diferentes de empresa. Se mais adiante
  fizer sentido nichar (ex.: agências), o produto já estará pronto e muda pouco. Revisar depois dos primeiros testes com
  empresas.

### F04 — Preço e margem não definidos
- **Gravidade:** Alta · **Status:** Aberta · **Anotada:** 22/10/2026
- **O problema:** a plataforma paga as IAs em dólar e revende o uso em reais. Funcionário que usa muito, ou o dólar
  subindo, come a margem. Ainda não está decidido se a cobrança é por empresa, por funcionário ou pelo consumo, nem
  quanto de margem entra sobre o custo das IAs.
- **O que fazer:** discutir no Cowork depois de medir o custo real de uso com as IAs de verdade.
- **Andamento (25/10/2026, PR 3b):** decisão provisória do Luis: por enquanto, cada uso custa o que as IAs custam, sem
  margem (`USAGE_MARGIN = 0` em `lib/ock/pricing.ts`, o único lugar a mudar). O custo em dólar de cada chamada fica em
  `ai_calls`, base para decidir.

### F05 — LGPD: o que o dono vê e para onde vão os dados dos clientes
- **Gravidade:** Alta · **Status:** Aberta · **Anotada:** 22/10/2026
- **O problema:** (1) se o dono pode ler as conversas, os funcionários precisam saber disso; (2) os funcionários vão
  colar dados dos clientes da empresa, que vão para servidores das IAs nos EUA; (3) no plano grátis, o Gemini usa o
  conteúdo para melhorar os produtos do Google, então nunca pode receber dados de empresas reais.
- **O que fazer:** decidir o que o dono vê (só entregas e gastos, ou as conversas inteiras); termos de uso e política de
  privacidade antes da primeira empresa real; Gemini no plano pago antes de qualquer cliente.
- **Andamento (24/10/2026):** parte (1) decidida pelo Luis: o dono vê só o resumo e as entregas, não as conversas
  (ver `BANCO-DE-DADOS.md`). Partes (2) e (3) continuam abertas.
- **Andamento (24/10/2026, PR #24):** as regras de acesso do banco novo já garantem a parte (1): o dono não consegue
  ler execuções, conversas nem tarefas dos funcionários, e um teste confere isso em todo PR.
- **Andamento (25/10/2026, PR 3c):** com o chat de volta, o teste de ponta a ponta conferiu a parte (1): a dona da
  empresa recebeu "não encontrada" para a conversa da funcionária e para o anexo que ela mandou; só as entregas (os
  arquivos que as IAs fizeram) ela pode baixar, como decidido.
- **Andamento (25/10/2026, parte 3d):** o painel do dono mostra o crédito, o gasto do mês de cada pessoa, as linhas do
  extrato (a receita numa linha só) e as entregas, tudo lido com o login do dono; as contas novas do banco rodam com o
  login de quem chama, então as regras de acesso valem dentro delas (testado no banco e de ponta a ponta: o dono nunca
  recebe o pedido). O funcionário lê, nas abas Entregas e Meus gastos, "O dono da empresa vê suas entregas e quanto cada
  tarefa custou. Suas conversas, não." Achada e corrigida no caminho a F49 (o nome dos documentos vinha do pedido).

### F06 — Vender para empresa é mais lento e trabalhoso
- **Gravidade:** Média · **Status:** Aberta · **Anotada:** 22/10/2026
- **O problema:** cada empresa exige conversa, demonstração e confiança, e o tempo dos dois sócios é curto.
- **O que fazer:** conversar com 3 a 5 donos de empresa antes de construir muito mais; poucas empresas pagando já
  validam a ideia.

### F07 — O resultado precisa ser claramente melhor que "abrir o ChatGPT e pedir"
- **Gravidade:** Média · **Status:** Aberta · **Anotada:** 09/10/2026 (no PROGRESSO), trazida para cá em 22/10/2026
- **O problema:** muita gente já usa uma IA sozinha, às vezes de graça. O time de IAs das receitas precisa entregar um
  resultado claramente melhor ou dar muito menos trabalho.
- **O que fazer:** o teste planejado na etapa 4 continua valendo: o mesmo pedido feito a uma IA sozinha e a uma
  receita, com os resultados mostrados a algumas pessoas sem dizer qual é qual.

## Produto

### F03 — O Chefe escolher a IA mais barata pode entregar um resultado ruim
- **Gravidade:** Alta · **Status:** Decidida · **Anotada:** 22/10/2026
- **O problema:** no PR #19 o Chefe decide sozinho a IA, o nível do modelo e o esforço, buscando o mais barato que
  resolve. Se ele errar numa tarefa importante, o funcionário recebe algo fraco e culpa a plataforma.
- **Decisão (Luis, 22/10):** a plataforma recomenda (IA, nível e esforço), mas o funcionário escolhe livremente
  ("quero o melhor", "quero o Claude nesta tarefa"). Falta construir.
- **Andamento (25/10/2026, PR 3c):** no chat, cada mensagem guarda o que o Chefe recomendou e o que foi usado
  (`tasks.recommended_*` e `chosen_*`); por enquanto, os dois são iguais. A escolha livre é da etapa 6.

### F08 — As receitas não existem dentro do workspace do funcionário
- **Gravidade:** Alta · **Status:** Aberta · **Anotada:** 22/10/2026
- **O problema:** o workspace (`/trabalho`) só tem o chat. A receita "Criar um site" ficou no código
  (`/recipes/create-site`), mas fora da página inicial e sem ligação com a empresa, o funcionário ou os gastos.
- **O que fazer:** trazer os três modos (receita pronta, receita própria, tarefa rápida) para o workspace, com o gasto
  de cada receita contando no teto do funcionário.
- **Andamento (25/10/2026, PR 3b):** o gasto da receita "Criar um site" já sai da carteira da empresa e conta no teto
  do funcionário. Falta trazê-la para dentro do workspace (hoje ela abre por um link em `/trabalho`).
- **Andamento (25/10/2026, PR 3c):** o espaço de trabalho (`/trabalho`) voltou com o chat (a tarefa rápida) e um atalho
  para a receita "Criar um site". Trazer as receitas para dentro dele é da etapa 6.
- **Andamento (25/10/2026, issue #42):** a pedido do Luis, a receita pronta entrou no espaço de trabalho antes da etapa
  6: a aba Receitas mostra as receitas em cartões, e a escolhida abre ali mesmo. Falta a receita própria (etapa 6).
- **Andamento (26/10/2026, bloco 1, issue #54):** a segunda receita pronta, "Proposta comercial", a primeira que termina
  num texto (com Copiar e Word, que vira entrega). Faltam as receitas de posts e de relatório e a receita própria, nos
  próximos PRs do bloco 1.
- **Andamento (27/10/2026, bloco 1, PR 2):** a terceira receita pronta, "Posts para redes sociais", com dois redatores
  de IAs diferentes trabalhando ao mesmo tempo. Faltam a receita do relatório e a receita própria.

### F09 — Resultado que um leigo não sabe usar
- **Gravidade:** Média · **Status:** Aberta · **Anotada:** 09/10/2026 (no PROGRESSO), trazida para cá em 22/10/2026
- **O problema:** um arquivo `.html` baixado não serve para quem não sabe o que fazer com ele.
- **O que fazer:** pensar em entregas prontas para uso (ex.: "publicar o site com um clique", num endereço separado do
  nosso por segurança).

### F35 — O texto das IAs só aparece quando a fase inteira termina
- **Gravidade:** Média · **Status:** Resolvida · **Anotada:** 24/10/2026 (ao planejar o PR 3)
- **O problema:** na T6, a tela mostrava o texto das IAs enquanto elas escreviam. O PR #19 passou a guardar a execução
  no banco, em partes (uma fase de cada vez), mas o servidor só grava a narração quando a fase **inteira** termina
  (`app/api/runs/[id]/continue/route.ts` junta os eventos e grava tudo no fim). A tela fica parada até lá. Com a IA
  simulada são poucos segundos; com IAs de verdade, a fase do Programador leva um ou dois minutos sem nada mudar, e a
  pessoa pode achar que travou.
- **Decisão (Luis, 24/10/2026):** corrigir na parte 3a do PR 3: o servidor grava a narração aos poucos, enquanto a fase
  roda, e a tela busca as novidades com o login de quem pediu.
- **Resolvida (24/10/2026, PR 3a, issue #33):** a narração espera numa fila e vai para o banco a cada segundo, enquanto a
  fase roda (`lib/runs/event-buffer.ts`); os pedaços de texto de cada etapa viram um evento só, para não gravar uma linha
  por palavra (uma execução inteira com a IA simulada deu 53 eventos). A tela busca as novidades a cada segundo. No teste
  de ponta a ponta, o texto do Chefe apareceu na tela com o cartão ainda em "Trabalhando…".

### F38 — "Concluído em" mostrava só o tempo da última fase
- **Gravidade:** Baixa · **Status:** Resolvida · **Anotada:** 24/10/2026 (achada pelo Claude no PR 3a)
- **O problema:** desde que a execução passou a rodar em partes (PR #19), o motor mede o tempo de cada parte, e o "fim"
  levava só o tempo da última fase (a consolidação), não o que a pessoa esperou desde o pedido.
- **Resolvida (24/10/2026, PR 3a):** o servidor troca esse tempo pelo tempo desde o pedido. A primeira versão da correção
  misturava o relógio do banco com o do computador, e um deles estava 5 segundos adiantado ("34 s" para 29 s de espera);
  agora as duas datas vêm do relógio do banco e só o tempo da última fase vem do relógio do servidor. No teste: "27 s"
  para 27 s de espera.

### F41 — "+ Adicionar agente" mostra o agente, mas ele nunca trabalha
- **Gravidade:** Baixa · **Status:** Resolvida · **Anotada:** 25/10/2026 (achada pelo Claude ao planejar o PR 3b)
- **O problema:** o botão do PR #19, na tela de montar o time, acrescentava um agente na lista (com o aviso "gastam mais
  tokens"), mas ele nunca ia para o servidor nem trabalhava. Com a estimativa de custo na tela, a pessoa ainda veria um
  agente "de mentira" sem custo.
- **Resolvida (25/10/2026, PR 3b):** o botão saiu (decisão do Luis). Montar o próprio time é a receita própria, da
  etapa 6.

### F45 — Sem a pesquisa ou o código de verdade, a IA é instruída a esconder isso
- **Gravidade:** Média · **Status:** Resolvida · **Anotada:** 25/10/2026 (achada pelo Claude ao planejar a parte 3c)
- **O problema:** quando o Chefe escolhe "pesquisa" (informação atual da internet) ou "código" (rodar uma conta) e o
  Gemini não está disponível, o chat do parceiro (`app/api/ock/route.ts`) manda o pedido para o Claude com instruções
  como "NUNCA diga que não tem acesso à internet" e "Faça a conta VOCÊ MESMO… NUNCA diga que não tem ambiente de
  execução". A pessoa recebe uma conta feita "de cabeça" ou uma informação possivelmente velha como se tivesse sido
  calculada ou pesquisada. Numa empresa, isso vira decisão errada, e a culpa cai na plataforma (como em F03).
- **O que fazer:** proposta na issue #39 (parte 3c): enquanto a pesquisa e o código de verdade não estiverem ligados, a
  resposta diz que a IA não pesquisou na internet nem rodou o código. Com as IAs de verdade, o mesmo aviso vale sempre
  que a ferramenta falhar.
- **Resolvida (25/10/2026, PR 3c):** saíram as instruções que mandavam esconder. Enquanto a pesquisa e o código de
  verdade não chegam, a IA é instruída a dizer que não pesquisou nem rodou o código, e a resposta vem com um aviso fixo,
  escrito por nós ("A pesquisa na internet ainda não está ligada..."), que não depende de a IA obedecer.
- **Andamento (26/10/2026, PR da pesquisa e do código):** a pesquisa na internet (do Claude) e o código (do Gemini)
  ficaram prontos, desligados até o Luis ligar (`OCK_AI_TOOLS`). Quando a IA pesquisa, a resposta termina com as fontes;
  quando roda um programa, com a frase "A IA rodou um programa para fazer esta conta." O aviso fixo passou a dizer o que
  aconteceu, com a ferramenta desligada ou com a IA preferindo não usar: "Esta resposta não veio de uma pesquisa na
  internet…" e "A IA fez esta conta sem rodar um programa…". Limitação aceita: F53.

### F47 — O site feito pela receita não vira entrega
- **Gravidade:** Média · **Status:** Decidida · **Anotada:** 25/10/2026 (achada pelo Claude ao planejar a parte 3d)
- **O problema:** o site pronto da receita "Criar um site" fica só na execução (`runs`), que o dono não pode ler
  (decisão da F05). Ele não vira um arquivo em `files`, então não aparece na aba Entregas do funcionário nem chegaria ao
  painel do dono. Justo a entrega mais importante ficaria de fora do "o dono vê o que cada um entregou".
- **O que fazer:** issue #43 (parte 3d), aprovada pelo Luis: quando o site fica pronto, o servidor guarda o `.html` na
  pasta fechada como entrega da pessoa, ligado à execução. Sempre baixa como arquivo, nunca abre como página (AGENTS.md,
  seção 6). Só os sites novos.
- **Resolvida (25/10/2026, parte 3d):** quando a receita termina, o servidor guarda o `.html` como entrega de quem pediu
  (`lib/runs/site-delivery.ts`), com o nome tirado do título do site, antes de a execução aparecer como terminada; se o
  servidor cair e retomar, não guarda duas vezes. Se não der para guardar, a execução termina assim mesmo (o site
  continua na tela, com o botão de baixar). Na pasta, o Supabase entrega todo `.html` como texto puro, com "nosniff" e
  como anexo: o navegador só salva, e nem aberto direto o site roda. Os sites feitos antes desta parte não viraram entrega.

### F53 — O aviso de "não pesquisou" depende do texto no fim da resposta
- **Gravidade:** Baixa · **Status:** Aceita · **Anotada:** 26/10/2026 (percebida pelo Claude no PR da pesquisa e do
  código)
- **O problema:** para o histórico saber se uma resposta foi pesquisada na internet (ou se a IA rodou um programa), sem
  coluna nova no banco, o servidor escreve no fim da resposta as fontes ("Fontes consultadas:") ou a frase do programa,
  e o aviso amarelo só aparece quando esse fim não está lá. Se a IA, sem ter pesquisado, terminasse a resposta com uma
  lista igual (inventando fontes), o aviso sumiria. As instruções da IA pedem para não inventar fontes, e o formato
  exato (linha em branco, o título e "- título: endereço") torna isso improvável.
- **Por que aceitar:** evita uma migração agora (a opção mais fácil de desfazer, pedida pelo Luis para a madrugada de
  26/10), e o efeito é só o aviso faltar numa resposta rara.
- **O que fazer depois:** guardar numa coluna de `tasks` se a IA pesquisou ou rodou um programa (migração), junto com
  outra mudança de banco do chat (o apagar da F28 ou a escolha livre da etapa 6).

### F56 — A tela ao vivo das receitas de texto mostrava "Plano do chefe"
- **Gravidade:** Baixa · **Status:** Resolvida · **Anotada:** 27/10/2026 (achada pelo Claude no teste de ponta a ponta
  da receita dos posts)
- **O problema:** enquanto o time trabalha, a caixa "O documento vai tomando forma" junta o que as etapas do "Criar um
  site" escreveram, procurando etapas com nomes fixos (`brief`, `front`, `back`, `research`, `review`) e dando a elas
  os nomes do site ("Plano do chefe", "Visual do site"...). A Proposta comercial (já na `main`) e os Posts também têm
  uma etapa `brief`, então a caixa aparecia nelas com "Plano do chefe", quando quem planeja é o Consultor ou o
  Estrategista. Não vazava nada: era o texto da própria pessoa, com o nome errado.
- **Resolvida (27/10/2026, bloco 1, PR dos posts):** a caixa só aparece nas receitas que terminam num site
  (`components/run-state.ts`). Nas de texto, os cartões das etapas, logo abaixo, já mostram o que cada IA escreveu.

### F57 — O Editor dos posts é da mesma IA que um dos redatores
- **Gravidade:** Baixa · **Status:** Aceita · **Anotada:** 27/10/2026 (percebida pelo Claude ao montar a receita dos
  posts)
- **O problema:** a regra das receitas para PMEs (issue #54) é que quem revisa seja de uma família de IA diferente de
  quem escreveu, porque uma IA não enxerga bem o próprio erro e tende a preferir o próprio jeito de escrever. Nos posts,
  o Editor (GPT) escolhe entre os textos do Redator 1 (GPT) e do Redator 2 (Claude): pode preferir os do GPT sem que
  sejam melhores. Com dois redatores de famílias diferentes, só um Editor Gemini ficaria de fora das duas.
- **Por que aceitar:** o time foi o aprovado pelo Luis na issue #54, as IAs de cada papel são provisórias até o bloco
  6, e a pessoa pode trocar a IA do Editor na tela do time.
- **O que fazer depois:** no bloco 6, com a IA de verdade, comparar o Editor GPT com um Editor Gemini (ou Claude) em
  alguns pedidos e mostrar o resultado ao Luis antes de mudar.

## Código e segurança

### F10 — Login de mentira
- **Gravidade:** Alta · **Status:** Resolvida · **Anotada:** 22/10/2026
- **O problema:** depois do login, o funcionário é reconhecido só pelo código dele na URL (`/trabalho?member=...`).
  Quem tiver o link entra como ele, sem senha. O próprio código avisa que é provisório.
- **O que fazer:** sessão de verdade (cookie seguro, com o login do Supabase ou equivalente) antes de qualquer empresa real.
- **Resolvida (24/10/2026, PR 2a):** login pelo Supabase Auth, guardado num cookie seguro (biblioteca `@supabase/ssr`).
  Cada página protegida confere o login pela assinatura e lê o cadastro no banco a cada pedido (`lib/auth/viewer.ts`);
  ninguém é reconhecido pelo endereço.

### F11 — Painel do dono sem login e senhas temporárias expostas
- **Gravidade:** Alta · **Status:** Resolvida · **Anotada:** 22/10/2026
- **O problema:** `/dono` e a rota `/api/ock/company` não pedem login. Qualquer pessoa pode ver os funcionários,
  criar e apagar funcionários, mudar tetos e o crédito da empresa. A rota devolve as senhas temporárias de quem ainda
  não trocou a senha.
- **O que fazer:** login do dono e conferência, em toda rota, de que quem pede é o dono daquela empresa.
- **Resolvida (24/10/2026, PR 2a):** `/dono` só abre para o dono logado, e a equipe é lida com a sessão dele (as regras
  do banco só mostram a empresa dele). A rota `/api/ock/company` e o painel antigo foram apagados. As ações do dono
  (convidar, teto, desativar) chegam no PR 2b, também conferidas pelo banco.
- **Andamento (24/10/2026, PR 2b):** as ações do dono chegaram. Cada uma confere de novo, no servidor, que quem pede é
  o dono logado; teto e situação mudam pela sessão dele (o banco só deixa mexer nos funcionários da empresa dele), e o
  convite usa a empresa tirada do login, nunca do formulário.

### F12 — Senha temporária guardada sem criptografia
- **Gravidade:** Média · **Status:** Resolvida · **Anotada:** 22/10/2026
- **O problema:** a senha temporária que o dono entrega fica em texto puro no banco até o funcionário trocar.
  A senha definitiva já é guardada com hash (scrypt).
- **O que fazer:** trocar por um convite por e-mail (link de uso único) ou guardar também a temporária com hash.
- **Resolvida (24/10/2026, PR 2a):** não existe mais senha temporária no código nem no banco novo: as senhas ficam só com
  o Supabase Auth. O convite do funcionário será um link de uso único, que o dono copia e manda (decisão do Luis, 24/10;
  PR 2b). O banco antigo do parceiro ainda guarda as temporárias: avisar junto com a F27.
- **Andamento (24/10/2026, PR 2b):** o convite por link chegou: vale 24 horas, funciona uma vez só, e o banco guarda só
  o resumo (sha256) do código, nunca o código. A senha é criada pelo próprio funcionário e vai direto para o Supabase
  Auth. Duas falhas novas apareceram no caminho: F32 e F33.

### F13 — Só existe uma empresa, fixa no código
- **Gravidade:** Alta · **Status:** Resolvida · **Anotada:** 22/10/2026
- **O problema:** as rotas usam sempre a empresa "demo". Não há como cadastrar uma segunda empresa.
- **O que fazer:** cadastro de empresa e todas as rotas olhando a empresa de quem está logado (junto com F10 e F11).
- **Andamento (24/10/2026, PR 2a):** o cadastro de empresa existe, e o login e o painel do dono já olham a empresa de
  quem está logado. O chat (`/api/ock`) ainda usa a empresa "demo" do banco antigo; troca no PR 3.
- **Andamento (24/10/2026, PR 3a):** as receitas gravam cada execução com a empresa e a pessoa tiradas do login. Falta o
  chat (parte 3c).
- **Resolvida (25/10/2026, PR 3c, issue #39):** o chat também tira a empresa e a pessoa do login: saíram o `memberId`
  das rotas e a empresa fixa "demo", junto com `lib/ock/company.ts` (as tabelas antigas). Nenhuma parte do código usa
  mais o banco antigo. No teste de ponta a ponta, um `memberId` de outra pessoa no corpo do pedido foi ignorado.

### F14 — As tabelas do banco não estão no repositório
- **Gravidade:** Alta · **Status:** Resolvida · **Anotada:** 22/10/2026
- **O problema:** o código depende de tabelas no Supabase que o parceiro criou, mas não há nenhum arquivo descrevendo
  essas tabelas. Ninguém além dele consegue montar o banco, e uma mudança nele não fica registrada.
- **Decisão (Luis, 24/10):** em vez de pedir o esquema ao parceiro, refazer o banco do zero num projeto novo do
  Supabase, com as tabelas no repositório como migrações (`supabase/migrations/`). Proposta em `docs/BANCO-DE-DADOS.md`.
  Regra nova no AGENTS.md: mudança de tabela só por migração, nunca pelo painel do Supabase. Resolvida quando as
  migrações entrarem na `main`.
- **Resolvida (24/10/2026, PR #24):** as tabelas estão em `supabase/migrations/`, com testes que rodam em todo PR.
  No merge, o Supabase aplica as migrações sozinho no projeto novo.

### F15 — Pacote `xlsx` com falhas de segurança conhecidas
- **Gravidade:** Média · **Status:** Resolvida · **Anotada:** 22/10/2026
- **O problema:** o PR #19 instalou o `xlsx` 0.18.5, a última versão publicada no npm, que tem falhas de segurança
  conhecidas. As versões corrigidas só são distribuídas pelo site do próprio projeto (SheetJS).
- **O que fazer:** trocar por uma versão corrigida ou por outra biblioteca de Excel, antes de produção.
- **Andamento (25/10/2026, PR 3c):** o chat voltou a usar o `xlsx` para transformar em Excel o CSV que a IA escreve. Como
  esse texto pode vir de uma IA influenciada por um texto colado (injeção de prompt), a troca continua necessária antes
  de produção.
- **Resolvida (26/10/2026, PR da planilha):** o pacote `xlsx` saiu do projeto. A planilha é montada por nós
  (`lib/ock/spreadsheet.ts`): um leitor de CSV pequeno e o `.xlsx` montado com o `jszip`, que o projeto já usava (um
  `.xlsx` é um `.zip` de arquivos XML). Sem biblioteca nova. Tudo o que não é número entra como texto (um valor com
  "=" nunca vira fórmula), e os sinais do XML são trocados. Antes de remover, o próprio `xlsx` leu a planilha nova com os
  valores certos. O `npm audit` passou a dizer 0 vulnerabilidades. Em 26/10, o Luis abriu a planilha do chat no Excel:
  abriu sem aviso, com os títulos em negrito e os números somáveis.

### F16 — Rotas que gastam IA de verdade abertas para qualquer um
- **Gravidade:** Alta · **Status:** Resolvida · **Anotada:** 09/10/2026 (no PROGRESSO), ampliada em 22/10/2026
- **O problema:** `/api/runs` (receitas) não tem login, e `/api/ock` (chat) só pede o código do funcionário. Com IAs
  reais, qualquer um gastaria os créditos da plataforma.
- **O que fazer:** nada no ar com chaves reais antes de F10, F11 e F13.
- **Andamento (24/10/2026, PR 2a):** as páginas `/trabalho` e das receitas já exigem login. As rotas `/api/ock/*` e
  `/api/runs` continuam sem conferir o login até o PR 3, que as troca para o banco novo. Enquanto isso, com o banco
  novo, elas falham antes de chamar qualquer IA (as tabelas antigas não existem), menos `/api/ock/transcribe`, que só
  funciona com a chave do GPT da plataforma, que não está configurada.
- **Andamento (24/10/2026, PR 3a):** as rotas `/api/runs` exigem login: começar só para quem é da empresa e está ativo
  (e o mesmo que abriu a página, F34); ver, acompanhar e cancelar só a própria execução, lida com a sessão da pessoa. A
  rota interna `continue` só aceita o próprio servidor. As receitas rodam só com a IA simulada até a cobrança (parte
  3b). Saíram `/api/keys/validate` e `/api/ock/models` (com "Minhas chaves"). Faltam as rotas do chat, `/api/ock/*`
  (parte 3c).
- **Andamento (25/10/2026, PR 3b):** nenhuma receita começa sem reservar na carteira da empresa o máximo que pode gastar,
  e cada etapa é cobrada. As receitas continuam com a IA simulada: as de verdade entram num PR próprio, com F40 e F42.
- **Resolvida (25/10/2026, PR 3c, issue #39):** todas as rotas do chat (`/api/ock/*`) exigem login; mandar mensagem e
  anexar também conferem que o login é o de quem abriu a página (F34). Nenhuma IA trabalha sem antes reservar na carteira
  da empresa, e a rota da voz (`/api/ock/transcribe`, que usava a chave do GPT sem login nem cobrança) saiu até o PR das
  IAs de verdade. No teste de ponta a ponta, sem login as rotas responderam 401. Receitas e chat seguem com a IA
  simulada; ligar as de verdade é o próximo PR (F40, F42).
- **Nota (26/10/2026, PR da voz):** a rota da voz voltou (`/api/ock/transcribe`), já do jeito das outras: só com login,
  só para quem abriu a página (F34), só com a voz ligada (`OCK_AI_TOOLS`) e reservando na carteira da empresa antes de
  chamar a IA.

### F17 — Preços das IAs e câmbio fixos no código
- **Gravidade:** Média · **Status:** Aberta · **Anotada:** 22/10/2026
- **O problema:** `lib/ock/pricing.ts` tem preços aproximados por modelo e o dólar fixo em R$ 5,50. O custo mostrado
  ao dono pode ficar longe do que a plataforma paga de verdade.
- **O que fazer:** conferir os preços com as tabelas oficiais, registrar o custo real em dólar de cada tarefa e usar uma
  cotação atualizada.
- **Andamento (25/10/2026, PR 3b):** cada chamada às IAs das receitas guarda o custo em dólar e o câmbio usado
  (`ai_calls`), e o arredondamento para cima não ganha mais 1 centavo por resto de conta do computador. Os preços e o
  dólar continuam fixos; conferir os preços oficiais entra no PR das IAs de verdade.
- **Andamento (26/10/2026, PR das IAs de verdade):** nomes e preços conferidos nas páginas oficiais da Anthropic, da
  OpenAI e do Google, e guardados num lugar só, `lib/providers/models.ts` (o conector pede o modelo de lá e a conta
  usa o preço de lá). Vários estavam errados: o Claude e o GPT econômicos custam bem menos que o anotado, o Opus, quase
  4 vezes menos, e a saída do GPT potente custa US$ 50 por milhão, não 40 (a plataforma cobraria menos do que paga). O
  Gemini usava apelidos que trocam de modelo sozinhos ("gemini-flash-latest"); agora são nomes fixos, e dois deles
  dobram de preço em datas anunciadas (01/12/2026 e 01/01/2027): a conta troca sozinha na data. A entrada guardada no
  cache das empresas tem preço próprio (na OpenAI, gravar no cache custa 1,25 vez a entrada). **Falta o câmbio:**
  continua R$ 5,50 (decisão do Luis de 25/10), mas cada dólar pago com cartão brasileiro sai por uns R$ 5,6 a 5,7
  (dólar comercial de R$ 5,22 em 28/09, mais o IOF de 3,5% e a margem do banco). A decidir com o Luis.

### F18 — Prévia de site: o Chrome "aquece" uma conexão antes de bloquear
- **Gravidade:** Baixa · **Status:** Aceita · **Anotada:** etapa 4 (T7), trazida para cá em 22/10/2026
- **O problema:** quando o site gerado tenta trocar o endereço da moldura, o Chrome consulta o nome do site de destino
  antes de a regra bloquear. Nenhum dado do site vai junto, mas um atacante poderia esconder poucos caracteres no nome.
- **O que fazer:** reavaliar antes do lançamento público.

### F19 — Testado só no Chrome
- **Gravidade:** Baixa · **Status:** Aberta · **Anotada:** etapa 4 (T7), trazida para cá em 22/10/2026
- **O que fazer:** testar no Firefox e no Safari na rodada de testes com empresas.

### F23 — Apagar um funcionário devolve o gasto dele ao crédito da empresa
- **Gravidade:** Alta · **Status:** Resolvida · **Anotada:** 24/10/2026
- **O problema:** o gasto da empresa é a soma do gasto guardado em cada funcionário (`lib/ock/company.ts`). Ao apagar
  um funcionário, o código apaga também as tarefas, conversas e arquivos dele, e o gasto some da conta: o crédito volta
  para a empresa e o histórico do que foi gasto se perde. Apagar e recriar um funcionário "zera" o gasto, e a plataforma
  paga as IAs do mesmo jeito.
- **O que fazer:** na proposta do banco novo (24/10), a carteira vira um extrato em que nenhuma linha é apagada; quem sai
  da empresa é desativado, não apagado; e apagar o conteúdo (LGPD) não apaga o gasto.
- **Andamento (24/10/2026, PR #24):** o banco novo já resolve: ninguém consegue apagar uma pessoa (só desativar), e o
  extrato não aceita edição nem exclusão. Falta trocar o código para o banco novo (PR 3 da etapa 5).
- **Resolvida (25/10/2026, PR 3c):** saiu o último código do banco antigo (`lib/ock/company.ts`, o gasto guardado em cada
  funcionário). O gasto agora só existe no extrato, que não aceita edição nem exclusão, e ninguém apaga uma pessoa.

### F24 — Gasto e teto falham com pedidos ao mesmo tempo
- **Gravidade:** Média · **Status:** Resolvida · **Anotada:** 24/10/2026
- **O problema:** o custo de uma tarefa é somado ao gasto lido no começo do pedido (`recordTask`), e a recarga lê o total
  e depois grava o novo (`addCompanyCredit`). Com dois pedidos ao mesmo tempo, um custo some. A conferência do teto
  também acontece antes de a IA rodar, sem reservar nada: vários pedidos juntos passam todos e estouram o teto.
- **O que fazer:** mexer no dinheiro só por funções do banco que travam a carteira da empresa enquanto conferem e lançam
  (proposta do banco novo, 24/10).
- **Andamento (24/10/2026, PR #24):** no banco novo, reservar, cobrar e recarregar só acontecem por funções que travam a
  carteira da empresa, e o que está reservado conta no teto. Falta trocar o código (PR 3). Os testes rodam numa conexão
  só e não simulam pedidos simultâneos; a garantia vem da trava.
- **Andamento (25/10/2026, PR 3b):** as receitas já usam as funções da carteira: reservam antes de começar (e de novo,
  ao continuar depois de uma pausa) e cobram cada etapa por elas. Falta o chat (parte 3c).
- **Resolvida (25/10/2026, PR 3c):** o chat também só mexe no dinheiro pelas funções da carteira: reserva antes de
  qualquer IA (o banco confere saldo, teto e se a pessoa está ativa numa operação só) e cobra cada mensagem por
  `wallet_charge`. Não sobrou código que some gasto por conta própria.

### F25 — O próprio dono define o crédito da empresa
- **Gravidade:** Alta · **Status:** Resolvida · **Anotada:** 24/10/2026
- **O problema:** o painel do dono tem "recarregar" e "definir o crédito" (inclusive ilimitado), sem pagamento nenhum.
  Mesmo com o login de verdade (F11), o dono poderia se dar crédito à vontade, e quem paga as IAs é a plataforma.
- **O que fazer:** só a plataforma lança recargas (no MVP, à mão, depois de receber o Pix); o dono vê o saldo e o
  extrato, mas não mexe neles.
- **Andamento (24/10/2026, PR #24):** no banco novo, recarga e ajuste só pelo editor de SQL do painel do Supabase; nem as
  telas nem o nosso servidor conseguem lançar crédito (um teste confere). Falta tirar o "recarregar" do painel do dono
  (PR 3).
- **Resolvida (25/10/2026, conferido no PR 3c):** o painel antigo, com "recarregar" e "definir o crédito", saiu no PR 2a,
  e o de hoje só tem a equipe. Nenhuma tela nem rota do servidor lança crédito: só o editor de SQL do Supabase. O saldo
  volta para o painel do dono na parte 3d, só para ver.

### F26 — O custo das tentativas que falharam não fica registrado
- **Gravidade:** Média · **Status:** Resolvida · **Anotada:** 09/10/2026 (no PROGRESSO), trazida para cá em 24/10/2026
- **O problema:** uma tentativa que cai no meio já consumiu tokens, que a plataforma paga mas não cobra (regra "etapa que
  falhou não é cobrada"). Esse custo não fica guardado em lugar nenhum, então a conta da margem (F04) sai otimista.
- **O que fazer:** registrar toda chamada de IA, inclusive as que falharam, numa tabela interna (proposta do banco novo).
- **Andamento (24/10/2026, PR #24):** a tabela interna `ai_calls` já existe no banco novo. Falta o código gravar nela
  cada chamada, inclusive as que falharam (PR 3).
- **Andamento (24/10/2026, PR 3a):** cada etapa concluída de uma receita vira uma linha em `ai_calls` (modelo, tokens,
  tempo). Faltam o custo em dólar e as tentativas que falharam: o motor ainda não conta os tokens de uma tentativa que
  caiu. Entram com a cobrança (parte 3b).
- **Andamento (25/10/2026, PR 3b):** nas receitas, toda chamada às IAs vira uma linha em `ai_calls`, com o custo em
  dólar e se foi cobrada: as que deram certo, as tentativas que falharam, a etapa interrompida pelo cancelamento e a
  etapa irmã que parou porque outra da fase falhou (essa última nem fechava a conexão com a IA; corrigido junto). Com a
  IA de verdade, o consumo de uma chamada que caiu ainda é a conta pelo tamanho do texto (F40). Falta o chat (parte 3c).
- **Resolvida (25/10/2026, PR 3c):** no chat, toda chamada às IAs também vira linha em `ai_calls`, com `task_id`: o
  Chefe ("chief"), cada tentativa da resposta ("answer"), as que falharam e as de uma mensagem recusada por falta de
  saldo ou de teto (o Chefe já tinha trabalhado). Fica de fora só a medição pelo consumo de verdade, que é a F40.

### F27 — Qualquer pessoa pode ler as execuções direto no banco
- **Gravidade:** Alta · **Status:** Resolvida · **Anotada:** 24/10/2026
- **O problema:** a tela das receitas acompanha a execução lendo as tabelas `runs` e `run_events` direto do Supabase, com
  a chave pública e sem login (`lib/runs/live-client.ts`). Essa chave vai junto com o site, então qualquer pessoa pode
  usá-la. Para o navegador ler sem login, o banco precisa deixar qualquer um ler essas tabelas, e aí dá para listar as
  execuções de todo mundo, com pedido e respostas. Sem o esquema do parceiro (F14) não dá para saber se outras tabelas
  também estão abertas: se as `ock_*` estiverem sem regras de acesso, a mesma chave lê os funcionários e as senhas
  temporárias.
- **O que fazer:** no banco novo, toda tabela nasce com regras de acesso (RLS) e o navegador só lê com a sessão de quem
  está logado. Avisar o parceiro, caso o banco antigo esteja no ar com dados de verdade.
- **Andamento (24/10/2026, PR #24):** no banco novo, a chave pública sem login não lê tabela nenhuma, e cada pessoa logada
  só lê as próprias execuções (testes conferem). Falta trocar a tela das receitas para ler com a sessão de quem está
  logado (PR 3) e avisar o parceiro.
- **Resolvida (24/10/2026, PR 3a):** a tela não fala mais direto com o banco: busca as novidades no nosso servidor, que
  lê com a sessão de quem está logado. No teste de ponta a ponta, o colega da mesma empresa, o dono da empresa e o dono
  de outra empresa receberam "não encontrada" para a execução da Ana, e sem login a resposta foi 401. Fica de fora só
  avisar o parceiro, caso o banco antigo dele esteja no ar com dados de verdade (sem código; está no próximo passo).

### F28 — Apagar um arquivo direto pelo banco deixa o conteúdo guardado
- **Gravidade:** Baixa · **Status:** Aberta · **Anotada:** 24/10/2026
- **O problema:** pelo desenho do banco novo, o funcionário pode apagar os próprios arquivos (LGPD) com a sessão dele.
  Pelas nossas telas, o servidor apaga o registro e o conteúdo na pasta fechada. Mas quem usar a chave pública e a
  própria sessão direto no banco apaga só o registro: o conteúdo fica na pasta. Ninguém consegue mais abri-lo (o link
  só sai a partir do registro), mas ele não foi apagado de verdade, como a LGPD pede.
- **O que fazer:** no PR 3, uma limpeza que apaga da pasta todo conteúdo sem registro (por exemplo, uma vez por dia).
- **Andamento (25/10/2026, PR 3c):** o chat ainda não tem "apagar" (nem conversa nem arquivo); a limpeza entra junto com o
  apagar, no histórico.

### F29 — O saldo da empresa pode ficar negativo
- **Gravidade:** Baixa · **Status:** Aceita · **Anotada:** 24/10/2026
- **O problema:** quando o custo real de uma etapa passa da estimativa, a cobrança entra assim mesmo, porque o consumo da
  IA já aconteceu e a regra é a plataforma não absorver diferenças. Se a empresa estava sem folga no saldo, ele fica
  negativo. Se ela nunca mais recarregar, quem paga essa diferença é a plataforma.
- **Por que aceitar:** a diferença fica limitada ao erro de uma estimativa, o servidor pausa e pergunta antes da etapa
  seguinte quando a reserva estoura, e nenhuma reserva nova passa com saldo negativo. Reavaliar se as estimativas
  errarem muito (regra "estimativas honestas").
- **Andamento (25/10/2026, PR 3b):** como a estimativa das receitas é o máximo que o time pode gastar, o custo só passa
  dela se a medição estiver errada (F40) ou se uma IA reserva mais cara assumir um papel (aí a execução pausa antes da
  fase seguinte).

### F30 — E-mails do login só chegam para a equipe do Supabase
- **Gravidade:** Média · **Status:** Aberta · **Anotada:** 24/10/2026
- **O problema:** o envio de e-mail que vem com o Supabase (confirmar o cadastro, recuperar a senha) só entrega para
  quem é da equipe do projeto no painel do Supabase, e no máximo 2 e-mails por hora no projeto inteiro. Para os testes
  basta, porque o Gmail do projeto é da equipe. Mas o dono de uma empresa de verdade não receberia o e-mail para
  confirmar o cadastro nem para recuperar a senha. O convite do funcionário não depende disso: é um link que o dono copia
  e manda (decisão do Luis, 24/10).
- **O que fazer:** antes da primeira empresa real, ligar um serviço de e-mail próprio no Supabase (*Authentication →
  Emails → SMTP Settings*). Sem domínio, dá para usar o Gmail do projeto com uma "senha de app", de graça; com marca e
  domínio, um serviço de e-mail com o endereço da marca. Junto, entra o "Esqueci minha senha" do dono.

### F31 — Next.js 16.4.0 com falhas de segurança graves conhecidas
- **Gravidade:** Alta · **Status:** Resolvida · **Anotada:** 24/10/2026
- **O problema:** a versão instalada do Next.js (16.4.0) tem três falhas graves publicadas: execução de código pela
  otimização de imagens com SVG (GHSA-2464-fhr4-w9xw), travamento do site pelas "ações do servidor"
  (GHSA-p3m5-59mp-jv5r) e execução de código em funções com `use cache` (GHSA-673q-mjm6-r5xr). O próprio Next.js passou
  a avisar no `npm run build` e no `npm run dev`. Nada está no ar, então ninguém foi exposto. Mas o login (PR 2a)
  passou a usar ações do servidor.
- **O que fazer:** atualizar para a 16.4.3, que corrige as três (junto com o `eslint-config-next`), num PR pequeno, antes
  de publicar qualquer coisa.
- **Resolvida (24/10/2026, PR 2a, a pedido do Luis):** Next.js e `eslint-config-next` na 16.4.3. As correções de
  segurança vieram na 16.4.1; a 16.4.2 e a 16.4.3 só corrigem defeitos (um deles no `proxy.ts`, que o login usa). Entrou
  no próprio PR 2a, e não num PR separado, porque os dois mudam o `package-lock.json` e brigariam no merge. O `npm
  audit` não acusa mais o Next.js, e o build e o `npm run dev` não param mais no aviso.

### F32 — O e-mail do funcionário não é conferido
- **Gravidade:** Baixa · **Status:** Aberta · **Anotada:** 24/10/2026 (PR 2b)
- **O problema:** no convite por link, o e-mail do funcionário é só o nome com que ele entra: nenhum e-mail é mandado
  para conferir se o endereço existe e é dele (quem prova o convite é o link). Daí duas coisas: (1) se o dono digitar o
  e-mail errado, esse vira o login da pessoa; ela vê o e-mail na página do convite, mas para corrigir o dono precisa
  desativar e convidar de novo com o e-mail certo (o cadastro errado fica na lista como desativado); (2) um dono pode
  ocupar o e-mail de outra pessoa, que depois não consegue criar a própria empresa com ele ("Já existe uma conta").
- **O que fazer:** quando houver envio de e-mail próprio (F30), mandar um e-mail de confirmação ao funcionário e ter
  um jeito de liberar um e-mail ocupado. Até lá, a página do convite mostra o e-mail com destaque.

### F33 — O dono consegue entrar na conta de um funcionário pelo link de senha nova
- **Gravidade:** Média · **Status:** Aceita · **Anotada:** 24/10/2026 (PR 2b)
- **O problema:** "Gerar link novo" serve para quem perdeu a senha (critério da issue #27). Mas quem gera o link é o
  dono, e quem tem o link cria a senha. Um dono mal-intencionado pode abrir o link ele mesmo, criar uma senha e entrar
  como o funcionário. Hoje isso não mostra nada (o chat está em obras), mas quando o PR 3 trouxer as conversas de volta,
  ele leria o que o funcionário escreveu, contra a decisão de 24/10 de que o dono não lê conversas (F05).
- **O que já ajuda:** usar o link desconecta os outros aparelhos do funcionário e a senha antiga para de funcionar, então
  ele percebe na próxima entrada. O link só existe a pedido do dono e vale 24 horas.
- **O que fazer (proposta, a decidir com o Luis antes de empresas reais):** quando houver envio de e-mail próprio (F30),
  a senha nova vai por e-mail direto ao funcionário, e o "link novo" do dono fica só para quem ainda não aceitou o
  convite. Outra peça possível: avisar o funcionário, na entrada, que a senha foi trocada por um link do dono.
- **Decisão (Luis, 24/10/2026):** aceitar por enquanto, porque ainda não há empresas reais. Resolver antes da primeira
  empresa real, junto com o envio de e-mail próprio (F30). Limitar já o link novo deixaria sem saída quem esquecer a
  senha.

### F34 — Painel do dono usado com o login de outra aba, sem aviso
- **Gravidade:** Baixa · **Status:** Resolvida · **Anotada:** 24/10/2026 (achada pelo Luis no teste do PR 2b)
- **O problema:** as abas normais de um navegador dividem o mesmo login (ele fica num cookie do navegador, não na aba).
  No teste do convite, o Luis abriu o link numa aba normal e entrou como o funcionário. A aba do dono continuou mostrando
  o painel, mas o navegador já estava conectado como o funcionário: clicar em "Desativar" mandava a aba para a tela
  dele ("Olá, Leandro", "Em obras"), sem explicação. A desativação **não** era gravada: o servidor recusa quem não é
  dono, e o banco recusaria de novo. Mas o dono fica confuso (desativou ou não? o site trocou de conta sozinho?). E
  havia um caso raro de ação na conta errada: com duas contas de dono no mesmo navegador, um convite feito na aba de uma
  empresa iria para a empresa da outra conta. "Às vezes" funcionava porque, entre um clique e outro, o dono tinha
  entrado de novo (no banco de testes, a última entrada do dono foi 35 segundos depois da do Leandro). O roteiro no
  Chrome do PR 2b não pegou isso porque abria dono e funcionário em navegadores separados, como manda o guia.
- **Também de processo:** o guia do teste mandava usar a janela anônima, mas não dizia por quê.
- **Resolvida (24/10/2026, issue #31):** cada formulário da Equipe leva, escondido, o id do dono que abriu o painel, e o
  servidor confere se quem está conectado ainda é ele (`checkPageOwner`, em `lib/ock/team-forms.ts`). Se não for, nada
  muda e o cartão mostra "Nada foi mudado. Neste navegador, quem está conectado agora é Leandro…" (ou, sem ninguém
  conectado, "A sua conta de dono não está mais conectada…"), com o caminho: Sair e entrar de novo como dono. O id
  escondido só serve para recusar; quem pode o quê continua sendo decidido pelo login e pelo banco. O guia explica a
  janela anônima (Parte C) e ganhou um teste do aviso (Parte H).
- **Conferida pelo Luis (24/10/2026, Parte H do guia, em abas normais):** o convite avisou quem estava conectado; com o
  funcionário conectado em outra aba, "Desativar" mostrou "Nada foi mudado… quem está conectado agora é Bruno Teste" e o
  cartão não mudou; com ninguém conectado, apareceu "A sua conta de dono não está mais conectada"; depois de sair e
  entrar de novo como dono, "Desativar" funcionou. Merge do PR #32 feito.
- **Para as próximas telas:** toda tela com botões que mudam alguma coisa deve conferir do mesmo jeito que o login
  ainda é o de quem abriu a página. No PR 3, isso vale para o chat e as receitas do funcionário: sem a conferência, uma
  execução começada numa aba de funcionário seria cobrada de quem entrou depois em outra aba. Avisar a aba antes do
  clique (ao voltar para ela) ficou de fora: dá mais trabalho e o aviso no clique já evita o engano.
- **Nas receitas (24/10/2026, PR 3a):** começar e cancelar conferem do mesmo jeito (`checkPageMember`, em
  `lib/auth/page-member.ts`), e a aba que perde o acesso à execução avisa em vez de ficar parada. Testado com a Ana numa
  aba e o Bruno entrando noutra do mesmo navegador. Falta o chat (parte 3c).

### F36 — Execução parada no meio ficava parada para sempre
- **Gravidade:** Média · **Status:** Resolvida · **Anotada:** 24/10/2026 (achada pelo Claude no PR 3a)
- **O problema:** a execução anda uma fase por vez, cada fase numa chamada que o servidor faz a si mesmo. O código do
  PR #19 dizia que, se uma dessas chamadas se perdesse (ou o servidor caísse no meio), um "varredor" retomaria a
  execução, mas o varredor não existia: ela ficava em "rodando" para sempre e a pessoa via a tela parada. No computador,
  basta salvar um arquivo no meio de uma execução, porque o `npm run dev` reinicia.
- **Resolvida (24/10/2026, PR 3a):** quem roda uma fase renova a reserva da execução a cada 2 segundos, e a reserva vale
  60 segundos (antes, 6 minutos). Cada busca de novidades da tela confere se a execução parou (reserva vencida, ou na
  fila há mais de 10 segundos) e, se parou, a retoma (`lib/runs/resume.ts`). Testado com uma execução deixada na fila de
  propósito: ao abrir a tela, ela foi retomada e terminou.

### F37 — Cancelar não parava a IA no meio da fase
- **Gravidade:** Média · **Status:** Resolvida · **Anotada:** 24/10/2026 (achada pelo Claude no PR 3a)
- **O problema:** no código do PR #19, "Cancelar" marcava a execução como cancelada, mas a fase que estava rodando ia
  até o fim (só a próxima não começava). Com IAs de verdade, a plataforma pagaria a fase inteira do Programador depois
  de a pessoa ter cancelado.
- **Resolvida (24/10/2026, PR 3a):** a cada renovação da reserva (2 segundos), quem roda confere se a execução foi
  cancelada e, se foi, manda a IA parar na hora. No teste, depois de cancelar, nenhuma fase nova começou e a execução
  não chegou ao fim.

### F39 — A chamada interna ia para o endereço que vinha no pedido
- **Gravidade:** Média · **Status:** Resolvida · **Anotada:** 24/10/2026 (achada pelo Claude na revisão do PR 3a)
- **O problema:** para levar a execução adiante, o servidor chama a si mesmo levando um segredo. No código do PR #19, o
  endereço dessa chamada era montado com os cabeçalhos do pedido que chegou (Host, X-Forwarded-Host), e esses quem pede
  pode inventar. Um pedido forjado faria o nosso servidor mandar o segredo para outro site; com ele, dava para chamar a
  rota interna e empurrar execuções. No computador, o `npm run dev` aceita pedidos da rede local.
- **Resolvida (24/10/2026, PR 3a):** o endereço vem só da configuração (`VERCEL_URL`, o endereço configurado do site ou o
  próprio computador), nunca do pedido (`lib/runs/trigger.ts`, com teste). Na publicação, conferir se a proteção de
  acesso da Vercel deixa o site chamar a si mesmo por esse endereço.

### F54 — Uma fase com IA de verdade pode passar do tempo máximo da função na Vercel
- **Gravidade:** Média · **Status:** Aberta · **Anotada:** 26/10/2026 (percebida pelo Claude no PR das IAs de verdade)
- **O problema:** cada fase de uma receita roda numa chamada que o servidor faz a si mesmo (`/api/runs/[id]/continue`),
  com `maxDuration = 300` (5 minutos). Com as IAs de verdade, a fase do Front-end (até 6 mil tokens de site e, no esforço
  alto, até 16 mil de "pensamento") pode levar alguns minutos; se passar do limite no site publicado, a Vercel corta a
  função, a reserva de quem roda vence e a fase é retomada do zero (F36): a plataforma paga a fase duas vezes e a
  pessoa espera em dobro. No computador (`npm run dev`) não há esse limite, então os testes do Luis não pegam isso.
- **O que fazer:** medir o tempo de cada fase nos primeiros testes com as IAs de verdade (Parte F do
  `docs/GUIA-TESTE-IAS-REAIS.md`) e, antes de publicar: conferir o limite do plano da Vercel (o tempo máximo depende do
  plano), dividir as etapas longas (cada etapa numa chamada, não a fase inteira) ou baixar o esforço do Front-end.

### F40 — Os conectores das IAs de verdade medem o consumo pelo tamanho do texto
- **Gravidade:** Alta · **Status:** Resolvida · **Anotada:** 25/10/2026 (achada pelo Claude ao planejar o PR 3b)
- **O problema:** `lib/providers/real.ts` conta os tokens (os pedacinhos de texto pelos quais as empresas de IA cobram)
  pelo tamanho do texto, 4 letras por token. Fica de fora o "pensamento", o raciocínio que a IA faz antes de responder,
  que as empresas também cobram e que pode ser bem maior que a resposta. Com as IAs de verdade, a plataforma cobraria da
  empresa bem menos do que paga, e a estimativa (que conta a entrada do mesmo jeito) poderia ficar abaixo do real.
- **O que fazer:** no PR das IAs de verdade, ler o consumo que cada API devolve no fim da resposta (com o pensamento) e
  usar esse número na cobrança e em `ai_calls`; revisar a conta da entrada na estimativa com o número de verdade (texto
  em português gasta mais tokens por letra).
- **Resolvida (26/10/2026, PR das IAs de verdade):** cada conector lê o consumo que a empresa da IA informa no fim da
  resposta: no Claude, a entrada do começo e a saída do fim (com o pensamento); no GPT, o pedaço de consumo do fim, que
  agora é pedido (`stream_options.include_usage`); no Gemini, a resposta mais o pensamento. A entrada do cache e a
  gravada nele entram com o preço próprio. Uma tentativa que cai no meio leva o consumo informado até ali para
  `ai_calls`. Se a empresa não informar (não deveria acontecer), cobra o máximo da chamada, nunca menos. A estimativa
  passou a contar 3 caracteres por token (antes, 4), e as imagens anexadas, 5.000 tokens (antes, 2.000). Testado com
  respostas gravadas no formato da documentação de cada empresa. **Conferência final:** comparar com o painel de gastos
  das empresas no primeiro dia de uso (Parte E do `docs/GUIA-TESTE-IAS-REAIS.md`).

### F42 — Sem a chave de uma IA, o site usa a IA simulada sem avisar
- **Gravidade:** Média · **Status:** Resolvida · **Anotada:** 25/10/2026 (achada pelo Claude ao planejar o PR 3b)
- **O problema:** `createGetProvider` (`lib/providers/registry.ts`) usa a IA de verdade quando há a chave dela e, sem a
  chave, cai na IA simulada sem avisar ninguém. Com a cobrança ligada, uma chave apagada ou com nome errado no servidor
  faria a empresa pagar por um resultado de mentira.
- **O que fazer:** no PR das IAs de verdade, faltar a chave vira erro (a etapa falha e o servidor registra o motivo), e
  a IA simulada só roda com um interruptor próprio, ligado de propósito no computador de testes.
- **Resolvida (26/10/2026, PR das IAs de verdade):** o interruptor novo `OCK_AI_MODE` (`lib/providers/mode.ts`) diz
  qual IA responde nas receitas e no chat: `simulada` ou `real`. Com `real`, a IA sem chave falha com um erro que não
  adianta repetir (nas receitas, a IA reserva assume; no chat, a mensagem avisa que não deu), nada é cobrado e o
  registro interno guarda o nome da variável que falta. Vazio, vale a simulada só no computador de desenvolvimento
  (`npm run dev` e testes) e a real em qualquer outro lugar, para o site publicado nunca cair na simulada por
  esquecimento. Decisão provisória do Claude (Luis confirmar): o vazio no computador continuar simulado evita mexer no
  `.env.local` de quem já testa. Testado de ponta a ponta nos dois modos. Em 26/10, o Luis conferiu pela tela (Parte C
  do `docs/GUIA-TESTE-IAS-REAIS.md`): sem as chaves, o chat avisou que não deu, a receita parou com R$ 0,00 e o
  `ai_calls` guardou o erro sem cobrança e sem nenhuma resposta da simulada.

### F43 — Quedas raras do servidor na hora de cobrar
- **Gravidade:** Baixa · **Status:** Aceita · **Anotada:** 25/10/2026 (achada pelo Claude no PR 3b)
- **O problema:** o caso comum está coberto: se o servidor cai entre gravar uma fase e cobrar, a chamada seguinte cobra
  o que faltou, sem cobrar duas vezes. Ficam três casos raros: (1) se a pessoa cancela no mesmo instante em que o
  servidor cobra as etapas da fase que acabou de terminar, as que ainda não tinham sido cobradas saem de graça; (2) se o
  servidor cai no meio de uma fase que a pessoa cancelou, a reserva fica "aberta" até vencer (uma hora), e depois disso
  deixa de segurar o saldo; (3) em teoria, se o servidor ficar parado um minuto inteiro entre gravar e cobrar, outro
  pode assumir a execução e os dois cobrarem a mesma etapa.
- **Por que aceitar:** os três dependem de uma queda ou de uma coincidência de segundos, e os valores são de centavos.
- **O que fazer depois:** uma chave única na cobrança (migração: cada etapa só vira uma linha de gasto) e uma limpeza que
  fecha as reservas esquecidas.

### F44 — Anexos do chat: o texto vai inteiro para a IA, e o que ela não lê é aceito sem aviso
- **Gravidade:** Média · **Status:** Resolvida · **Anotada:** 25/10/2026 (achada pelo Claude ao planejar a parte 3c)
- **O problema:** no chat do parceiro (`app/api/ock/route.ts` e `lib/ock/files.ts`), dá para anexar até 5 arquivos de
  10 MB, e o texto de cada PDF ou arquivo de texto vai **inteiro** para a IA, sem limite. Um PDF grande vira centenas de
  milhares de tokens: com as IAs de verdade, uma mensagem poderia custar dezenas de reais, ou a IA recusaria por tamanho.
  E um arquivo que a IA não lê (Word, Excel, áudio…) é aceito, mas não chega a ela, e ninguém avisa: a pessoa acha que a
  IA leu.
- **O que fazer:** proposta na issue #39 (parte 3c): o texto dos anexos entra até 30.000 caracteres por mensagem (umas
  15 páginas), com aviso quando cortar, e um tipo que a IA não lê é recusado na hora, com aviso.
- **Resolvida (25/10/2026, PR 3c):** o texto dos anexos entra até 30.000 caracteres por mensagem; o que passar fica de
  fora, com um aviso na resposta ("a IA leu só o começo"). Anexar um tipo que a IA não lê (Word, Excel...) é recusado na
  hora, na tela e no servidor, que olha a extensão do nome (o tipo informado pelo navegador pode vir inventado). Ler Word
  e Excel fica para depois.

### F48 — O "Gasto do mês" fica menor que o real depois de 1.000 gastos no mês
- **Gravidade:** Baixa · **Status:** Decidida · **Anotada:** 25/10/2026 (achada pelo Claude ao planejar a parte 3d)
- **O problema:** o banco devolve no máximo 1.000 linhas por pedido (`max_rows` do Supabase). O "Gasto do mês" do
  `/trabalho` e da aba Meus gastos (`lib/ock/spending.ts`) soma, no nosso servidor, as linhas que chegam: depois de 1.000
  gastos da pessoa no mês (uns 45 por dia útil), o número mostrado fica menor que o real, sem aviso. O teto em si está
  certo, porque é conferido dentro do banco (`private.member_month_used_cents`). O painel do dono, que somaria o extrato
  da empresa inteira, esbarraria nisso muito antes.
- **O que fazer:** issue #43 (parte 3d), aprovada pelo Luis: as somas (saldo, reservado, gasto do mês por pessoa e por
  IA) passam a ser feitas dentro do banco, numa migração com testes, e a lista mostra só as linhas mais recentes.
- **Resolvida (25/10/2026, parte 3d):** a migração `20261025200001_month_summaries.sql` traz quatro contas feitas dentro
  do banco (crédito da empresa, gasto do mês por IA, mês de cada pessoa e extrato do mês com a receita numa linha), com
  26 testes. O "Gasto do mês" do `/trabalho`, o Meus gastos e o painel do dono usam essas contas; as listas mostram as
  200 linhas mais recentes e avisam quando há mais.

### F49 — O nome e o título dos documentos do chat saíam do pedido do funcionário
- **Gravidade:** Média · **Status:** Resolvida · **Anotada:** 25/10/2026 (achada pelo Claude no teste da parte 3d)
- **O problema:** no chat, o PDF, o Word, o Excel e o CSV recebiam como nome do arquivo e como título os primeiros 60
  caracteres do pedido (ex.: "Gere-um-PDF-com-um-resumo-da-reuniao-de-hoje.pdf"). Com a parte 3d, o dono vê o nome das
  entregas no painel e pode baixá-las: leria o começo do pedido, contra a decisão de que o dono não lê pedidos (F05).
- **Resolvida (25/10/2026, parte 3d):** o título e o nome vêm da primeira linha do que a IA escreveu (a instrução do
  documento já pede um título no começo), sem marcas como "#"; a planilha se chama "Planilha"; sem título, "Documento".
  As entregas feitas antes desta parte continuam com o nome antigo (só existem no projeto de testes).

### F50 — Os conectores das IAs de verdade mandariam pedidos que as APIs de hoje recusam
- **Gravidade:** Alta · **Status:** Resolvida · **Anotada:** 26/10/2026 (achada pelo Claude ao conferir as APIs, no PR
  das IAs de verdade)
- **O problema:** o conector do PR #19 (`lib/providers/real.ts`) foi escrito para versões anteriores dos modelos. Com as
  chaves ligadas: (1) o GPT recusaria todo pedido de esforço baixo, porque mandava `reasoning_effort: "minimal"`, que os
  modelos GPT-6 não aceitam; o Chefe do chat usa justamente o GPT com esforço baixo, então falharia em toda mensagem (a
  regra simples assumiria, sem ninguém perceber); (2) no esforço baixo, o Claude ia sem esforço nenhum, e aí o Sonnet 5.5
  pensa no nível alto (mais caro e lento) e o Opus 5.5, no médio; (3) o Gemini pedia o pensamento por orçamento de
  tokens (`thinkingBudget`), e os modelos novos usam níveis (`thinkingLevel`; o 3.8 Flash recusa "minimal"); (4) o
  Gemini usava apelidos que trocam de modelo sozinhos. E o teto de saída não deixava folga para o pensamento no esforço
  baixo, mas os modelos de hoje pensam um pouco mesmo assim: a resposta podia sair cortada ou vazia, e cobrada.
- **Resolvida (26/10/2026, PR das IAs de verdade):** GPT com "low", Claude sempre com o esforço explícito
  (`output_config`) e pensamento "adaptive", Gemini com `thinkingLevel` ("low", "medium", "high"), nomes fixos de
  modelo (F17) e folga para o pensamento em todo esforço (`THINKING_ROOM` em `lib/providers/limits.ts`: 2 mil, 8 mil e
  16 mil tokens; a rever com o consumo de verdade). Testes conferem o pedido mandado a cada empresa.

### F51 — Resposta cortada no meio, ou recusada pela IA, era aceita como resposta completa
- **Gravidade:** Média · **Status:** Resolvida · **Anotada:** 26/10/2026 (achada pelo Claude no PR das IAs de verdade)
- **O problema:** no conector do PR #19, se a conexão com a IA fechasse no meio da resposta sem erro, o texto que tinha
  chegado era entregue como resposta completa (e cobrado); e quando a IA recusava o pedido (Claude com
  `stop_reason: "refusal"`, GPT com `content_filter`, Gemini com `SAFETY`), o pedaço escrito também virava resposta,
  em vez de a troca de IA entrar (AGENTS.md, seção 5).
- **Resolvida (26/10/2026, PR das IAs de verdade):** a resposta só vale com o aviso de fim de cada empresa; sem ele, é
  uma falha que vale tentar de novo. Recusa é uma falha que não adianta repetir (a troca de IA entra). Um aviso de erro
  no meio da resposta (ex.: Claude sobrecarregado) também vale nova tentativa. Testado com respostas gravadas.

## Processo

### F20 — Mudança grande de produto entrou num PR só, sem registro nos documentos
- **Gravidade:** Média · **Status:** Decidida · **Anotada:** 22/10/2026
- **O problema:** o PR #19 mudou o produto inteiro (público, telas, cobrança) num único commit de ~100 arquivos, sem
  atualizar o `DOCUMENTO-PROJETO.md` nem o `PROGRESSO.md`. Fica difícil revisar, e qualquer conversa nova com uma IA
  começava pelo produto antigo.
- **O que foi feito (22/10):** documentos atualizados com a visão nova. **Falta combinar com o parceiro:** uma tarefa =
  um PR pequeno, e o PROGRESSO atualizado em todo PR.

### F21 — O parceiro usa a conta do GitHub do Luis
- **Gravidade:** Média · **Status:** Aberta · **Anotada:** 22/10/2026
- **O problema:** os commits dele saem no nome do Luis (não dá para saber quem fez o quê), e senha compartilhada é
  risco de segurança.
- **O que fazer:** adicionar o parceiro como colaborador do repositório (Settings → Collaborators), cada um com a
  própria conta. Depois, o Luis pode trocar a senha.

### F22 — O OCK nunca rodou no computador do Luis
- **Gravidade:** Média · **Status:** Resolvida · **Anotada:** 22/10/2026
- **O problema:** falta o Supabase e as chaves no `.env.local`. As checagens (lint, testes, build) do PR #19 também não
  foram conferidas pelo Luis.
- **O que fazer:** primeira tarefa da etapa 5.
- **Andamento (24/10/2026):** o site roda no computador do Luis, ligado ao projeto de testes do Supabase, e ele testou o
  login de verdade (PR #29) com tudo dando certo. Falta o chat e as receitas, que voltam no PR 3, já no banco novo.
- **Andamento (24/10/2026, PR 3a):** a receita "Criar um site" voltou, no banco novo (com a IA simulada). Falta o chat
  (parte 3c).

- **Andamento (25/10/2026, PR 3c):** o chat voltou, no banco novo (com a IA simulada). Resolvida quando o Luis testar o
  chat com o guia (`docs/GUIA-TESTE-CHAT.md`).
- **Resolvida (25/10/2026):** o Luis seguiu o `GUIA-TESTE-CHAT.md` no computador dele, ligado ao projeto de testes, e
  tudo deu o resultado esperado. Login, convite, receitas (3a e 3b) e chat (3c) já rodaram ali.

### F46 — O PR #40 entrou na `main` sem descrição e antes do teste pelo guia
- **Gravidade:** Baixa · **Status:** Resolvida · **Anotada:** 25/10/2026 (percebida pelo Claude)
- **O problema:** o PR da parte 3c foi aberto e mergeado pela conta do Luis (`lgvoliveira`) em oito segundos, sem
  descrição (o que mudou, por quê, como testar; AGENTS.md, seção 8) e antes do teste pelo `GUIA-TESTE-CHAT.md`. Até
  aqui, cada parte foi testada pelo Luis antes do merge. Parte da causa foi do Claude: ele parou no limite de uso antes
  de abrir o PR, com o branch já no GitHub. Se o teste achar um defeito, ele já está na `main` (e, com a ligação do
  GitHub, no Supabase de verdade quando houver migração; desta vez não havia).
- **O que já ajuda:** as checagens passaram na `main`, este PR não mudou o banco e as IAs ainda são simuladas.
- **O que fazer:** testar agora na `main` e corrigir num PR novo o que falhar. Daqui para a frente, o Claude abre o PR
  com a descrição antes de parar, e o merge espera o teste pelo guia. Se foi o parceiro, com a conta do Luis, é mais um
  motivo para a F21.
- **Resolvida (25/10/2026):** o Luis testou a `main` pelo guia (Partes A a H e J; a I, do teto, ficou para o teste da
  parte 3d, issue #43) e tudo deu o resultado esperado: não houve defeito para corrigir. A regra continua: PR com
  descrição antes de parar, e merge só depois do teste.
### F52 — O código fala com as IAs sem as bibliotecas oficiais, ao contrário do que diz o AGENTS.md
- **Gravidade:** Baixa · **Status:** Aberta · **Anotada:** 26/10/2026 (percebida pelo Claude no PR das IAs de verdade)
- **O problema:** a decisão de 09/10 (AGENTS.md, seção 3) diz "SDKs oficiais de cada empresa". O conector do PR #19
  chama as APIs direto pelo endereço delas (`fetch`), sem as bibliotecas oficiais, e o PR das IAs de verdade manteve
  assim. A regra escrita e o código não batem. Na prática, o efeito é pequeno: o preço e o comportamento são os mesmos,
  e não há biblioteca nova para manter; em troca, quando uma empresa muda o formato da resposta, somos nós que ajustamos
  o conector (com as bibliotecas, viria numa atualização delas).
- **O que fazer (Luis decidir):** (a) manter as chamadas diretas e corrigir o AGENTS.md (recomendação do Claude, por
  ser o que está testado e não trazer dependência nova), ou (b) trocar pelas três bibliotecas oficiais num PR próprio.

### F55 — Com as IAs de verdade por último, o site é montado sem medir custo, tempo e qualidade de verdade
- **Gravidade:** Média · **Status:** Aceita · **Anotada:** 26/10/2026 (percebida pelo Claude na mudança de ordem)
- **O problema:** com a nova ordem (decisão do Luis, 26/10), as receitas novas, a receita própria e a escolha livre da
  IA no chat são feitas e testadas só com a IA simulada. As instruções de cada papel, a estimativa "até R$ X" e o tempo
  de cada fase só serão conferidos com as IAs de verdade no bloco 6. E o bloco 5 (publicação) pede as chaves de produção
  e a F54 resolvida, que dependem de créditos comprados e do tempo medido com as IAs de verdade, coisas do bloco 6.
- **Por que aceitar:** o Luis prefere ver o site inteiro funcionando antes de gastar, e a IA simulada já testa as telas,
  a carteira, as regras de acesso e o caminho de cada receita.
- **O que fazer:** (1) antes da primeira empresa de verdade, rodar cada receita com as IAs de verdade (bloco 6) e
  ajustar as instruções e as folgas da estimativa; (2) antes do bloco 5, o Luis decidir entre publicar com a IA
  simulada, só com empresas de teste, e ligar as chaves depois do bloco 6, ou fazer a sessão 2 do
  `docs/GUIA-TESTE-IAS-REAIS.md` logo antes de publicar; (3) a F54 pode ser resolvida no bloco 5 sem medir, dividindo as
  fases longas (cada etapa numa chamada).

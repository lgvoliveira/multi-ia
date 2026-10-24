# PROGRESSO — Plataforma Multi-IA

> Diário do projeto. Toda conversa nova (Cowork ou Claude Code) começa lendo este arquivo.
> Atualizado pelo Claude ao fim de cada etapa.
> **Versão oficial:** este arquivo, no repositório `C:\Users\Luis\projetos\multi-ia\docs\`.

**Última atualização:** 24/10/2026 (etapa 5: banco no ar; decisões do login; projeto de testes do Supabase)
**Etapa atual:** etapa 5 — Base para empresas. PR 1 (banco) no ar; agora: projeto de testes e PR 2a (login de verdade)

---

## Links importantes

- Repositório (privado): https://github.com/lgvoliveira/multi-ia
- Pasta local do código: `C:\Users\Luis\projetos\multi-ia` (fora do OneDrive)
- Documento do projeto (visão, receitas, arquitetura, negócio, MVP):
  https://claude.ai/code/artifact/2b5773d4-3ece-4278-9147-06cd89fda02d
- Protótipo das telas (canvas de design, 10 telas clicáveis):
  https://claude.ai/artifact/XWxF7wU57nRp5Yq7PTZY3n
- Documento no repositório: `docs/DOCUMENTO-PROJETO.md` (versão oficial; o online é para leitura e pode ficar defasado)
- Falhas e riscos: `docs/FALHAS.md` (lista viva; toda falha nova percebida entra lá, com status)
- Desenho do banco de dados: `docs/BANCO-DE-DADOS.md` (explica as migrações de `supabase/migrations/`, que são a versão oficial)

## Resumo da ideia (atualizado em 22/10/2026)

Plataforma brasileira de IA **para empresas pequenas e médias** (ex.: uma agência de marketing). A empresa assina,
cadastra os funcionários, e cada funcionário usa as IAs (Claude, GPT, Gemini) no trabalho do dia a dia, de três jeitos:
**receita pronta** (um time de IAs já montado para um serviço), **receita própria** (o funcionário monta a dele) ou
**tarefa rápida** (só pede, como num chat). A plataforma recomenda a IA e o nível do modelo, mas o funcionário escolhe
livremente. O dono acompanha o que cada funcionário entregou, o que fez e quanto gastou, e define um teto de gasto para
cada um. Nome provisório no código: **OCK**. Visão completa no `DOCUMENTO-PROJETO.md`.

Até 19/10 a ideia era para a pessoa comum (uma pessoa, uma conta). O histórico das etapas 3 e 4, mais abaixo, é dessa
fase e continua valendo para o motor, as receitas e a segurança.

## Virada para empresas (20 a 22/10/2026)

**O que entrou no PR #19** (feito pelo parceiro com a conta do GitHub do Luis; merge em 20/10; um commit só, ~100 arquivos):
- **IAs reais** ligadas (`lib/providers/real.ts`): era a T9 da etapa 4. Sem chave no `.env.local`, cada IA continua simulada.
  Chaves da plataforma: `OCK_CLAUDE_KEY`, `OCK_GPT_KEY` e `OCK_GEMINI_KEY` (nomes no `.env.example`).
- **Supabase**: guarda as execuções (`lib/runs/store.ts`) e os dados da empresa (`lib/ock/company.ts`).
- **"Minhas chaves"** (`/chaves`): chaves do próprio usuário, criptografadas (AES-256-GCM).
- **OCK**: a página inicial pergunta "dono ou funcionário"; `/dono` (funcionários, teto de cada um, crédito da empresa,
  gasto por IA e economia); `/entrar` (login do funcionário com senha temporária que ele troca); `/trabalho` (chat do
  funcionário com várias conversas, voz e envio de arquivos).
- **Chefe roteador** (`lib/ock/chief.ts`): para cada pedido escolhe uma IA, o nível do modelo (econômico, padrão,
  potente), o esforço e a ação (responder, imagem, código, pesquisa, documento, gráfico ou projeto).
- **Arquivos gerados:** PDF, Word, Excel, CSV, gráficos e projeto em .zip. Bibliotecas novas: `@supabase/supabase-js`,
  `docx`, `jszip`, `pdf-lib`, `unpdf` e `xlsx`.
- **Preços** das IAs e câmbio em `lib/ock/pricing.ts` (aproximados).
- A receita "Criar um site" continua no código (`/recipes/create-site`), mas saiu da página inicial e não está no workspace.

**Decisões do Luis (22/10, conversa no Cowork)**
- **Público:** empresas pequenas e médias, **amplo** por enquanto, para testar; nichar depois (ex.: agências) se fizer
  sentido, aproveitando o que já estiver pronto.
- **O dono** vê o que cada funcionário entregou, o que fez e quanto gastou, e limita o teto de gasto de cada um.
- **Receitas no centro**, dentro do workspace do funcionário, em três modos: receita pronta, receita própria e tarefa rápida.
- **Escolha da IA:** a plataforma recomenda (IA, nível e esforço), mas o funcionário escolhe livremente
  ("quero o melhor", "quero o Claude nesta tarefa").
- **Registro de falhas:** `docs/FALHAS.md`, atualizado sempre que uma falha nova aparecer. Começou com 22 falhas
  (F01 a F22), entre elas o login de demonstração, o painel do dono aberto e o banco fora do repositório.

**Ainda não conferido:** o OCK nunca rodou no computador do Luis (falta o Supabase e as chaves no `.env.local`), e as
checagens (lint, testes, build) do PR #19 não foram conferidas aqui.

## Decisões tomadas

- Público: empresas pequenas e médias no Brasil e seus funcionários, não desenvolvedores (mudou em 22/10; antes era
  o usuário comum e a pequena empresa).
- Diferenciais: português, preço em reais (Pix), receitas prontas, sem precisar de chave de API.
- Monetização: a empresa paga, com uma carteira de créditos da empresa (a plataforma paga as APIs) e teto por
  funcionário. Formato do preço em aberto (22/10). Os planos antigos (Grátis, Padrão, "Traga sua chave", Conector MCP)
  eram para a pessoa comum e precisam ser revistos.
- Claude entra sempre via API (assinaturas Claude não podem ser usadas em apps de terceiros).
  ChatGPT pode entrar via "Sign in with ChatGPT" no futuro (exige aprovação da OpenAI).
- Chave própria (BYOK): conectada uma vez na conta (Configurações > Minhas chaves de API).
  Em qualquer projeto (receita ou próprio) o usuário escolhe pagar com "Créditos da plataforma"
  ou "Minhas chaves". Página de chaves traz link direto + passo a passo para pegar a chave.
- MVP só com receitas de texto/código. Vídeo fica para a fase 3 (precisa de "oficina na nuvem").
- Receitas do MVP: Criar site simples; Escrever e revisar texto; Pesquisa com checagem cruzada;
  Comitê de investimento.
- Stack: Next.js + TypeScript, Supabase (login e banco), Vercel (hospedagem),
  SDKs oficiais de cada IA, ligadas diretamente (decidido em 09/10; motivos na Parte B da etapa 4).
- Desenvolvimento: Claude como programador principal. Codex entra depois como revisor
  de pull requests. Comunicação entre as IAs pelo GitHub (AGENTS.md, issues, PRs).

- Regras de funcionamento definidas (detalhes no DOCUMENTO-PROJETO.md, seção "Regras de funcionamento"):
  erro de IA = 2 tentativas -> troca de IA -> pausa sem perder nada; etapa com falha não cobra.
  Créditos = estimativa + reserva, cobra consumo real, devolve diferença; se for passar da estimativa, pausa e pergunta.
  Histórico com camada do usuário + camada interna (custo em dólar); LGPD; chaves criptografadas à parte.
  Limites: pedido ~4.000 caracteres, teto por resposta, 1 execução simultânea no grátis.
  Visual centralizado em tokens (fácil trocar cores/fontes depois).
- Ideia guardada: "preço máximo garantido" — descartada por enquanto (risco de absorver diferenças).

## Sobre o Luis (forma de trabalhar)

- Disponibilidade: ~1 h por dia útil + sessões mais longas no sábado e domingo.
- Está aprendendo; prefere explicações claras quando o tema é novo.
- Tem um amigo como parceiro no projeto, que também programa (fez o PR #19, usando a conta do GitHub do Luis; ver F21
  no `FALHAS.md`). Foi ele quem propôs levar o produto para empresas.
- Ajustes de detalhe (visual, textos, pequenos comportamentos) ficam numa lista para depois de ter o MVP palpável
  (issues com a etiqueta "ajuste"). Exceções, resolvidas na hora: defeitos e o que muda a base (dados, segurança,
  créditos). Os ajustes que mais valem virão dos testes com usuários (etapa 6).
- Modelo: Opus 5.5 em esforço Alto como padrão; Extra alto para sessões longas de código.
- Regra de troca de conversa: o Claude avisa quando for hora de abrir uma conversa nova e diz
  onde abrir (Cowork ou Claude Code), qual mensagem colar e qual nível de esforço usar.
  Antes de trocar, atualiza este arquivo.

## Etapas

| # | Etapa | Status | Onde |
|---|-------|--------|------|
| 1 | Ideia, discussão e documento do projeto | Concluída | Cowork |
| 2 | Desenho das telas + regras de funcionamento | Concluída | Cowork |
| 3 | Preparar ambiente: GitHub, repositório, AGENTS.md, Claude Code | Concluída (08/10) | Cowork |
| 4 | Primeiro fluxo ponta a ponta (1 receita, 3 IAs, resultado na tela) | Parte A concluída; IAs reais entraram no PR #19, falta conferir com chaves | Claude Code |
| — | Virada para empresas: visão nova, `FALHAS.md`, alinhar com o parceiro | Em andamento (22/10) | Cowork |
| 5 | Base para empresas: banco novo do zero (no repositório), login de verdade, cadastro de empresa, painel do dono protegido, OCK rodando no computador do Luis | Em andamento: PR 1 (banco) no ar; faltam PR 2a e 2b (login e convite) e PR 3 (trocar o código) | Claude Code |
| 6 | Workspace do funcionário: receitas prontas, receita própria e tarefa rápida; recomendação de IA com escolha livre | A fazer | Cowork (telas) + Claude Code |
| 7 | Créditos e preço: carteira, teto, estimativa, regras de cobrança, preço do plano | A fazer | Cowork (preço) + Claude Code |
| 8 | Conversas e testes com 3 a 5 empresas reais, e ajustes | A fazer | — |

As etapas 5 a 8 são uma proposta de 22/10, a confirmar com o parceiro.

## Etapa 3 — o que ficou pronto (08/10/2026)

- Node.js v24 e npm 11 (já existiam); política de execução do PowerShell liberada para o usuário.
- Git 2.55 instalado e configurado (nome, e-mail lgvoliveira1304@gmail.com, branch padrão `main`).
- Repositório privado `lgvoliveira/multi-ia` no GitHub, clonado em `C:\Users\Luis\projetos\multi-ia`.
- `AGENTS.md` (regras para as IAs), `CLAUDE.md` (aponta para o AGENTS.md), `.gitattributes`, `README.md`, `docs/`.
- Claude Code 2.1.295 instalado, logado com a assinatura e testado: leu o AGENTS.md corretamente.
- Decisões: código com nomes em inglês e telas em português; commits e PRs em português;
  o repositório é a casa oficial do PROGRESSO e do documento.
- **Contas de API adiadas:** a etapa 4 começa com uma "IA simulada" (respostas falsas, custo zero).
  Só depois que o fluxo estiver funcionando visivelmente na tela é que se compram os créditos
  (mínimo, ~US$5 cada, recarga automática DESLIGADA), se criam as chaves e se conectam as IAs reais.
  Gemini: plano grátis basta para testes (não enviar dados reais). Chaves nunca no chat; só no `.env.local`.

## Etapa 4 — plano aprovado (08/10/2026)

Receita escolhida: **Criar um site** (única do MVP com 3 IAs). Quatro etapas em sequência:
Chefe/Claude planeja → Programador/GPT escreve o site → Revisor/Gemini aponta erros →
Consolidação/Claude entrega o site final (um arquivo HTML). Construção "de dentro para fora":
peças invisíveis com testes primeiro, telas depois. Cada tarefa = 1 issue + 1 branch + 1 PR.

**Parte A — fluxo completo com a IA simulada (custo zero)**

| # | Tarefa | Status |
|---|--------|--------|
| T0 | Preparar o terreno: GitHub CLI (`gh`) + issues no GitHub | Concluída (issues #1 a #8, marco "Etapa 4") |
| T1 | Esqueleto do site: Next.js, tokens visuais, topo, CI | Concluída (PR #9) |
| T2 | IA simulada: contrato do "provedor", respostas em pedaços, testes (Vitest) | Concluída (PR #10) |
| T3 | Receita "Criar um site" como dados (papéis, prompts, etapas) + 3 receitas "em breve" | Concluída (PR #11; JavaScript "de enfeite" no PR #12) |
| T4 | Motor de orquestração: executa as etapas e narra eventos | Concluída (PR #13) |
| T5 | Telas: Receitas e Montar o time (trocar IA, pedido com contador de 4.000) | Concluída (PR #14) |
| T6 | Execução ao vivo: rota `/api/runs` com streaming + tela "Seu time está trabalhando" | Concluída (PR #15) |
| T7 | Resultado: prévia do site em moldura isolada (o JS roda, mas sem acesso a nada), código, baixar arquivo, resumo do time | Concluída (PR #16) |
| T8 | Quando uma IA falha: 2 tentativas, troca de IA, aviso na tela (pausar/retomar fica para a etapa 5) | Concluída (PR #17) |

**Parte B — IAs de verdade (começou em 09/10/2026, com a Parte A concluída)**

1. Decidir OpenRouter x APIs diretas — **concluído: APIs diretas** (motivos abaixo).
2. Chaves de teste — **em andamento**: o amigo e parceiro do Luis no projeto já tem chaves com crédito e as passa em
   10/10, só para os testes (o ideal é uma chave nova, só para este computador, com limite de gasto e recarga
   automática desligada). Ficam no `.env.local`, nunca no chat. As contas definitivas, com o e-mail do projeto, ficam
   para antes da publicação.
3. **T9** adaptadores reais, por partes: primeiro o Claude (que trabalha em duas etapas da receita), depois GPT e Gemini.
   IA com chave no `.env.local` = real; sem chave = simulada. A IA simulada continua nos testes automáticos, que
   nunca gastam dinheiro. Inclui escolher o modelo de cada papel.
4. Medir: rodar a receita 3 a 5 vezes com pedidos diferentes; olhar qualidade, tempo e custo em dólar; ajustar os prompts.
   E comparar com uma IA sozinha: o mesmo pedido feito só a uma IA, e os dois sites mostrados a algumas pessoas sem
   dizer qual é qual. É o primeiro teste da ideia central do produto, antes mesmo da etapa 6.

**Por que fazer a Parte B antes de login, histórico e créditos** (conversa de 09/10): o MVP existe para provar que um
leigo acha o resultado de um time de IAs melhor que o de uma IA só, e só IAs de verdade respondem isso. A IA simulada
esconde as três maiores incógnitas: qualidade (os prompts geram um site bom?), tempo (a simulada leva 26 s; as reais,
alguns minutos, porque o site é escrito duas vezes) e custo (sem ele não dá para decidir preço dos planos e créditos).
Créditos e histórico guardam consumo e custo de cada etapa, então é melhor saber o formato real antes de construí-los.

**Decisões da Parte B**
- **APIs diretas, sem OpenRouter** (Luis, 09/10): o código fala direto com a Anthropic, a OpenAI e o Google, com as
  bibliotecas oficiais de cada uma. Motivos: (1) o plano "Traga sua chave" exige a ligação direta (o usuário traz a
  chave de cada empresa), então essas peças existiriam de qualquer jeito; (2) a troca de IA da T8 supõe que as IAs
  falham separadas, e com um intermediário as três cairiam juntas; (3) sem a taxa do intermediário (~5% sobre cada
  crédito comprado), que sairia da margem; (4) o preço por uso é o mesmo, então medir pelas diretas já dá o custo final.
  O preço da escolha: três contas e três adaptadores em vez de um. O OpenRouter continua possível no futuro como mais
  um adaptador (ex.: testar modelos baratos de outras empresas em papéis simples).
- **E-mail só do projeto** (Luis, 09/10): as contas das IAs (e, na etapa 5, Supabase e Vercel) usam um Gmail novo e
  neutro, não o e-mail pessoal. Separa cobranças da vida pessoal e facilita a entrada de sócio ou funcionário. Quando
  houver marca e domínio, o e-mail novo vira administrador e o antigo sai, sem recriar contas. Verificação em duas
  etapas em todas. Cartão pessoal por enquanto; com CNPJ, trocar cartão e dados de cobrança (perguntar ao contador sobre
  impostos de serviço do exterior). O GitHub segue na conta pessoal (dá para passar para uma organização depois).
- **A conta é definitiva, as chaves são descartáveis:** agora só chaves de teste (computador do Luis). Na publicação,
  chaves separadas para o site no ar; se uma vazar, apaga-se só ela.
- **Nomes no `.env.local`:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` e `GEMINI_API_KEY` (os que as bibliotecas oficiais
  procuram). Chaves nunca no chat.
- **Cuidados conferidos em 09/10:** crédito mínimo de US$ 5 na Anthropic e na OpenAI, que vale por 1 ano e não é
  devolvido. Na OpenAI a recarga automática vem **ligada** e precisa ser desligada. A OpenAI pode pedir a "verificação da
  organização" (foto de documento + selfie, por uma empresa parceira) para os modelos mais novos escreverem ao vivo.
  Gemini no plano grátis: só pedidos inventados (o Google usa o conteúdo para melhorar os produtos) e só modelos Flash
  e o 2.5 Pro (o Pro mais novo exige plano pago). Antes de usuários reais, passar o Gemini para o plano pago.

**Fora da etapa 4:** login, créditos, histórico, banco e publicação na Vercel (publicar com IAs reais
sem login deixaria qualquer um gastar nossos créditos; a publicação entra junto com o login).

**Decisões desta etapa**
- Estilos com **CSS Modules** + tokens (sem Tailwind).
- **Vitest** aprovado para testes automáticos (entra na T2; só desenvolvimento).
- **GitHub CLI** instalado na máquina do Luis para o Claude criar issues e PRs.
- Next.js **16.4** (gerado com `create-next-app`, sem pasta `src/`). Esta versão traz a própria documentação
  em `node_modules/next/dist/docs/` e mantém um bloco automático no fim do AGENTS.md.
- Endereços das páginas com nomes em inglês (regra de nomes de arquivo do AGENTS.md).
- **Sites gerados com JavaScript "de enfeite"** (decidido pelo Luis em 08/10, no PR #11): o site pode ter JS leve
  (menu, fotos que passam, animações), mas precisa funcionar completo sem ele, e o visual deve ser caprichado.
  A prévia roda o site num "quarto trancado" (moldura isolada, sem acesso à conta, aos créditos, à nossa página
  nem à internet). Motivos: proteger contra código plantado via "injeção de prompt" (texto colado com instruções
  escondidas) e contra erros, já que o revisor lê o código mas não roda o site.
- **Codex como revisor:** ainda não confirmado se está conectado ao GitHub. Enquanto não estiver,
  o Luis revisa e faz o merge sozinho.
- **Motor como "narrador"** (T4): o motor (`lib/engine/`) roda as etapas em ordem e devolve eventos
  (execução começou, etapa começou, pedaço de texto, etapa terminou, execução terminou, falhou, cancelada).
  Ele recebe as IAs prontas e não escolhe nenhuma. Uma regra no ESLint barra importar telas, Next.js ou React
  no motor, nas IAs e nas receitas.
- **O que cada IA recebe** (T4): prompt de sistema = papel + tarefa da etapa; entrada = o pedido e as respostas
  anteriores que a receita indica, cada parte marcada com `<parte nome="...">`.
- **Pedido** (T4): conferido no motor (vazio ou acima de 4.000 caracteres não começa; espaços nas pontas não contam).
  O limite fica em `MAX_REQUEST_CHARS`, que a tela da T5 usa no contador.

- **Telas da T5:** a página inicial separa "Receitas prontas" de "Em breve" (as 3 receitas do MVP que faltam
  aparecem apagadas, sem botão). Cada receita pronta tem seu endereço (`/recipes/create-site`); endereço
  inexistente ou de receita "Em breve" mostra uma página "não encontrada" em português. Na lista de IAs, a
  sugerida aparece como "(recomendada)". Para o navegador vai só o que a tela mostra: os prompts ficam no servidor.
- **Deixado de fora na T5** (estava no protótipo): busca de receitas, "+ Adicionar papel", forma de pagamento,
  custo estimado, receitas das fases 2 e 3 e "Criar projeto próprio". Entram quando chegar a vez delas.
- **Como as telas foram conferidas:** um roteiro temporário comanda o Chrome do computador (sem instalar nada no
  projeto), clica, digita e tira prints em tamanho de computador e de celular (390 e 320 px).

- **Rota `POST /api/runs`** (T6): responde uma linha de JSON por evento (formato "NDJSON") enquanto as IAs trabalham.
  Pedido inválido volta na hora, sem chamar IA, com os problemas em português. Só aceita JSON (isso também
  impede outro site de disparar execuções pelo navegador de alguém) e corpo de até 64 KB.
- **O que sai para o navegador** (T6): só o que o usuário pode ver, numa lista do que PODE sair
  (`lib/runs/public-events.ts`); campo interno novo no motor fica de fora sozinho. Modelo, tokens e mensagem
  técnica ficam no servidor (a falha vai para o registro do servidor).
- **Conexão caiu, IAs param** (T6): se a pessoa cancela, fecha a página ou perde a internet, o servidor manda a
  IA parar na hora (conferido: cancelou aos 2 s, o servidor parou junto).
- **Narração sem compactação** (T6): senão os pedaços chegam todos juntos no fim. Conferido também na versão de
  produção (`npm run build` + `next start`), que compacta as páginas comuns.
- **Tela "Seu time está trabalhando"** (T6): a própria página da receita troca do formulário para os cartões, sem
  endereço novo (a execução ainda não fica salva; com o banco, na etapa 5, cada execução ganha seu endereço).
  No lugar do "Pausar" do protótipo há "Cancelar" (pausar e retomar entram na etapa 5). No fim, "Começar de novo"
  volta ao formulário com o mesmo time e pedido. Uma execução inteira com a IA simulada leva uns 26 segundos.
- **Formato por etapa** (T6): cada etapa da receita diz se escreve texto ou HTML. Texto aparece em caixa clara;
  código, em caixa escura, como no protótipo. O formato do resultado final passou a ser o da última etapa
  (saiu o campo `resultFormat` da receita).
- **Caixa de cada etapa** (T6): tem altura máxima e rola por dentro, acompanhando o fim do texto enquanto a IA
  escreve (se a pessoa sobe para ler, ela para de acompanhar). Para leitor de tela: o foco vai para o título ao
  trocar de tela, e um aviso invisível conta cada troca de etapa e o fim, sem ler o texto das IAs.
- **Nova pasta `lib/runs/`** (T6): a execução vista de fora (o que pode chegar ao usuário, a conferência do pedido que
  chega pela internet e o envio em linhas). Está na "cerca" do ESLint, como o motor. AGENTS.md atualizado.
- **Deixado de fora na T6** (estava no protótipo): "Ver resposta completa" (a caixa rola por dentro) e "Pausar".

- **Tela de resultado** (T7): quando o time termina um site, a mesma página vira "Seu site está pronto" (sem endereço
  novo, como na T6). No alto: "Concluído em 26 s", "Começar de novo" (no lugar do "Salvar em projetos" do protótipo) e
  "Baixar arquivo". Abas Prévia e Código (dá para trocar com as setas do teclado). Ao lado, "Como o time chegou aqui":
  uma frase por etapa, escrita na receita (campo novo `doneSummary`, no passado: "Leu o código e apontou o que
  precisava ser corrigido"). "Ver todas as etapas" abre embaixo os mesmos cartões da execução, para ler do começo.
  Se o resultado final for texto (receitas futuras), continua a tela da execução, com o texto no último cartão.
- **Prévia em "quarto trancado", três camadas** (T7): (1) moldura com `sandbox="allow-scripts"` e sem
  `allow-same-origin`; (2) regras no começo do próprio site que barram tudo o que viria da internet
  (`components/generated-site.ts`); (3) o cabeçalho `frame-src 'none'` nas nossas páginas (`next.config.ts`), que
  impede o site de levar a moldura para outro endereço. Sem a camada 3, o experimento mostrou que um código malicioso
  conseguia mandar dados para fora trocando o endereço da moldura. Um teste automático garante que ninguém acrescente
  `allow-same-origin` sem perceber.
- **Links na prévia** (T7): "#cardapio" rola a prévia (precisou de `<base href="about:srcdoc">`; sem isso, o clique
  carregava a nossa página dentro da moldura). Links para fora (WhatsApp, telefone, e-mail) não abrem na prévia, e um
  aviso embaixo dela explica; no arquivo baixado funcionam.
- **Baixar arquivo** (T7): o nome vem do título do site ("doce-encanto-confeitaria.html"; sem título, "meu-site.html").
  O arquivo sai como `application/octet-stream`: o navegador só salva, nunca abre o site como página do nosso endereço.
- **Como a segurança foi testada** (T7): um roteiro temporário fez o "time" devolver um site malicioso na tela de
  verdade (inclusive na versão de produção), com ~30 tentativas de vazar dados (buscar na internet, imagens, scripts,
  fontes, WebSocket, formulário, janela nova, trocar o endereço da moldura, ler cookies e armazenamento, uma "tela de
  login" falsa...). Um servidor espião anotava qualquer acesso: **nenhum pedido chegou**, e cookies e armazenamento da
  nossa página não foram lidos. Sem as proteções, o mesmo site fez 23 pedidos.
- **Limite conhecido** (T7): quando o código tenta trocar o endereço da moldura (ou abrir uma moldura de outro site
  dentro dela), o Chrome "aquece" uma conexão com o site de destino antes de a regra bloquear. Nenhum dado do site vai
  junto, mas o nome do site de destino é consultado na internet, e um atacante poderia esconder alguns caracteres
  nesse nome. Não há como impedir isso de dentro da página (o recurso do navegador que permitiria cancelar antes vem
  desligado em molduras isoladas). Risco baixo; reavaliar antes do lançamento público.
- **Testado só no Chrome** (T7; o Edge usa o mesmo motor). Firefox e Safari ficam para a rodada de testes com usuários.
- **Deixado de fora na T7** (estava no protótipo): "Salvar em projetos", "Pedir ajuste", créditos usados e a lista de
  problemas do revisor no resumo (a revisão inteira está em "Ver todas as etapas").

- **Novas tentativas** (T8): quando uma IA falha com um erro passageiro (sobrecarga, conexão que cai, resposta pela
  metade), ela recomeça a etapa do zero depois de 1 s e, se falhar de novo, depois de mais 2 s. O texto da tentativa que
  falhou sai da tela e não vai para a próxima etapa. Erro que não adianta repetir (ex.: a IA recusou o pedido) pula
  direto para a troca. Defeito no nosso código para na hora, sem tentar de novo nem trocar.
- **Troca de IA** (T8): depois de 3 falhas, outra IA assume o papel e faz a etapa do zero. Quem assume é a IA
  recomendada pela receita; se foi ela que falhou, a **IA reserva** do papel, um campo novo da receita
  (`backupProvider`). Na receita "Criar um site": Chefe Claude → reserva GPT; Programador GPT → reserva Claude;
  Revisor Gemini → reserva Claude (não o GPT, para quem revisa não ser quem escreveu o código).
  A IA que assumiu **segue no papel** até o fim (se o Claude falha no plano, o GPT também faz a consolidação), para não
  perder tempo de novo com uma IA que está com problema. Se a substituta também falhar, o time para.
- **Avisos na tela** (T8): faixa âmbar no cartão ("O GPT teve um problema e está tentando de novo (2ª tentativa)…" e
  "O Claude entrou no lugar do GPT, que não conseguiu responder."); o segundo fica também em "Como o time chegou aqui".
  Se o time para: "Revisor: nem o Gemini nem o Claude conseguiram terminar a etapa. As etapas concluídas continuam aqui."
  O leitor de tela também ouve cada aviso. Cores novas nos tokens: `--color-warning-text` e `--color-warning-bg`.
- **O tempo da etapa** (T8) conta as tentativas que falharam e as esperas: é o tempo que a pessoa esperou.
- **Registro do servidor** (T8): cada falha aparece no terminal do `npm run dev` com a mensagem técnica
  (`[api/runs] A etapa "code" falhou (gpt); tentativa 2 daqui a 1000 ms: ...`). A tela nunca recebe essa mensagem.
- **Interruptor de teste** (T8): `MOCK_AI_FAILURES` no `.env.local` faz a IA simulada falhar de propósito (ela escreve
  um pouco e "cai", como uma conexão que cai no meio). Exemplos no `.env.example`, que passou a existir. O `npm run dev`
  percebe a mudança sozinho ao salvar o arquivo.
- **Conferido na tela** (T8) com o roteiro temporário no Chrome, nos três casos (acerta na 3ª tentativa, o Claude assume
  o Programador, o time para no Revisor), em tamanho de computador e de celular (320 px).
- **Deixado de fora na T8**: o interruptor para o usuário desligar a troca de IA (a regra diz "pode ser desligado"; entra
  quando houver onde mostrar a opção) e "tentar de novo a partir da etapa que falhou" (precisa do banco, etapa 5).

**Anotado para as próximas tarefas**
- Falta o ícone da aba do navegador (favicon). Pequeno; entra quando definirmos nome e marca.
- T9: IAs reais às vezes cercam o HTML com marcas de código (` ```html `); limpar antes da prévia.
- T9: nos adaptadores reais, separar bem os erros: sobrecarga, limite de uso e conexão caída são "passageiros"
  (`retryable: true`); chave errada ou faltando e pedido recusado não são. Chave faltando deve ser um `ProviderError`
  (assim a troca de IA entra); um `Error` comum é tratado como defeito nosso e para na hora. Se a IA disser quanto
  esperar (cabeçalho `retry-after`), considerar.
- Etapa 5 (créditos): uma tentativa que caiu no meio já consumiu tokens, que pagamos mas não cobramos do usuário
  (regra "etapa que falhou não é cobrada"). Registrar esse custo no histórico interno.
- Antes de ligar IAs reais fora do computador do Luis: a rota `/api/runs` está aberta (sem login). Com a IA simulada
  não custa nada, mas com IAs reais qualquer um gastaria nossos créditos. Entra junto com o login
  (e o limite de 1 execução simultânea no plano grátis).
- Ideia para depois: marcar os arquivos "só do servidor" com `import "server-only"` (o Next.js barra se forem parar
  no navegador). Exige instalar o pacote `server-only` para os testes; propor antes.

**Ideias de produto para discutir** (anotadas em 09/10; bom tema para o Cowork)
- **O maior concorrente é "abrir o ChatGPT e pedir".** Muita gente já usa uma IA sozinha, às vezes de graça, e ela já
  faz um site de um arquivo. O time de IAs precisa entregar um resultado claramente melhor ou dar muito menos trabalho.
- **Resultado que um leigo consegue usar:** um arquivo `.html` baixado não serve para quem não sabe o que fazer com ele.
  Na receita de site, o que facilita a vida é "publicar com um clique" (um endereço para mandar aos clientes).
  Cuidado de segurança: os sites publicados teriam de ficar num endereço separado do nosso (seção 6 do AGENTS.md).
- **Perguntas guiadas no lugar da caixa em branco:** a receita perguntaria o que importa (nome do negócio, o que vende,
  WhatsApp, cores) em vez de exigir que a pessoa saiba escrever um bom pedido. **O Luis gostou (09/10)**: entra no
  produto (já está no DOCUMENTO-PROJETO); falta decidir quando. As respostas viram o pedido que vai para o time.

## Etapa 5 — Base para empresas (começou em 24/10/2026)

**Decisão do Luis (24/10):** refazer o banco do zero, num projeto novo do Supabase (Gmail do projeto, região São
Paulo), sem usar as tabelas do Supabase do parceiro. As tabelas passam a viver no repositório, como migrações.

**O que foi feito (24/10, Claude Code; PR só de documentos)**
- Proposta completa do banco em `docs/BANCO-DE-DADOS.md`: tabelas, carteira como extrato com reservas, regras de acesso
  por empresa (RLS), login pelo Supabase Auth, ordem das migrações e dos PRs da etapa.
- Ao estudar o código atual, 5 falhas novas no `FALHAS.md`: F23 (apagar funcionário devolve o gasto dele ao crédito),
  F24 (gasto e teto falham com pedidos ao mesmo tempo), F25 (o dono define o próprio crédito), F26 (o custo das
  tentativas que falharam não é registrado) e F27 (qualquer pessoa lê as execuções direto no banco com a chave pública).
  F14 passou a "Decidida" (banco do zero com migrações).
- Orientação para ligar o GitHub ao Supabase (opções no `BANCO-DE-DADOS.md`): "Deploy to production" ligado,
  "Automatic branching" desligado (é pago). Conferida pelo Luis no mesmo dia (abaixo).
- Regra nova no AGENTS.md (seção 8): mudança de tabela só por migração no GitHub, nunca pelo painel do Supabase.

**Decisões do Luis (24/10, Cowork):** teto do funcionário **por mês** (renova dia 1º); o dono vê **só o resumo e as
entregas**, sem ler conversas (F05, opção a); **"Traga sua chave" fora** do banco novo. Detalhes no fim do
`BANCO-DE-DADOS.md`; `DOCUMENTO-PROJETO.md` atualizado com as três.

**Projeto novo no Supabase (24/10, Luis):** conta e projeto `multi-ia` (Gmail do projeto, organização `multi-ia`, plano
Free, região São Paulo), ligado ao repositório. Ligação do GitHub conferida (pasta `.`, branch `main`, *Deploy to
production* ligado, *Automatic branching* desligado por ser do plano Pro). Opções de segurança no `BANCO-DE-DADOS.md`.

**PR 1 da etapa 5 — banco novo (24/10, Claude Code; issue #23, PR #24)**
- `supabase/config.toml` (configuração do banco local, gerada pela ferramenta do Supabase) e 5 migrações em
  `supabase/migrations/`: empresas e pessoas; carteira (extrato, reservas e as funções do dinheiro); trabalho (receitas
  próprias, execuções, narração, conversas, tarefas, arquivos); a tabela interna `ai_calls`; a pasta fechada `files`.
- `supabase/seed.sql`: empresa de exemplo (dona Marina, funcionários Ana e Bruno, R$ 200 de crédito), só para o banco
  local e as checagens.
- 91 testes do banco em `supabase/tests/database/` (estrutura, regras de acesso com duas empresas de mentira, carteira).
  Rodam nas checagens do GitHub, num banco temporário igual ao do Supabase (parte "Banco de dados" do `ci.yml`).
- **Ferramenta nova aprovada pelo Luis (24/10):** a ferramenta oficial do Supabase (Supabase CLI, versão 2.120.0), só
  nas checagens do GitHub. Nada instalado no computador nem no `package.json`.
- **Decisões de desenho** (detalhes no `BANCO-DE-DADOS.md`):
  - O dono acompanha os funcionários pelo extrato: cada gasto tem uma descrição escrita pelo servidor ("Criar um site ·
    Programador"), a IA e a data. É assim que ele vê "quem, quando, receita ou IA, custo" sem ler pedidos (decisão 2).
  - Nem o nosso servidor grava direto no extrato: só pelas funções `wallet_reserve`, `wallet_charge` e
    `wallet_close_hold`. Recarga e ajuste (`private.wallet_topup` e `private.wallet_adjust`) só pelo editor de SQL do
    painel do Supabase (F25). O comando da recarga está no `BANCO-DE-DADOS.md`.
  - Se o custo real passar da estimativa, a cobrança entra assim mesmo e o servidor é avisado para pausar; o saldo pode
    ficar um pouco negativo (F29, aceita).
  - Reserva esquecida aberta (servidor caiu) para de segurar o saldo depois de 1 hora.
  - Pela sessão de quem está logado dá para ler o que é seu, criar conversas e receitas próprias e apagar o próprio
    trabalho (LGPD). Execuções, tarefas, arquivos e dinheiro são gravados só pelo servidor.
- **Como foi conferido:** antes de enviar, um ensaio local (PGlite, um Postgres que roda dentro do Node, só na pasta
  temporária do Claude, sem instalar nada no projeto); depois as checagens do GitHub, no Postgres 17 do Supabase:
  migrações e empresa de exemplo montaram sem erro e os 91 testes passaram. Para saber se os testes pegam erros de
  verdade, o Claude estragou de propósito 6 cópias das migrações (regras abertas, funções sem trava, extrato editável,
  teto sem conferência...): todas deixaram a checagem vermelha.
- Falhas: F14 resolvida; F23 a F27 passaram a "Decidida" (o banco novo resolve, falta trocar o código no PR 3);
  F05 com andamento; novas F28 (arquivo apagado direto pelo banco deixa o conteúdo na pasta) e F29 (saldo negativo).
- **Ainda não conferido:** o login dos usuários (fica para o PR 2).
- **Atenção nas checagens:** o GitHub às vezes demora a baixar as imagens do Supabase ("toomanyrequests" no registro);
  nesta vez ele tentou de novo sozinho e passou. Se a parte "Banco de dados" falhar só por isso, basta rodar de novo
  (*Re-run jobs*).

**Banco no ar (24/10, Luis):** merge do PR #24 feito. No painel do Supabase, as 5 migrações foram aplicadas sem erro, as
11 tabelas existem e estão vazias, a pasta `files` é privada e o Postgres é o 17.11 (a mesma versão das checagens).

**Decisões do Luis para o login (24/10, Claude Code)**
- **Biblioteca `@supabase/ssr` aprovada:** a oficial do Supabase para login no Next.js. Guarda o login num cookie seguro
  e o renova sozinho. Entra no PR 2a.
- **Testes num segundo projeto grátis do Supabase** (`multi-ia-teste`), não no de verdade: o computador guarda só chaves
  de teste, o extrato de verdade fica sem recargas de mentira (ele não deixa apagar linhas) e dá para testar migração
  nova antes do merge. As migrações chegam lá pelo workflow "Banco de testes" (detalhes no `BANCO-DE-DADOS.md`).
- **Convite do funcionário por link para copiar:** o dono informa nome, e-mail e teto; o sistema gera um link que só
  funciona uma vez e vale 24 horas; o dono manda pelo WhatsApp; o funcionário cria a própria senha. Não depende de
  e-mail, e só o funcionário conhece a senha (F12).
- **O PR 2 vira dois:** 2a (cadastro da empresa, entrar, sair, confirmar o e-mail, páginas protegidas; F10, F11, F13) e
  2b (convite e a parte "Equipe" do painel do dono; F12). Entre o PR 2a e o PR 3, o chat e a receita de site ficam com um
  aviso, porque o código do parceiro ainda usa as tabelas antigas, que não existem no banco novo.
- **Falha nova F30:** o envio de e-mail embutido no Supabase só entrega para a equipe do projeto, até 2 por hora. Antes da
  primeira empresa real, ligar um serviço de e-mail próprio.

## Próximo passo

1. **Luis:** fazer o merge do PR do projeto de testes. Depois, criar o projeto `multi-ia-teste` e configurar (passo a
   passo na conversa de 24/10 e no `BANCO-DE-DADOS.md`): opções de login, chaves no `.env.local`, segredo
   `SUPABASE_TEST_DB_URL` no GitHub e o botão *Run workflow* em *Actions → Banco de testes*.
2. **Claude Code** (esforço Extra alto): PR 2a, login de verdade. Depois, PR 2b, convite de funcionário.
3. Depois: PR 3 (trocar o código do parceiro para o banco novo; F16, F22 a F28).
4. **Com o parceiro (sem código):** avisar da F27, caso o banco dele esteja no ar com dados de verdade; confirmar a
   visão e as etapas 5 a 8; combinar o jeito de trabalhar: cada um com a própria conta no GitHub (F21), uma tarefa = um
   PR pequeno, o PROGRESSO atualizado em todo PR (F20) e tabelas só por migração.

## Decisões em aberto

- Nome e marca (OCK é provisório)
- Formato do preço (por empresa, por funcionário, pelo consumo), margem e plano de teste (F04)
- Se e quando nichar (F02)
- Modelo de cada papel e de cada nível (econômico, padrão, potente)
- Cronograma

## Como retomar em uma conversa nova

**No Claude Code (etapas de código):**
1. Abra o VS Code na pasta `C:\Users\Luis\projetos\multi-ia` e abra o terminal (Ctrl + ').
2. Rode `git pull` (traz a versão mais nova do GitHub) e depois `claude`.
3. Cole: "Estamos no projeto Multi-IA. Leia o AGENTS.md e o docs/PROGRESSO.md e continue de onde paramos."

**No chat do Claude (claude.ai), para discutir decisões:**
1. Anexe `docs/PROGRESSO.md`, `docs/BANCO-DE-DADOS.md` e `docs/FALHAS.md` (o chat não lê a pasta sozinho).
2. Cole: "Estamos no projeto da plataforma multi-IA. Leia os arquivos anexados e me ajude a decidir [o assunto]."

**No Cowork (discussões, documentos, planejamento):**
1. Conecte a pasta `C:\Users\Luis\projetos\multi-ia`.
2. Cole: "Estamos no projeto da plataforma multi-IA. Leia o docs/PROGRESSO.md e o docs/FALHAS.md e continue de onde paramos."

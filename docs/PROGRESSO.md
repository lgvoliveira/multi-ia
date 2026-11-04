# PROGRESSO — Plataforma Multi-IA

> Diário do projeto. Toda conversa nova (Cowork ou Claude Code) começa lendo este arquivo.
> Atualizado pelo Claude ao fim de cada etapa.
> **Versão oficial:** este arquivo, no repositório `C:\Users\Luis\projetos\multi-ia\docs\`.

**Última atualização:** 04/11/2026 (painel do dono: créditos por pessoa + custo total da empresa; antes: 27/10/2026,
madrugada — bloco 1, issue #54: a Proposta comercial na `main`, pelo merge do Luis em 26/10; o segundo PR, a receita
"Posts para redes sociais", esperando o teste do Luis)
**Etapa atual:** bloco 1 da nova ordem (etapa 6, o produto do funcionário). A etapa 5 (base para empresas) está no ar e
testada; o teste com créditos dela passou para o bloco 6. Veja "Nova ordem (26/10)", antes do "Próximo passo"

> **Nota (04/11/2026, Claudio):** o painel do dono mudou a pedido do Leandro. O card de cada pessoa da equipe
> (`MemberMonth`) deixou de ter qualquer gasto por IA e passou a mostrar só três números, em créditos e em reais:
> **créditos gastos**, **créditos restantes** (do teto; sem teto, o disponível da empresa) e **total investido nesta
> pessoa** (gasto + separado agora). O alto do painel (`CompanyCredit`) virou o **painel de custo total da empresa**:
> disponível, colocado em créditos no mês (recargas), gasto no mês, execuções no mês (tarefas rápidas + receitas) e
> saldo, e só ali fica o gasto do mês por IA. Convenção adotada: **1 crédito = R$ 1,00** (`formatCredits` em
> `lib/ock/pricing.ts`), a confirmar com o Leandro/Luis. Limite conhecido: a soma das recargas vem das 200 linhas mais
> recentes do extrato do mês; se houver mais, a tela avisa "soma das recargas mais recentes".

> **Nota (27/10/2026):** adicionada a **voz de saída** — botão "Ouvir" em cada resposta da IA, que lê o texto
> em voz alta via TTS da OpenAI (`lib/ock/speak.ts`, rota `app/api/ock/speak`, botão no `QuickChat`/`Answer`).
> A rota segue o padrão das outras do chat: portão de ferramentas `OCK_AI_TOOLS` ("voz") e conferência de que
> quem chama é da empresa, logado e ativo. (Recuperado do antigo branch `feat/ock-voz-ouvir-resposta`, que havia
> divergido; portado só o "Ouvir" sobre a `main` atual.) Pendente: cobrar da carteira por leitura (hoje grátis).

> **Nota (27/10/2026):** adicionada a **visão raio-x** — um modo SÓ LOCAL para ver o site inteiro dos dois lados
> (Chefe e Funcionário) com um clique, sem login, e-mail nem crédito. Liga com `OCK_DEMO_MODE=1` no `.env.local`, com
> **trava dupla**: a variável E `NODE_ENV !== "production"` (no site publicado nunca liga; a rota `/raiox` dá 404).
> Usa as contas que o seed já cria (empresa "Agência Exemplo", com crédito). Arquivos: `lib/auth/demo.ts` (+ teste),
> `app/raiox/` (página + ação `signInWithPassword` nas contas de teste), `components/DemoSwitcher` (barra no topo que
> alterna o lado) e um atalho na porta de entrada (`OckEntry`). Serve para o dono do produto demonstrar o funcionamento.

> **Nota (27/10/2026):** adicionada a **recarga de teste** na visão raio-x. No painel do dono, só no computador (modo
> raio-x), aparece "Recarga de teste": o dono põe crédito fictício na empresa para testar à vontade. A recarga de
> verdade continua só pelo painel do Supabase (F25); esta é uma função à parte (`demo_wallet_topup`) criada **só no seed
> local** (não existe na produção, onde a F25 segue inteira), chamada por uma ação conferida no servidor (modo raio-x e
> dono logado). Arquivos: `components/DemoRecharge`, `demoTopupAction` em `app/dono/actions.ts`, `parseTopupAmount` em
> `lib/ock/team-forms.ts`, a função no `supabase/seed.sql` e a exceção "demo_*" no teste de estrutura do banco. Para
> ver no computador: `supabase db reset` (recria o seed com a função) e entre pela visão raio-x como Chefe.

> **Nota (28/10/2026):** adicionada a tela **"Conectar chaves de IA (teste)"** na visão raio-x. No computador, em
> `/raiox`, dá para colar as chaves da plataforma (Claude/GPT/Gemini) e salvar, **sem editar o `.env.local`**. As chaves
> vão para `.ock-local-keys.json` na raiz (está no `.gitignore` — nunca no Git nem na produção), que o servidor lê SÓ no
> modo raio-x: `serverKeys` sobrepõe essas chaves ao ambiente, e conectar uma chave já liga a IA real (`aiMode`). Em
> produção a rota `/api/ock/demo-keys` dá 404 e as chaves continuam vindo só do ambiente do servidor (chave-da-plataforma).
> Arquivos: `lib/keys/demo-keys.ts` (+ teste), `components/DemoKeys.tsx`, `app/api/ock/demo-keys/route.ts`, e os encaixes
> em `server-keys.ts`, `mode.ts`, `.gitignore` e `app/raiox/page.tsx`.

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
| 5 | Base para empresas: banco novo do zero (no repositório), login de verdade, cadastro de empresa, painel do dono protegido, OCK rodando no computador do Luis | Concluída (26/10): PR 1 (banco), PR 2a (login), PR 2b (convite), o PR 3 inteiro (3a, 3b, 3c, aba Receitas e 3d, painel do dono) e as IAs de verdade sem gastar (#47 a #52) no ar e testados. O teste com créditos passou para o bloco 6 | Claude Code |
| 6 = bloco 1 | O produto do funcionário: 3 receitas para PMEs, receita própria e escolha livre da IA no chat | Em andamento (issue #54, aprovada em 26/10): 1º PR, a Proposta comercial, no ar (#56); 2º PR, os Posts, esperando o teste | Claude Code |
| bloco 2 | Conta de verdade: e-mail próprio do login (F30), recuperar a senha do dono, termos de uso e privacidade com aceite (F05) | A fazer | Claude Code (+ guia para criar a conta do e-mail) |
| bloco 3 | Painel interno da plataforma: empresas, recarga pela tela, extrato de recargas, custo real das IAs contra o cobrado | A fazer | Claude Code |
| 7 = bloco 4 | Pagamento, só preparar: comparação de gateways (Pix, boleto, cartão); programar só depois da decisão do preço (F04) e do CNPJ | A fazer | Claude Code (pesquisa) + Luis e parceiro (decisão) |
| bloco 5 | Publicação: site na Vercel com domínio, chaves de produção e a F54 resolvida | A fazer | Claude Code + guia |
| bloco 6 | IAs de verdade: sessão 2 do `GUIA-TESTE-IAS-REAIS.md`, medição de custo e tempo, revisão dos modelos com a pesquisa de 12/10 | A fazer (por último) | Claude Code + guia |
| 8 | Conversas e testes com 3 a 5 empresas reais, e ajustes | A fazer | — |

As etapas 5 a 8 eram uma proposta de 22/10, a confirmar com o parceiro. Em 26/10 o Luis trocou a ordem do que vem depois
da etapa 5 pelos seis blocos acima (detalhes em "Nova ordem (26/10)"). A carteira, o teto e a estimativa da etapa 7
ficaram prontos na etapa 5; dela sobraram o preço e o pagamento, que viraram o bloco 4.

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
- T9: IAs reais às vezes cercam o HTML com marcas de código (` ```html `); limpar antes da prévia. **Feito em 26/10**
  (PR do site sem as marcas de código, `lib/engine/output.ts`).
- T9: nos adaptadores reais, separar bem os erros: sobrecarga, limite de uso e conexão caída são "passageiros"
  (`retryable: true`); chave errada ou faltando e pedido recusado não são. Chave faltando deve ser um `ProviderError`
  (assim a troca de IA entra); um `Error` comum é tratado como defeito nosso e para na hora. Se a IA disser quanto
  esperar (cabeçalho `retry-after`), considerar. **Feito em 26/10 (PR #47)**, menos o `retry-after`.
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

**PR 2a da etapa 5 — login de verdade (24/10, Claude Code; issue #26)**
- **O que ficou pronto:** o dono cria a conta da empresa em `/cadastro` (nome da empresa, nome, e-mail, senha de 8+
  caracteres) e recebe um e-mail de confirmação; dono e funcionário entram pela mesma tela (`/entrar`) e cada um vai
  para a sua página; "Sair" no topo, que mostra o nome e a empresa de quem está logado. `/dono` só abre para o dono e
  mostra a equipe; `/trabalho` e as receitas só para quem é da empresa e está ativo, com um aviso de "em obras" até o
  PR 3. Quem foi desativado vê um aviso e não entra. Página de erro em português (`app/error.tsx`).
- **Como funciona por dentro:** a biblioteca `@supabase/ssr` guarda o login num cookie seguro; o `proxy.ts` (o antigo
  "middleware", que no Next.js 16 mudou de nome) renova o login a cada página; cada página protegida confere o login e
  lê o cadastro no banco com a sessão da pessoa (`lib/auth/viewer.ts`). A empresa e o dono só entram nas tabelas no
  primeiro acesso, com o e-mail confirmado (`lib/auth/company-signup.ts`).
- **Saiu:** o login antigo (senha temporária, código na URL), o painel antigo do dono e as rotas `/api/ock/login`,
  `change-password`, `company`, `member` e `summary`, com as funções que apagavam funcionário (F23) e deixavam o
  dono mudar o crédito (F25). O painel de gastos volta no PR 3, no banco novo.
- **Nomes novos no `.env.local`:** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY` (os tipos de chave
  atuais do Supabase), no lugar de `..._ANON_KEY` e `..._SERVICE_ROLE_KEY`.
- **Ficaram guardados, sem uso, até o PR 3:** o chat (`components/OckWorkspace.tsx`) e a tela da receita
  (`components/RecipeFlow.tsx`). As rotas `/api/ock/*` e `/api/runs` ainda não conferem o login (F16, PR 3).
- **Como foi conferido:** lint, tipos, 181 testes (22 novos: formulários, cadastro pendente, criação da empresa, equipe)
  e build. No navegador (roteiro temporário no Chrome, computador e celular de 320 px), sem as chaves do Supabase: as
  páginas protegidas mandam para "Entrar", os erros aparecem campo a campo e o formulário avisa que o login não está
  configurado. As telas de quem está logado foram fotografadas com dados de mentira numa página temporária, já apagada.
- **Ainda não conferido:** o login de verdade, com o projeto de testes (depende do Luis criar o projeto e as chaves).
- **Falhas:** F10, F11 e F12 resolvidas; F13 e F16 com andamento; F14 corrigida no texto (estava "Decidida" no
  detalhe). Nova **F31**, já resolvida: o Next.js 16.4.0 tinha três falhas de segurança graves (uma nas "ações do
  servidor", que o login passou a usar). A pedido do Luis, o próprio PR 2a passou o Next.js para a 16.4.3 (num PR
  separado, os dois brigariam no `package-lock.json`). Conferido de novo: checagens, build e o roteiro no Chrome.

**Projeto de testes e login conferidos (24/10, Luis, com o chat do Claude e o `docs/GUIA-PROJETO-DE-TESTES.md`)**
- Projeto `multi-ia-teste` criado e configurado; o workflow "Banco de testes" ficou verde e as 11 tabelas apareceram
  vazias. As chaves dele estão no `.env.local` do computador do Luis.
- Login testado de verdade, todos os passos com o resultado esperado: cadastro da empresa, "Confira o seu e-mail", o
  link de confirmação abrindo o Painel do dono, `companies` e `members` com 1 linha cada (`role` = `owner`), senha
  errada com "E-mail ou senha incorretos", `/trabalho` em obras, `/dono` sem login mandando para Entrar, e o
  "desativado" (status `disabled` mostrou "Seu acesso foi desativado"; o status voltou para `active`).
- **Merge do PR #29 feito** (login de verdade na `main`). Com isso, a F22 andou: o site roda no computador do Luis,
  ligado ao banco de testes (o chat e as receitas ainda em obras até o PR 3).
- Correções no guia, do que ele encontrou: deixar vazio o campo "GitHub (optional)" ao criar o projeto de testes; a
  *Site URL* vem vazia e só salva preenchida; clicar dentro do `.env.local` antes do Ctrl + S (senão vai para o
  terminal) e conferir que a bolinha da aba sumiu; abrir um terminal novo para o `npm run dev`, porque o do Claude Code
  fica ocupado.

**PR 2b da etapa 5 — convite de funcionário e a parte "Equipe" do painel (24/10, Claude Code; issue #27, PR #30)**
- **O que ficou pronto:** no Painel do dono, "Convidar um funcionário" (nome, e-mail e teto do mês, que pode ficar vazio
  = sem teto). O sistema gera um link que vale 24 horas e funciona uma vez só, com botões **Copiar o link** e **Mandar
  pelo WhatsApp** (abre o WhatsApp com a mensagem pronta). O funcionário abre o link (`/convite/...`), vê a empresa e o
  e-mail com que vai entrar, cria a própria senha (digitada duas vezes) e entra. Abrir a página não gasta o convite (a
  prévia do link no WhatsApp também abre a página); só o botão gasta.
- **No cartão de cada funcionário:** etiquetas "Convite pendente", "Convite vencido" e "Senha nova pendente", com até
  quando o link vale (horário de Brasília); **Mudar teto**; **Gerar link novo** (para quem não aceitou a tempo ou
  perdeu a senha: o link anterior para de valer, e a senha antiga vale até o link novo ser usado); **Desativar** (com
  confirmação) e **Reativar**.
- **Como funciona por dentro:** o convite cria o login do funcionário no Supabase Auth (só com o e-mail, sem senha e
  sem mandar e-mail), a pessoa em `members` e uma linha na tabela nova `member_invites`, que guarda só o resumo (sha256)
  do código do link. Aceitar apaga o convite na mesma operação que confere o código e o prazo, grava a senha e entra;
  os outros aparelhos da pessoa são desconectados. Teto e situação mudam pela sessão do dono (o banco só deixa mexer nos
  funcionários da empresa dele). Detalhes no `BANCO-DE-DADOS.md` ("Como o funcionário entra").
- **Migração nova** (`20261024210001_member_invites.sql`) com 19 testes do banco novos (`04_invites`). A tabela foi
  criada no projeto de testes pelo workflow "Banco de testes", rodado pelo Claude no branch do PR; no projeto de verdade,
  ela entra sozinha no merge.
- **Decisão de desenho do Claude (no lugar do convite embutido do Supabase):** o código, o prazo e o "uma vez só" ficam
  numa tabela nossa, não no "Email OTP Expiration" do Supabase. Assim o painel sabe quem ainda não aceitou, o prazo não
  depende de uma opção do painel do Supabase, e um convite de uma empresa não interfere no de outra.
- **Ajuste visual:** os campos e botões dos formulários de entrada e cadastro (PR 2a) saíam na fonte padrão do sistema,
  não na do site; corrigido junto.
- **Como foi conferido:** lint, tipos, 216 testes (35 novos: código do link, senha repetida, teto em reais, convite com
  um Supabase de mentira em memória) e build. Banco: ensaio local (PGlite) com as 6 migrações e os 110 testes do banco;
  para saber se os testes novos pegam erro, o Claude estragou de propósito 6 cópias da migração (código legível pelo dono,
  sem conferir o dono, sessão criando convite, sem a chave dupla, sem o formato do resumo, sem RLS): todas ficaram
  vermelhas. **Teste de verdade, de ponta a ponta**, contra o projeto de testes: um roteiro temporário comandou um Chrome
  separado (dono numa janela, funcionária noutra) e passou por 28 conferências, de convidar a desativar, reativar e
  trocar a senha pelo link novo, sem nenhum erro no navegador; telas fotografadas no computador e em 320 px. Para isso, o
  Claude criou no projeto de testes donos de teste pelo servidor (empresas "Empresa de teste do Claude", e-mails
  `@example.com`); são dados de mentira e podem ficar.
- **Falhas:** F11 e F12 com andamento (as ações do dono e o convite chegaram). Novas: **F32** (o e-mail do funcionário
  não é conferido: é só o nome de entrada) e **F33** (o dono consegue entrar na conta de um funcionário usando ele mesmo
  o link de senha nova; hoje não mostra nada, mas com as conversas de volta no PR 3, iria contra a decisão de que o dono
  não lê conversas). A F33 precisa de uma decisão do Luis antes de empresas reais.
- **Guia do teste:** `docs/GUIA-TESTE-CONVITE.md`, para o Luis seguir com o chat do Claude.

**Convite testado pelo Luis e no ar (24/10, com o chat do Claude e o guia)**
- Os passos do guia funcionaram, e o **merge do PR #30** foi feito (convite na `main`). Ainda não confirmado: se a
  tabela `member_invites` apareceu no projeto de verdade.
- **Achado no teste (nova F34):** no começo, o Luis abriu o convite numa aba **normal** do mesmo navegador, não na
  janela anônima, e entrou como o funcionário (Leandro). Depois, na aba do dono, "Desativar" às vezes mandava para a tela
  do Leandro. Conferido pelo Claude: as abas normais dividem o mesmo login, então o navegador inteiro passou a estar
  conectado como o Leandro; o servidor recusou (quem pedia não era dono) e **nada foi gravado**. O "às vezes" veio de o
  dono ter entrado de novo no meio (no banco de testes, a última entrada do dono foi 35 s depois da do Leandro).
  Reproduzido com o Chrome por roteiro, com dono e funcionário em abas do mesmo navegador.

**PR do aviso de troca de login (24/10, Claude Code; issue #31)**
- **O que mudou:** se o login do navegador mudou desde que o painel do dono foi aberto, nenhum botão da Equipe muda
  nada, e o cartão avisa: "Nada foi mudado. Neste navegador, quem está conectado agora é Leandro…" (ou "A sua conta de
  dono não está mais conectada…"), com o caminho: Sair e entrar de novo como dono. Antes, a aba pulava para a tela do
  funcionário sem explicação. Também fecha um caso raro: com duas contas de dono no mesmo navegador, um convite podia
  ir para a empresa errada.
- **Como funciona:** cada formulário da Equipe leva escondido o id do dono que abriu o painel; o servidor confere se
  quem está conectado ainda é ele (`checkPageOwner`). O id escondido só serve para recusar; quem pode o quê continua
  decidido pelo login e pelo banco.
- **Decisão do Claude:** avisar no clique, e não assim que a aba volta a ficar à vista (isso pediria consultar o
  servidor de tempos em tempos, e o aviso no clique já evita o engano).
- **Guia:** a Parte C do `docs/GUIA-TESTE-CONVITE.md` explica por que a janela anônima (com o atalho do Opera GX), e a
  Parte H testa o aviso.
- **Como foi conferido:** lint, tipos, 222 testes (6 novos) e build. Roteiro no Chrome, contra o projeto de testes:
  na versão antiga, repetiu o que o Luis viu (a aba do dono foi para `/trabalho` e o Leandro continuou ativo); na nova,
  15 conferências passaram (aviso ao desativar, mudar teto e convidar, sem nada gravado e com o que foi digitado
  mantido; aviso com ninguém conectado; com o dono de volta, desativar, reativar e teto gravam; sem erros no navegador).
  Aviso fotografado no computador e em 320 px.

**Aviso testado pelo Luis e no ar (24/10, Parte H do guia, em abas normais)**
- Todos os passos deram o resultado esperado: o convite avisou quem estava conectado; com o funcionário (Bruno Teste)
  conectado em outra aba, "Desativar" na aba do dono, sem recarregar, mostrou "Nada foi mudado… quem está conectado
  agora é Bruno Teste" e o cartão não mudou; com o Bruno desconectado, apareceu "A sua conta de dono não está mais
  conectada"; depois de sair e entrar de novo como dono, "Desativar" funcionou. **Merge do PR #32 feito.** F34 conferida.

**Plano do PR 3 (aprovado pelo Luis em 24/10, Claude Code)**
- O PR 3 (trazer de volta o código do parceiro, no banco novo e com login) vira 4 partes, cada uma com um teste do Luis:
  1. **3a — Receitas com login** (issue #33): "Criar um site" volta para quem está logado; cada execução em nome do
     funcionário e da empresa; só ele acompanha e cancela; a narração volta a aparecer enquanto as IAs escrevem (F35);
     sai "Minhas chaves" (decisão 3 de 24/10). Ainda só com a IA simulada.
  2. **3b — Receitas cobrando:** estimativa e reserva antes de começar, cobrança por etapa pelo custo real, devolução da
     sobra, pausa se for passar da estimativa e o custo de toda chamada de IA em `ai_calls` (F24, F26).
  3. **3c — Tarefa rápida:** `/trabalho` volta com o chat, os arquivos e a voz, no banco novo e cobrando pela carteira
     (F13, F16).
  4. **3d — Painel do dono:** saldo da empresa, gasto do mês por funcionário e por IA (do extrato) e as entregas.
- **Falha nova F35** (achada pelo Claude ao estudar o código): o servidor só grava o texto das IAs quando a fase inteira
  termina, então a tela fica parada um ou dois minutos com IAs de verdade. Corrige na 3a.
- **F33 aceita por enquanto** (Luis): ainda não há empresas reais; resolver antes da primeira, junto com o envio de
  e-mail próprio (F30).

**PR 3a da etapa 5 — receitas com login (24/10, Claude Code; issue #33)**
- **O que ficou pronto:** a receita "Criar um site" voltou (`/recipes/create-site`), para quem é da empresa e está ativo.
  O "Em obras" do `/trabalho` ganhou o link **Abrir a receita "Criar um site"** (o chat volta na 3c). Cada execução fica
  em `runs` com a empresa e a pessoa tiradas do login; saiu o código anônimo guardado no navegador. Ver, acompanhar e
  cancelar só a própria execução: as rotas leem com a sessão de quem está logado, e o banco não devolve a de outra
  pessoa (nem para o dono da empresa, pela decisão 2 de 24/10). Começar e cancelar conferem que o login ainda é o de
  quem abriu a página (F34); a aba que perde o acesso avisa em vez de ficar parada.
- **Narração ao vivo de novo (F35):** o servidor grava o texto das IAs a cada segundo, enquanto a fase roda, juntando os
  pedaços de cada etapa; a tela busca as novidades a cada segundo pelo nosso servidor (saiu a leitura direta do
  Supabase com a chave pública, F27).
- **Achados e corrigidos no caminho:** F36 (execução parada no meio ficava parada para sempre: o "varredor" citado no
  código não existia; agora a reserva é renovada a cada 2 s e a tela retoma a execução parada), F37 (Cancelar deixava a
  fase ir até o fim; agora a IA para na hora), F38 ("Concluído em" mostrava só a última fase; a primeira correção
  misturava o relógio do banco com o do computador, 5 s adiantado) e F39 (segurança: o endereço da chamada interna,
  que leva um segredo, vinha do cabeçalho do pedido, que quem pede pode inventar; agora vem só da configuração).
- **Saiu "Minhas chaves"** (decisão 3 de 24/10): a página `/chaves`, a conferência de chave, o "Ver modelos
  disponíveis", as chaves guardadas no navegador e a criptografia delas. Saiu também o envio em linhas (`ndjson.ts`),
  que ninguém usava desde o PR #19. As receitas rodam só com a IA simulada até a cobrança (3b).
- **Sem configuração nova:** a chamada interna que leva a execução adiante usa um segredo tirado da
  `SUPABASE_SECRET_KEY`; as variáveis `INTERNAL_RUN_SECRET` e `RUN_KEY_SECRET` saíram do `.env.example`.
- **Cada etapa concluída** vira uma linha em `ai_calls` (modelo, tokens, tempo). Custo e tentativas que falharam entram
  na 3b (F26).
- **Como foi conferido:** lint, tipos, 254 testes (saíram os das peças apagadas; novos: rotas com login, fila da narração, retomada, segredo interno,
  conferência da aba, busca de novidades) e build. **Teste de ponta a ponta** contra o projeto de testes, com um
  roteiro no Chrome (duas empresas de mentira; funcionários Ana e Bruno): 37 conferências, todas certas — o texto
  aparece com o cartão ainda trabalhando, o site fica pronto em ~27 s com "Concluído em 27 s", 6 linhas em `ai_calls`,
  53 eventos na narração; o colega, o dono da empresa e o dono de outra empresa não veem a execução da Ana; sem login,
  401; cancelar para o time de verdade; com o Bruno entrando noutra aba, a aba da Ana avisa, não cancela nem começa
  nada, e a execução dela termina no servidor; uma execução deixada parada na fila foi retomada; desativada não começa;
  sair da receita no meio e voltar retoma o acompanhamento; nenhum erro no navegador. Telas no computador e em 320 px.
- **Guia do teste:** `docs/GUIA-TESTE-RECEITAS.md`, para o Luis seguir com o chat do Claude.

**3a testada pelo Luis e no ar (25/10, com o chat do Claude e o guia)**
- Todas as partes do `GUIA-TESTE-RECEITAS.md` deram o resultado esperado: a Carla viu "Em obras" com o link da receita;
  o texto do Chefe apareceu aos poucos e as fases seguiram até o site da "Doce Encanto" (F5 mostrou de novo); Cancelar
  parou tudo; sair e voltar retomou a mesma execução; com o login trocado, o aviso vermelho apareceu e Cancelar não
  cancelou; `/chaves` não existe mais. **Merge do PR #35 feito.**
- **Pendência do convite resolvida:** a tabela `member_invites` apareceu no projeto de verdade do Supabase (multi-ia).

**PR 3b da etapa 5 — receitas cobrando (25/10, Claude Code; issue #37)**
- **Decisões do Luis (25/10, na aprovação da issue):** (1) a estimativa mostra o **máximo** que o time pode gastar ("até
  R$ X"), como a pré-autorização do cartão num hotel; a estimativa pelo histórico vem depois das IAs de verdade; (2)
  cancelar no meio de uma etapa não cobra aquela etapa; (3) sem margem por uso por enquanto (F04); (4) sai o "+
  Adicionar agente" (F41).
- **O que a pessoa vê:** embaixo do Começar, "Custo estimado: até R$ 5,31" com o time recomendado (muda ao trocar uma
  IA: com o Gemini no Front-end, R$ 3,54). Sem saldo, ou passando do teto do mês, não começa e diz o que fazer (pedir ao
  dono; o dono, falar com a nossa equipe). Enquanto o time trabalha, "Gasto até agora"; no fim, "Custou R$ Y" (com a IA
  simulada, uns R$ 0,37). Se o custo for passar do que foi reservado, o time **pausa** antes da fase seguinte e pergunta:
  **Continuar** (reserva o máximo do que falta, conferindo saldo e teto de novo) ou **Parar aqui**. Voltando a uma
  execução (recarregou, ou voltou a uma pausa mais tarde), o pedido aparece de novo (antes ficava em branco).
- **Como funciona por dentro:** o servidor calcula a estimativa de novo (`lib/runs/estimate.ts`: o maior texto que cada
  etapa pode receber e o maior que cada IA pode escrever, contando o pensamento, pelo mesmo teto que os conectores reais
  usam, `lib/providers/limits.ts`) e reserva antes de criar a execução, já com o id dela na reserva (sem coluna nova).
  Cada etapa concluída vira uma linha de gasto ("Criar um site · Front-end", com a IA), pelo consumo real e no mínimo 1
  centavo; no fim, a reserva fecha e a sobra volta. A fase é gravada antes de cobrar, e a chamada seguinte cobra o que
  ficou sem cobrar: nenhuma etapa é cobrada duas vezes. Antes de cada fase, o servidor confere se a reserva cobre o
  máximo do que falta, com o time de agora (uma IA reserva mais cara pode ter assumido); sem reserva, nenhuma IA roda.
- **Custo interno (F26):** toda chamada às IAs vai para `ai_calls`, com o custo em dólar, o câmbio, o nível do modelo e
  se foi cobrada: as que deram certo, as tentativas que falharam, a etapa interrompida pelo cancelamento e a etapa irmã
  que parou porque outra da fase em paralelo falhou. **Achado e corrigido no caminho:** essa última nem recebia a ordem
  de parar (a conexão com a IA ficaria aberta); o teste novo pegou.
- **Interruptor de teste novo:** `MOCK_AI_OVERSPEND=claude` no `.env.local` faz o Claude simulado "gastar" 10 vezes o
  limite da etapa: com o time recomendado, a pausa vem logo depois do plano do Chefe, pedindo R$ 4,52; continuando, o
  time termina sem pausar de novo (uns R$ 3,53 no total).
- **Sem migração e sem biblioteca nova:** as tabelas e funções da carteira já existiam (PR #24).
- **Como foi conferido:** lint, tipos, 314 testes (60 novos: estimativa, carteira, cobrança, rota de continuar, pausa,
  motor avisando cada chamada, IA simulada gastando demais) e build; o código que vai para o navegador não leva as
  instruções das IAs. **Teste de ponta a ponta** contra o projeto de testes, com um roteiro no Chrome: 26 conferências,
  todas certas. Como o projeto de testes não tem crédito (recarga só pelo editor de SQL, F25), a execução de verdade foi
  até a recusa por falta de saldo (funcionária e dono, sem execução nem reserva sobrando); as funções da carteira foram
  chamadas como o servidor chama (reservar, cobrar, achar a reserva, contar as linhas, fechar, cobrar numa reserva
  fechada); e a pausa e o "Custou" foram conferidos com execuções montadas no banco: "Continuar" sem saldo avisou e
  manteve a pausa, e "Parar aqui" encerrou. Telas no computador e em 375 px. Ficou para o teste do Luis a execução
  inteira com crédito (Partes C a F do guia).
- **Falhas:** novas F40 (conectores reais medem o consumo pelo tamanho do texto, sem o pensamento; Alta, para o PR das
  IAs de verdade), F41 (resolvida: "+ Adicionar agente"), F42 (sem a chave, cai na IA simulada sem avisar) e F43 (quedas
  raras do servidor na hora de cobrar; aceita). Andamento em F04, F08, F16, F17, F24, F26 e F29.
- **Guia do teste:** `docs/GUIA-TESTE-COBRANCA.md`, para o Luis seguir com o chat do Claude.

**3b testada pelo Luis e no ar (25/10, com o chat do Claude e o guia)**
- Todas as partes do `GUIA-TESTE-COBRANCA.md` deram o resultado esperado:
  - **Estimativa (B):** "Custo estimado: até R$ 5,31"; R$ 3,54 com o Front-end no Gemini e de volta a R$ 5,31 no GPT.
    Sem saldo, a recusa apareceu em vermelho.
  - **Recarga (C):** pelo editor de SQL do `multi-ia-teste`, devolveu 2000 (R$ 20,00).
  - **Execução inteira (D):** "Gasto até agora" subiu a cada fase e terminou em "Custou R$ 0,37"; 6 linhas de gasto no
    extrato, uma por etapa, negativas, com a IA e sem o pedido; a reserva ficou 531 / 37 / closed.
  - **Cancelar (E):** cancelado depois do Chefe, "Custou R$ 0,04" e a reserva fechada.
  - **Pausa (F):** com `MOCK_AI_OVERSPEND=claude`, pausou em R$ 1,00 pedindo para reservar até R$ 4,52; Continuar
    terminou em R$ 3,53; Parar aqui deu "Você cancelou" com R$ 1,00. A linha já saiu do `.env.local`.
  - **Teto (G):** com teto de R$ 1,00, a Carla recebeu a recusa do teto do mês; depois o teto voltou a ficar vazio.
- **Merge do PR #38 feito** (receitas cobrando na `main`).

**Issue da parte 3c — tarefa rápida (25/10, Claude Code; issue #39)**
- **Ordem (Luis, 25/10):** a 3c vem antes do PR das IAs de verdade. Assim aquele PR liga de uma vez as IAs das receitas
  e as do chat.
- **O que a issue propõe:** `/trabalho` volta com o chat do parceiro (conversas, anexos, arquivos gerados, aba
  Entregas e aba Meus gastos), no banco novo, em nome de quem está logado e cobrando pela carteira da empresa: o servidor
  confere saldo e teto antes de chamar qualquer IA, reserva o máximo da resposta depois que o Chefe decide e cobra o real
  numa linha por mensagem ("Tarefa rápida · Documento", com a IA). Todas as rotas `/api/ock/*` com login (F13, F16).
  Sem migração e sem biblioteca nova.
- **Quatro decisões esperando o Luis**, com a recomendação do Claude: (1) no chat, o custo aparece depois de cada
  resposta ("Custou R$ X"), sem estimativa nem OK antes; (2) imagem, pesquisa na internet, rodar código e voz ficam para
  o PR das IAs de verdade (a IA simulada não sabe fazer nenhuma); (3) mensagem de até 4.000 caracteres, com contador;
  (4) gastos do funcionário em reais, não em tokens.
- **Falhas novas, achadas ao estudar o chat:** F44 (o texto dos anexos vai inteiro para a IA, sem limite, e um tipo que a
  IA não lê é aceito sem aviso) e F45 (sem a pesquisa ou o código de verdade, a instrução manda a IA esconder isso).

**PR 3c — tarefa rápida (25/10, Claude Code; issue #39, PR #40, já na `main`)**
- Decisões do Luis (25/10): aceitas as 4 recomendações da issue (custo depois de cada resposta; imagem, pesquisa, código e
  voz só com as IAs de verdade; mensagem de até 4.000 caracteres; gastos em reais).
- Feito: `/trabalho` com o chat no banco novo (`lib/ock/run-task.ts`, `quick-task.ts`, `components/QuickChat.tsx`),
  rotas `/api/ock/*` com login, duas reservas por mensagem e uma linha de gasto, anexos com limite (F44), aviso na
  pesquisa e no código (F45), abas Entregas e Meus gastos. Saíram `lib/ock/company.ts`, imagem/código/pesquisa/voz.
- Conferido: lint, tipos, 382 testes e build verdes; ponta a ponta no projeto de testes 62/62 (sem crédito na empresa de
  teste do Claude: a resposta cobrada de verdade não passou pela tela) e 16/16 chamadas do banco conferidas por roteiro.
- Documentos atualizados (AGENTS, DOCUMENTO, BANCO, FALHAS: F13, F16, F23 a F26, F44, F45 resolvidas) e
  `docs/GUIA-TESTE-CHAT.md` escrito (valores conferidos pelo código).
- **PR #40 aberto e mergeado pela conta do Luis às 19:38 de 25/10**, oito segundos depois de aberto, sem descrição e
  antes do teste pelo guia (o Claude tinha parado no limite de uso antes de abrir o PR). As checagens do GitHub passaram
  na `main`, e a issue #39 fechou. A descrição foi escrita depois, para o histórico. Falha de processo anotada (F46).

**3c testada pelo Luis (25/10, com o chat do Claude e o guia, na `main`)**
- Partes A a H e J do `GUIA-TESTE-CHAT.md` deram o resultado esperado:
  - **Entrada (A):** "Gasto do mês" com R$ 4,94 e as abas Chat, Entregas e Meus gastos.
  - **Mensagem (B):** "Me dê 3 ideias": o Chefe escolheu o Claude (econômico, esforço baixo), "Tarefa simples", e a
    resposta mostrou "Custou R$ 0,01"; o gasto foi para R$ 4,95.
  - **Banco (C):** uma linha "Tarefa rápida · Resposta" de -1 com o `task_id`; duas reservas `closed` com o mesmo
    `task_id`; em `ai_calls`, answer/claude/economico e chief/gpt/economico, as duas ok e cobradas.
  - **Arquivos, anexos, imagem, pesquisa, conversas e gastos (D a H):** PDF, gráfico, Excel e .zip baixaram e apareceram
    em Entregas; o anexo .txt foi junto e o .docx foi recusado; a imagem respondeu "Sem custo"; a pesquisa veio do Gemini
    com o aviso amarelo; as conversas voltaram depois do F5; Meus gastos bateu com o alto da página.
  - **Privacidade (J):** o dono, em `/trabalho`, não vê nenhuma conversa da funcionária.
  - **Teto (I):** pulada. O chat confere o teto pela mesma função do banco já testada nas receitas (3b, Parte G); entra
    no teste da 3d.
- Falhas: F22 (o OCK nunca rodou no computador do Luis) e F46 (o PR #40 entrou antes do teste) resolvidas.

**Pedidos do Luis depois do teste (25/10) e as duas issues aprovadas**
- **Issue #42 — telas (PR pequeno):** aba **Receitas** no `/trabalho` (Chat · Receitas · Entregas · Meus gastos), com
  as receitas em cartões; a receita abre ali mesmo, sem sair da área de trabalho; o chat vazio sugere as receitas
  prontas; o endereço antigo `/recipes/create-site` leva para a aba; e, para o dono, atalhos "Painel do dono" e
  "Trabalho" no topo do site (no `/dono` não havia caminho para o `/trabalho`). As outras 3 receitas do MVP aparecem
  apagadas, com "Em breve". Traz para agora parte da etapa 6 (F08).
- **Issue #43 — parte 3d (painel do dono):** o crédito da empresa (disponível, saldo, reservado, gasto do mês por IA,
  aviso sem crédito), o gasto do mês de cada pessoa com o teto, "Ver o que fez" (as linhas do mês, sem pedido nem
  resposta) e as entregas, o extrato do mês com as recargas, e uma frase para o funcionário dizendo o que o dono vê
  (F05). Decisões aceitas: as somas passam a ser feitas no banco (migração, F48), uma receita vira uma linha só (no
  painel e em Meus gastos), o site da receita vira entrega (F47) e só o mês atual por enquanto.
- **Ordem nova (Luis, 25/10):** PR de telas → 3d → IAs de verdade. A 3d não depende das IAs de verdade, e assim o
  produto inteiro fica visível com a IA simulada antes de comprar créditos.
- **Falhas novas, achadas ao planejar a 3d:** F47 (o site feito pela receita não vira entrega; Média) e F48 (o "Gasto do
  mês" soma as linhas no nosso servidor e fica menor que o real depois de 1.000 gastos no mês, o limite de linhas do
  banco; o teto em si está certo; Baixa). As duas entram na 3d.

**PR de telas — aba Receitas e atalhos do dono (25/10, Claude Code; issue #42, branch `feat/aba-receitas`)**
- **O que a pessoa vê:** no `/trabalho`, as abas Chat · Receitas · Entregas · Meus gastos. A aba Receitas mostra
  "Receitas prontas" em cartões ("Criar um site" e as outras 3 do MVP apagadas, "Em breve"); "Usar receita" abre a
  receita ali mesmo, com "← Todas as receitas" no alto, igual a antes (time, "até R$ X", começar, ao vivo, site pronto).
  O chat vazio mostra "Ou use uma receita pronta:" com a receita pronta. A aba e a receita aberta ficam no endereço
  (`/trabalho?aba=receitas&receita=create-site`, mais o `?run=` da execução): recarregar volta para o mesmo lugar, e
  trocar de aba no meio não para o acompanhamento. O endereço antigo `/recipes/create-site` leva para a aba. Para o
  dono, atalhos "Painel do dono" e "Trabalho" no topo do site (no celular, numa linha embaixo do logo); saíram os dois
  links soltos do canto do `/trabalho`.
- **Por dentro:** `components/WorkspaceRecipes.tsx` (cartões e receita aberta), `components/workspace-view.ts` (a aba e
  a receita no endereço), `components/OwnerNav.tsx` (atalhos do dono) e `lib/recipes/screen.ts` (o que a tela da
  receita recebe, sem as instruções das IAs; antes isso ficava na página da receita). O cartão (`RecipeCard`, sem uso
  desde que a receita saiu da página inicial) voltou. Os títulos da receita desceram um nível (a página já tem o "Olá"). Se a receita termina com a
  pessoa em outra aba, a página não pula para o alto. O "Gasto do mês" no alto acompanha o que a receita cobra, sem
  recarregar (antes a receita ficava noutra página, e voltar recarregava o número). Sem migração e sem biblioteca nova.
- **Achados e corrigidos no teste:** com uma receita aberta, voltar ao Chat e recarregar abria a aba Receitas (o Chat
  não ia para o endereço); no celular, o começo do chat vazio sumia (a lista rolava para o fim mesmo sem mensagens) e as
  4 abas quebravam em duas linhas em 360 px.
- **Como foi conferido:** lint, tipos, 396 testes (14 novos: aba e receita no endereço; o que a tela da receita recebe
  não leva as instruções das IAs) e build; o código que vai para o navegador não tem as instruções. **Teste de ponta a
  ponta** contra o projeto de testes, com um roteiro no Chrome (empresa nova "Loja das Abas", dona e funcionária): 55
  conferências, todas certas — sugestão no chat vazio abre a receita, cartões, foco, teclado nas abas, estimativa e
  recusa por falta de crédito dentro da aba, execução pausada e site pronto (montados no banco) acompanhados na aba,
  trocar de aba e recarregar, endereço antigo, o gasto do mês subindo com uma cobrança da receita, atalhos do dono nas duas direções, telas em 320 e 360 px. Os únicos
  avisos do navegador foram o `favicon.ico` que o site ainda não tem e a recusa por falta de crédito, de propósito.
  Ficou para o teste do Luis rodar a receita inteira com crédito, dentro da aba.

**PR de telas testado pelo Luis e no ar (25/10)**
- Tudo deu o resultado esperado: como Carla, as abas Chat · Receitas · Entregas · Meus gastos; os cartões ("Criar um site"
  e 3 "Em breve"); "Usar receita" abre ali mesmo, com "← Todas as receitas"; a receita inteira rodou com crédito dentro da
  aba e o site ficou pronto; o "Gasto do mês" subiu sem recarregar; trocar para o Chat no meio e voltar continuou o
  acompanhamento; o F5 voltou para o mesmo lugar; a sugestão do chat vazio abre a receita; `/recipes/create-site` leva
  para a aba. Como dono, os atalhos "Painel do dono" e "Trabalho" funcionam nas duas direções, e o `/trabalho` do dono não
  mostra conversas da Carla; para a Carla, os atalhos não aparecem. O site pronto não foi para Entregas (F47, entra na 3d).
- **Merge do PR #44 feito.** O Luis pediu para seguir com a 3d, dizendo que o mais importante para ele é ver logo no
  painel o crédito da empresa e quanto cada funcionário gastou no mês.

**PR 3d — painel do dono (25/10, Claude Code; issue #43, PR #45, branch `feat/painel-do-dono`)**
- **O que o dono vê no `/dono`:** no alto, o **crédito da empresa** ("Disponível para a equipe" grande; "Saldo R$ Y", e
  "· R$ Z separado agora para tarefas em andamento" quando há reserva aberta; "Gasto da empresa neste mês" com uma barra
  dividida por IA e cada IA com o nome e o valor; "Para colocar crédito, fale com a nossa equipe"; sem crédito, aviso
  vermelho e o disponível em R$ 0,00, com o saldo negativo mostrado com o sinal, F29). Na **Equipe**, cada pessoa com
  "Gasto do mês: R$ X de R$ Y" e a barra (amarela a partir de 80% do teto, vermelha no teto), ou "· sem teto"; o que está
  separado para ela agora, quando há; "Neste mês: 8 tarefas rápidas, 1 receita, 3 entregas"; e **"Ver o que fez"**, que
  busca no servidor as linhas do mês (dia e hora, o que foi, as IAs, o valor) e as entregas do mês, com "Baixar". Saiu a
  etiqueta "Teto de R$ … por mês" (o teto já aparece no gasto). Depois, "Convidar um funcionário" e o **Extrato do mês**
  (recargas em verde com "+", gastos com "−" e o nome de quem gastou). Saiu o "Em obras".
- **Para o funcionário:** Meus gastos com cada receita numa linha só e a barra do teto nova; nas abas Entregas e Meus
  gastos, "O dono da empresa vê suas entregas e quanto cada tarefa custou. Suas conversas, não." (para o dono, não
  aparece). As IAs aparecem sempre na ordem Claude, GPT, Gemini.
- **O site vira entrega (F47):** quando a receita termina, o servidor guarda o `.html` como entrega de quem pediu, antes
  de marcar a execução como terminada, sem guardar duas vezes se o servidor retomar. O Supabase entrega todo `.html` da
  pasta como texto puro, com "nosniff" e como anexo: o navegador só salva. O nome do arquivo do site passou de
  `components/generated-site.ts` para `lib/ock/site-file.ts` (o servidor também usa).
- **Por dentro:** migração `20261025200001_month_summaries.sql` com quatro contas feitas no banco (crédito da empresa,
  gasto do mês por IA, mês de cada pessoa e extrato do mês com a receita numa linha), que rodam com o login de quem chama
  (as regras de acesso valem dentro delas); resolve a F48. Rota nova `GET /api/ock/team/[id]` (só o dono). Componentes
  novos: `CompanyCredit`, `MemberMonth`, `StatementList` e `BudgetBar`. Sem biblioteca nova.
- **Falha nova achada no teste e corrigida (F49):** o nome e o título dos documentos do chat (PDF, Word, Excel) eram os
  primeiros 60 caracteres do pedido; com o painel, o dono leria o começo do pedido nas entregas. Agora vêm da primeira
  linha do que a IA escreveu ("Resumo.pdf"); a planilha se chama "Planilha". Os documentos antigos ficam com o nome antigo.
- **Decisões do Claude:** "Ver o que fez" busca a lista só quando o dono abre (o painel não fica pesado com equipes
  grandes); as listas mostram as 200 linhas mais recentes e avisam quando há mais; a barra por IA segue a paleta das IAs,
  conferida com o validador de cores (passa, com o nome e o valor escritos ao lado de cada cor).
- **Como foi conferido:** lint, tipos, 418 testes (novos: contas do mês e extrato, rota do "Ver o que fez", site virando
  entrega, nome dos documentos) e build. Testes do banco: 26 novos (`05_month_summaries`) e a checagem de estrutura
  atualizada, 137 no ensaio local e verdes no GitHub; cada conta foi estragada de propósito numa cópia (sem a conferência
  do dono, sem o login de quem chama, contando reserva vencida, sem juntar a receita) e o teste pegou. **Teste de ponta a
  ponta** contra o projeto de testes, com um roteiro no Chrome (empresa nova sem crédito; Carla e Bruno; outra empresa):
  67 conferências, todas certas — o site guardado como entrega uma vez só e baixado como anexo; saldo, reservado e gasto
  batendo com o extrato; a soma por IA e por pessoa batendo com o total; o funcionário sem o saldo da empresa e sem o
  colega; o dono de outra empresa sem nada; o dono nunca recebendo o pedido; o painel inteiro, "Ver o que fez", o extrato
  e o aviso sem crédito na tela; Meus gastos e Entregas da Carla com a frase; telas em 360 e 320 px sem rolar para o lado.
  Ficou para o teste do Luis (com crédito): a receita nova virando entrega pela tela, o PDF do chat com o nome novo, o
  teto recusando o chat (Parte I do guia do chat) e a recarga aparecendo no extrato.
- **Guia do teste:** `docs/GUIA-TESTE-PAINEL.md`, para o Luis seguir com o chat do Claude. A migração já foi para o
  projeto de testes (workflow "Banco de testes" rodado no branch do PR).

**3d testada pelo Luis e no ar (25/10, com o chat do Claude e o guia)**
- Todas as partes do `GUIA-TESTE-PAINEL.md` deram o resultado esperado:
  - **Crédito (B):** "Disponível para a equipe" R$ 14,61, Saldo R$ 14,61, "Gasto da empresa neste mês" R$ 5,39 (Claude
    R$ 4,69, GPT R$ 0,66, Gemini R$ 0,04), sem o aviso de sem crédito.
  - **Banco (C):** saldo 1461, reservado 0 e gasto do mês 539.
  - **Equipe (D):** Carla com "R$ 5,39 · sem teto" e "7 tarefas rápidas, 5 receitas, 4 entregas"; "Ver o que fez" com
    cada receita numa linha só, as mensagens como "Tarefa rápida · …", as entregas com Baixar e nenhum pedido. O SQL por
    pessoa bateu (Carla 539, os outros 0).
  - **Funcionário (E):** a frase do que o dono vê em Meus gastos e em Entregas; o site da receita nova virou entrega
    (.html, baixa como arquivo), custou uns R$ 0,37 numa linha só, e no painel o gasto da Carla, o resumo, "Ver o que
    fez" e o Extrato do mês atualizaram.
  - **Nome do PDF (F):** saiu como `Resumo.pdf`, também no painel (F49).
  - **Teto (G):** com teto de R$ 1,00, a barra vermelha cheia e o "Oi" recusado no chat (era a Parte I do guia do
    chat, que tinha ficado para cá); depois, sem teto de novo.
  - **Recarga (H):** R$ 5,00 subiram o Disponível e o Saldo e apareceram no extrato como "+ R$ 5,00", em verde.
  - **Privacidade (I):** a Carla não abre o `/dono`; o Meus gastos do dono não tem a frase e não mostra conversas da Carla.
  - **Celular (J):** em 360 px tudo coube e "Ver o que fez" funcionou. No Opera GX, o F12 e o Ctrl + Shift + I não
    abriram as ferramentas; pelo botão direito → Inspecionar, sim. O guia passou a dizer isso.
- **Merge do PR #45:** feito pelo **próprio Luis** às 23:39 de 25/10, depois de terminar o teste completo do
  `GUIA-TESTE-PAINEL.md` com o chat do Claude (confirmado por ele em 26/10; não foi o parceiro). Com o merge, o Supabase
  aplicou a migração nova no projeto de verdade sozinho.
- **Conferido no Supabase de verdade pelo Luis (26/10, projeto `multi-ia`):** em **Database** → **Migrations**, a última
  é `20261025200001` (`month_summaries`); em **Database** → **Functions** aparecem `company_credit`,
  `company_month_by_provider`, `member_month_summary` e `month_statement`.

**PR das IAs de verdade, parte que não depende de chave nem de crédito (madrugada de 26/10, Claude Code sozinho; branch
`feat/ias-reais`, empilhado sobre o PR #46)**
- **Pedido do Luis (25/10, à noite):** trabalhar sozinho de madrugada, sem merge, sem o Supabase de verdade, sem chaves
  nem créditos, com a IA simulada; decisões pela opção mais segura e fácil de desfazer, anotadas aqui para ele confirmar.
- **Interruptor `OCK_AI_MODE` (F42):** `simulada` ou `real`. Com `real`, a IA sem chave falha (nas receitas, a IA
  reserva assume; no chat, a mensagem avisa) e nada é cobrado; o servidor registra qual variável falta. Vazio: simulada
  no computador (`npm run dev` e testes), real no site publicado. As receitas e o chat passam a usar o mesmo entregador
  de IAs (`lib/providers/registry.ts`); antes, os dois usavam sempre a simulada.
- **Consumo de verdade (F40):** cada conector lê o consumo que a empresa da IA informa no fim da resposta, com o
  pensamento e o cache; uma tentativa que cai no meio leva o consumo até ali para `ai_calls`.
- **Modelos e preços oficiais (F17), num lugar só (`lib/providers/models.ts`):** Claude Haiku/Sonnet/Opus 5.5 (US$ 0,10
  / 2 / 4 por milhão de entrada e 0,50 / 10 / 20 de saída); GPT-6 Luna / 6.1 Sol / 6 Astra (0,10 / 2 / 10 e 0,50 / 10 /
  50); Gemini 3.5 Flash-Lite / 3.8 Flash / 4 Argon (0,30 / 0,75 / 2 e 2,50 / 3,75 / 10; o 4 Argon dobra em 01/12/2026 e o
  3.8 Flash em 01/01/2027, e a conta troca sozinha). O cache tem preço próprio.
- **Pedidos que as APIs de hoje recusariam (F50, nova, resolvida):** o GPT recusa o esforço "minimal" (o Chefe do chat
  falharia em toda mensagem); sem o esforço explícito, o Sonnet 5.5 pensa no nível alto; o Gemini novo usa níveis de
  pensamento, não orçamento; e o Gemini usava apelidos que trocam de modelo. **Resposta cortada ou recusada aceita como
  completa (F51, nova, resolvida).**
- **Estimativa:** folga para o pensamento em todo esforço (2 mil, 8 mil e 16 mil tokens), a entrada contada a 3
  caracteres por token (antes, 4) e as imagens a 5.000 tokens. Com os preços novos, "Criar um site" fica em **até
  R$ 6,09** (antes R$ 5,31; R$ 4,30 com o Gemini no Front-end), e a receita simulada custa uns R$ 0,32.
- **Guia novo:** `docs/GUIA-TESTE-IAS-REAIS.md`, em duas sessões: sem gastar (simulada com os preços novos; IAs de
  verdade sem chave, falhando sem cobrar) e com dinheiro (comprar US$ 5 na Anthropic e na OpenAI com a recarga
  automática desligada, a chave do Gemini no plano grátis, o primeiro teste e a conferência com o painel das empresas).
- **Como foi conferido:** lint, tipos, 455 testes (novos: modelos e preços, interruptor, entregador das IAs, os três
  conectores com respostas gravadas no formato oficial de cada empresa, falha sem chave no chat e na receita) e build;
  nada de servidor no código do navegador. **Ponta a ponta** contra o projeto de testes, com o Chrome por roteiro e o
  site rodando nos dois modos (simulada e real sem chave): 22 conferências certas (estimativas novas, recusa sem saldo
  antes de qualquer IA, nada em `ai_calls`, `runs` ou no extrato). Não deu para testar pela tela a resposta cobrada:
  as empresas de teste do Claude não têm crédito (Partes B e C do guia).
- **Falhas:** F40 e F42 resolvidas; andamento na F17 (falta o câmbio); novas F50 e F51 (resolvidas) e F52 (o código
  fala com as IAs sem as bibliotecas oficiais, ao contrário do AGENTS.md; Luis decidir).
- **Decisões provisórias do Claude (Luis confirmar):** (1) `OCK_AI_MODE` vazio continua simulado no computador; (2)
  modelos de cada nível acima; (3) folga de pensamento de 2/8/16 mil tokens e 3 caracteres por token na estimativa (rever
  com as primeiras medições); (4) não ligar o "fallback" da Anthropic (outro modelo dela assumir quando o Claude recusa):
  a nossa troca de IA já cuida disso e o preço fica exato; (5) manter as chamadas diretas às APIs, sem as bibliotecas
  oficiais (F52). **Para o Luis decidir:** o câmbio continua R$ 5,50, mas cada dólar pago com cartão sai por uns R$ 5,6
  a 5,7 (IOF de 3,5% e a margem do banco); com margem zero, a plataforma pagaria a diferença.

**PR da pesquisa na internet e do código (madrugada de 26/10, Claude Code sozinho; branch `feat/pesquisa-e-codigo`,
empilhado sobre o PR das IAs de verdade)**
- **O que ficou pronto, desligado:** no chat, a **pesquisa na internet** e as **contas com um programa**, cada uma ligada
  pelo interruptor novo `OCK_AI_TOOLS` ("pesquisa", "codigo"; vazio: nenhuma, o padrão). Com a IA simulada, as
  ferramentas ligadas são fingidas (uma fonte de exemplo), para testar a tela sem gastar.
- **Quem faz o quê (decisão provisória do Claude, Luis confirmar):** a pesquisa é a do **Claude** (Sonnet 5.5, até 3
  pesquisas por mensagem, resultados do Brasil, US$ 0,01 por pesquisa além dos tokens). A do Gemini foi descartada pelos
  termos do Google: o resultado só pode aparecer junto com um bloco de sugestões do Google, só para quem pediu e sem
  misturar com outro conteúdo, o que não combina com PDFs e receitas feitos a partir da pesquisa. O **código** é do
  **Gemini** (3.8 Flash, sem custo além dos tokens). O Chefe continua escolhendo a ação; com a ferramenta ligada, a
  plataforma passa a pesquisa para o Claude e a conta para o Gemini, e o motivo na tela explica.
- **Na resposta:** a pesquisa termina com "Fontes consultadas:" (até 8, sem repetir, só endereços da web); a conta, com
  "A IA rodou um programa para fazer esta conta." Ficam escritos na resposta, sem migração, e o aviso amarelo só aparece
  quando não houve pesquisa ou programa, com o texto novo: "Esta resposta não veio de uma pesquisa na internet…" (F45).
  Limitação aceita: F53 (nova).
- **Dinheiro:** a reserva da pesquisa cobre as 3 pesquisas e uma folga de 40 mil tokens de entrada por pesquisa (o que
  as páginas trazem); a do código, 20 mil. A cobrança é o que a Anthropic e o Google informam.
- **Como foi conferido:** lint, tipos, 476 testes (novos: o pedido de cada ferramenta, fontes e pesquisas no consumo,
  programa rodado, simulada fingindo, plano e reserva do chat, as fontes no fim da resposta e no histórico, o
  interruptor) e build. Ponta a ponta contra o projeto de testes: a fumaça com as ferramentas ligadas (11 conferências) e,
  com três mensagens gravadas no banco, a conversa aberta pela tela (5: fontes uma por linha, aviso só onde não houve
  pesquisa, frase do programa, nada rolando para o lado em 360 px).
- **Guia:** `docs/GUIA-TESTE-IAS-REAIS.md` ganhou a Parte D (ferramentas fingidas, sessão 1) e a Parte G (de verdade,
  sessão 2).

**PR da imagem (madrugada de 26/10, Claude Code sozinho; branch `feat/imagem`, empilhado sobre o PR da pesquisa e do
código)**
- **O que ficou pronto, desligado:** com `imagem` em `OCK_AI_TOOLS`, o pedido de imagem do chat é criado pelo **GPT
  Image 2** (OpenAI): uma imagem quadrada (1024 × 1024), de qualidade média, em JPEG, uns **US$ 0,053 (uns R$ 0,29)**,
  conferido na tabela oficial. A imagem vira entrega da pessoa (`imagem.jpg`), aparece na conversa (dentro de uma
  imagem, sem rodar nada na nossa página) e na aba Entregas. Desligada, continua "Isso chega em breve".
- **Dinheiro:** a reserva é o máximo de uma imagem (o pedido e uns 25% de folga sobre a saída típica, uns R$ 0,36 com o
  Chefe); a cobrança é o consumo que a OpenAI informa, com o preço próprio da imagem (texto US$ 5, imagem de referência
  US$ 8 e imagem criada US$ 30 por milhão de tokens). Pedido barrado pelas regras de conteúdo da OpenAI
  ("moderation_blocked") não tem nova tentativa nem cobrança, e a resposta sugere mudar o pedido.
- **Simulada:** um quadriculado azul de 64 × 64 no lugar da imagem, "custando" o mesmo que uma de verdade.
- **Decisão provisória do Claude (Luis confirmar):** qualidade média e formato quadrado (a alta custa uns R$ 1,16 por
  imagem); a imagem nasce só do pedido (não lê a conversa nem os anexos; editar uma foto anexada fica para depois).
- **Como foi conferido:** lint, tipos, 491 testes (novos: o pedido ao GPT Image, o consumo e o preço, o pedido barrado,
  a imagem simulada, o entregador sem chave, a reserva e o chat do começo ao fim, com e sem falha) e build. Ponta a
  ponta contra o projeto de testes: fumaça com as três ferramentas ligadas (11 conferências) e uma mensagem com a imagem
  gravada no banco e na pasta, como o servidor grava, aberta pela tela (3: a imagem na conversa, "Baixar imagem.png" e a
  aba Entregas).
- **Guia:** Partes D e G do `docs/GUIA-TESTE-IAS-REAIS.md` ganharam a imagem.

**PR da voz (madrugada de 26/10, Claude Code sozinho; branch `feat/voz`, empilhado sobre o PR da imagem)**
- **O que ficou pronto, desligado:** com `voz` em `OCK_AI_TOOLS`, o chat ganha o botão **Ditar**: grava até 2 minutos
  no navegador (o relógio aparece no botão, que vira "Parar"), manda o áudio para a rota nova `/api/ock/transcribe` e o
  texto volta para a caixa de escrever, para a pessoa revisar e enviar. Nada é enviado sozinho; o Enviar fica desligado
  enquanto grava. O áudio não é guardado.
- **Quem transcreve:** o **gpt-transcribe** da OpenAI, em português, US$ 0,0045 por minuto (uns R$ 0,025). O
  gpt-4o-mini-transcribe, que o código antigo do parceiro usava (via whisper-1), está descontinuado.
- **Dinheiro:** reserva o máximo de 2 minutos (uns 5 centavos) antes de chamar a IA, cobra os segundos que a OpenAI
  informa (sem eles, o máximo) numa linha "Voz · Transcrição", que entra no gasto do mês mas não conta como tarefa
  rápida. Falha e áudio sem fala não são cobrados; o custo fica no registro interno (`ai_calls`, `step_id` = `voice`).
- **Rota com as mesmas proteções das outras:** login, a pessoa que abriu a página (F34), a voz ligada, até 4 MB, só
  áudio.
- **Simulada:** devolve "Texto ditado (transcrição simulada)." e "custa" 5 segundos.
- **Não mexe no PR #36 do parceiro** (o botão "Ouvir", que lê a resposta em voz alta): aquele PR mexe no
  `OckWorkspace.tsx` antigo, e o ditado fica no `QuickChat.tsx`. Os dois PRs vão brigar só no `PROGRESSO.md`.
- **Como foi conferido:** lint, tipos, 508 testes (novos: o conector, o preço, o ditado do começo ao fim com sucesso,
  falha, áudio vazio e sem saldo, o envio do navegador, o interruptor e o entregador sem chave) e build; nada de chave no
  código do navegador. Ponta a ponta contra o projeto de testes, com um microfone falso do Chrome e a empresa sem
  crédito: 11 conferências (o botão e a dica, o relógio, o Enviar desligado, a recusa por falta de saldo antes de
  qualquer IA sem perder o texto já escrito, nada em `ai_calls` nem reserva, 360 px sem rolar para o lado).
- **Guia:** Partes D e G do `docs/GUIA-TESTE-IAS-REAIS.md` ganharam a voz.

**PR da planilha sem o pacote xlsx (madrugada de 26/10, Claude Code sozinho; branch `fix/planilha-sem-xlsx`, empilhado
sobre o PR da voz)**
- **Por quê:** item do FALHAS que não depende de ninguém (F15): o pacote `xlsx` tem duas falhas de segurança graves
  conhecidas, sem correção no npm, e o chat o usava justamente para **ler** o CSV que a IA escreve.
- **O que mudou:** a planilha Excel é montada por nós (`lib/ock/spreadsheet.ts`): um leitor de CSV pequeno (aceita
  ponto e vírgula e vírgula decimal, comuns no Brasil) e o `.xlsx` montado com o `jszip`, que o projeto já usava. Os
  nomes das colunas saem em negrito; números viram números; o resto é texto (um valor com "=" nunca vira fórmula). O
  pacote saiu do `package.json`; sem biblioteca nova. `npm audit`: 0 vulnerabilidades.
- **Como foi conferido:** antes de remover, o próprio `xlsx` leu a planilha nova com os valores certos (texto com
  vírgula e aspas, número, "=SUM(A1)" como texto, ponto e vírgula com vírgula decimal). Lint, tipos, 517 testes (9
  novos) e build; fumaça de ponta a ponta (11 conferências). Abrir no Excel ficou para o Luis (Parte B, passo 4 do guia).

**PR do site sem as marcas de código (madrugada de 26/10, Claude Code sozinho; branch `fix/site-sem-crases`, empilhado
sobre o PR da planilha)**
- **Por quê:** anotação antiga da etapa 4 (T9) que fica importante com as IAs de verdade: elas às vezes cercam o site com
  as marcas de código do Markdown (```html … ```), às vezes com uma frase antes ("Aqui está o site:") ou depois. Na prévia,
  no arquivo baixado, na entrega e na etapa seguinte, isso quebraria o site.
- **O que mudou:** o motor arruma o texto final de toda etapa que escreve um site (`lib/engine/output.ts`): tira a cerca
  e as frases em volta; com mais de um bloco, fica o que tem cara de página. Sem cerca, o texto passa exatamente como
  veio. A narração ao vivo continua mostrando o que a IA escreveu. O texto comum (plano, revisão) não muda.
- **Como foi conferido:** lint, tipos, 524 testes (7 novos: a limpeza e uma receita inteira com as IAs cercando o site)
  e build; fumaça de ponta a ponta (11 conferências). Com a IA simulada nada muda (ela não cerca o site).

**Sessão 1 do guia das IAs de verdade testada pelo Luis, e a pilha no ar (26/10, manhã)**
- O Luis seguiu as Partes A a D do `docs/GUIA-TESTE-IAS-REAIS.md` (sem gastar) e tudo deu o resultado esperado:
  - **Preços novos com a simulada (B):** "Criar um site" com estimativa **"até R$ 6,09"** (R$ 4,30 com o Front-end no
    Gemini); a receita custou uns R$ 0,32 e o chat R$ 0,01. A `Planilha.xlsx` abriu no Excel **sem aviso**, com os
    títulos em negrito e os números somáveis (era o que faltava conferir da F15).
  - **IAs de verdade sem chave (C):** com `OCK_AI_MODE=real`, o chat mostrou "A IA não conseguiu responder agora. Nada
    foi cobrado.", o terminal apontou a falta da `OCK_CLAUDE_KEY`, a receita parou no Chefe com R$ 0,00, Meus gastos não
    mudou e o `ai_calls` registrou `error` com `charged` falso, sem nenhuma linha da simulada (F42 testada pela tela).
  - **Ferramentas fingidas (D):** com `OCK_AI_TOOLS` ligado, a pesquisa veio do Claude com as fontes, as contas do Gemini
    com a frase do programa, a imagem com o quadriculado e o `imagem.png` em Entregas, tudo continuou depois do F5, e o
    Ditar transcreveu de forma simulada, com "Voz · Transcrição" em Meus gastos. Desligando, voltaram os avisos e o
    Ditar sumiu.
  - No fim, o `.env.local` voltou sem `OCK_AI_MODE` e sem `OCK_AI_TOOLS` (simulada, ferramentas desligadas).
- **Merges:** o Luis fez o merge dos PRs **#46 a #52**, em ordem, com "Delete branch" em cada um, e atualizou a `main`.
  Nenhum deles mudou o banco, então o Supabase de verdade não muda.
- **Ficou para depois, por decisão do Luis:** as decisões provisórias da madrugada e o câmbio (ele vê depois) e a
  sessão 2 do guia, com créditos de verdade (quando ele decidir gastar).

## Resumo da madrugada de 26/10 (para o Luis ler primeiro)

O Claude trabalhou sozinho, sem merge, sem o Supabase de verdade, sem chaves e sem créditos. Tudo com a IA simulada.

**O que ficou pronto (PRs abertos, empilhados um sobre o outro):**

| PR | O que traz | Base |
|----|-----------|------|
| #46 | Só documentos: o teste do painel do dono (PR #45), o que conferir no Supabase de verdade e a Parte J do guia | `main` |
| #47 | IAs de verdade prontas, sem gastar: consumo informado pelas empresas (F40), `OCK_AI_MODE` (F42), modelos e preços oficiais (F17), correções F50 e F51, guia `docs/GUIA-TESTE-IAS-REAIS.md` com a compra dos créditos | #46 |
| #48 | Pesquisa na internet (Claude) e contas com um programa (Gemini) no chat, desligadas (`OCK_AI_TOOLS`) | #47 |
| #49 | Imagens no chat com o GPT Image 2 (uns R$ 0,29 cada), desligadas (`OCK_AI_TOOLS`) | #48 |
| #50 | Voz no chat: o botão Ditar, transcrito pelo gpt-transcribe (uns R$ 0,025 por minuto), desligado (`OCK_AI_TOOLS`) | #49 |
| #51 | Planilha Excel montada pela plataforma, sem o pacote `xlsx` (F15, falha de segurança) | #50 |
| #52 | O site das IAs de verdade sem as marcas de código (```html) em volta | #51 |

O PR #45 já estava na `main` quando a madrugada começou (merge do Luis às 23:39 de 25/10). Por isso a pilha parte da
`main`, não do branch do #45.

**Ordem de testar e fazer o merge** (passos 1 a 3 **feitos** pelo Luis em 26/10, de manhã; o 4 passou para o bloco 6 da nova ordem):
1. **Supabase de verdade:** conferir a migração do #45 (passos em "3d testada pelo Luis e no ar", acima).
2. **Testar a pilha de uma vez:** a sessão 1 do `docs/GUIA-TESTE-IAS-REAIS.md` (Partes A a D, uns 30 minutos, sem gastar)
   no branch do PR mais alto (a Parte A diz qual).
3. **Merge em ordem:** #46, #47, #48, #49, #50, #51 e #52. **Depois de cada merge, clique em "Delete branch"** no PR que entrou:
   só assim o GitHub troca a base do PR seguinte para a `main` (o repositório não apaga o branch sozinho). Antes de cada
   merge, confira que o alto do PR diz "into main" e que as checagens estão verdes. Se um PR falhar no teste, pare ali:
   os de baixo podem entrar, os de cima esperam a correção.
4. **Quando decidir gastar:** a sessão 2 do guia (Partes E a H): comprar US$ 5 na Anthropic e na OpenAI com a recarga
   automática desligada, criar as chaves e o primeiro teste com IA de verdade.

**Decisões provisórias do Claude (confirmar ou mudar; o Luis vê depois):**
1. `OCK_AI_MODE` vazio continua simulado no computador (real no site publicado).
2. Modelos de cada nível: Claude Haiku/Sonnet/Opus 5.5; GPT-6 Luna / 6.1 Sol / 6 Astra; Gemini 3.5 Flash-Lite / 3.8 Flash /
   4 Argon.
3. Folga para o "pensamento" de 2/8/16 mil tokens, 3 caracteres por token e imagens a 5.000 tokens na estimativa (rever
   com as primeiras medições). Com isso, "Criar um site" fica em "até R$ 6,09".
4. Sem o "fallback" da Anthropic (a nossa troca de IA já cuida de recusas).
5. Chamadas diretas às APIs, sem as bibliotecas oficiais (F52: o AGENTS.md diz o contrário; recomendação do Claude:
   manter e corrigir o AGENTS.md).
6. Pesquisa na internet pelo Claude, não pelo Gemini (termos do Google); código pelo Gemini.
7. Fontes e "programa rodado" escritos no fim da resposta, sem coluna nova no banco (F53, limitação aceita).
8. Imagem de qualidade média e quadrada, criada só a partir do pedido.
9. Voz: até 2 minutos por ditado, e o texto volta para a caixa (nunca é enviado sozinho).

**Para você decidir:**
- **Câmbio:** continua R$ 5,50 (sua decisão de 25/10), mas cada dólar pago com cartão brasileiro sai por uns R$ 5,6 a
  5,7 (dólar comercial de R$ 5,22 em 28/09, mais IOF de 3,5% e a margem do banco). Com margem zero, a plataforma paga a
  diferença. Mudar é uma linha (`USD_TO_BRL` em `lib/ock/pricing.ts`).
- **F52:** manter as chamadas diretas ou trocar pelas bibliotecas oficiais.

**Falhas (`docs/FALHAS.md`):** resolvidas F15 (pacote `xlsx`), F40 (consumo de verdade) e F42 (chave faltando);
andamento na F17 (falta o câmbio) e na F45. Novas: F50 e F51 (achadas e resolvidas), F52 (decidir: bibliotecas oficiais),
F53 (aceita: o aviso de "não pesquisou" depende do fim da resposta) e **F54** (para a publicação: uma fase longa com IA
de verdade pode passar dos 5 minutos da função na Vercel; medir o tempo na Parte F do guia).

**Tudo o que foi pedido para a madrugada ficou pronto**, desligado até as chaves: consumo de verdade (F40), chave
faltando vira erro (F42), modelos e preços oficiais (F17), pesquisa, código, imagem e voz, e o guia com a compra dos
créditos.

## Nova ordem (decisão do Luis, 26/10)

As IAs de verdade ficam para o fim. Antes, todo o resto do site funcionando com a IA simulada, **um bloco de cada vez**:

| Bloco | O que entra |
|-------|-------------|
| 1 — O produto do funcionário (etapa 6) | As 3 receitas que faltam, escolhidas para PMEs (o Luis escolhe entre as propostas); a receita própria (o funcionário monta o time e salva só para ele ou para a empresa toda, na tabela `custom_recipes`); a escolha livre da IA, do nível e do esforço no chat, guardando o recomendado e o escolhido (F03) |
| 2 — Conta de verdade | E-mail próprio para o login (F30), com o serviço de envio proposto pelo Claude (custo e plano grátis) e guia para criar a conta; recuperar a senha do dono; páginas de termos de uso e de privacidade (LGPD, F05) com o aceite no cadastro, em rascunho marcado para revisão de um advogado antes da primeira empresa de verdade |
| 3 — Painel interno da plataforma | Área protegida só para a equipe da plataforma (o Luis e o parceiro): lista de empresas, recarga de crédito pela tela (no lugar do SQL), extrato de recargas e o custo real das IAs (`ai_calls`) contra o cobrado, por empresa e no total. O Claude propõe como marcar quem é da equipe sem abrir brecha |
| 4 — Pagamento, só preparar | Um documento curto comparando Asaas, Mercado Pago, Efí, Pagar.me e Stripe (taxas de Pix, boleto e cartão; CNPJ; nota fiscal; recarga avulsa e assinatura; aviso ao servidor), com as fontes oficiais. **Não programar** até o Luis e o parceiro decidirem o formato do preço (F04) e o CNPJ. Depois, o pagamento confirmado vira uma recarga automática, pela mesma função da recarga |
| 5 — Publicação (depois do pagamento) | Site na Vercel, com domínio, chaves de produção e a F54 resolvida, com guia passo a passo |
| 6 — IAs de verdade (por último) | A sessão 2 do `docs/GUIA-TESTE-IAS-REAIS.md`, a medição de custo e tempo e a revisão dos modelos com a pesquisa `docs/pesquisas/melhor-ia-por-funcao-2026-10-12.pdf` (feita no Cowork em 12/10): comparar com a decisão provisória 2 da madrugada e **mostrar as diferenças ao Luis antes de mudar** |

**Como trabalhar (pedido do Luis):**
- Para cada bloco, o Claude mostra a issue com a proposta e espera a aprovação antes de começar.
- Um PR pequeno por tarefa: testes, lint, tipos e build verdes, teste de ponta a ponta no projeto de testes e um guia de
  teste em `docs/`, no formato dos outros, para o Luis testar com o chat do Claude antes do merge.
- Tudo com a IA simulada. Nada no Supabase de verdade além das migrações que entram pelos merges do Luis. Não mexer no
  `.env.local` nem nos PRs abertos do parceiro (hoje, o #36).
- PROGRESSO e FALHAS atualizados em todo PR; o Claude avisa quando for hora de trocar de conversa.

**Risco aceito (F55, nova):** as receitas novas e a receita própria só rodam com a IA simulada até o bloco 6, e o bloco
5 depende de coisas do bloco 6 (chaves de produção e o tempo medido para a F54). Antes do bloco 5, o Luis decide entre
publicar com a IA simulada só para empresas de teste ou fazer a sessão 2 logo antes de publicar.

## Bloco 1 — o produto do funcionário (issue #54)

**Decisões do Luis (26/10, na aprovação da issue):** aceitas as cinco recomendações do Claude.
1. **As receitas para PMEs:** Proposta comercial, Posts para redes sociais e Relatório mensal para cliente, ao lado de
   "Criar um site". As três antigas ("Escrever e revisar um texto", "Pesquisa com checagem cruzada" e "Comitê de
   investimento") viram ideias no DOCUMENTO-PROJETO; a pesquisa depende da pesquisa na internet de verdade (bloco 6).
2. **O resultado em texto vira um arquivo Word**, para editar e mandar.
3. **Escolha livre no chat, forma (A):** a pessoa escolhe a IA, o nível e o esforço antes de mandar; o Chefe continua
   recomendando, e a resposta mostra os dois.
4. **Receita própria com 2 a 4 papéis, um depois do outro.**
5. **O nome da receita própria aparece no extrato** que o dono vê, com a tela avisando quem cria.

**Ordem dos PRs:** (1) o resultado em texto e a Proposta comercial; (2) os Posts; (3) o Relatório; (4) a escolha livre
no chat; (5) a receita própria: montar, salvar, editar e apagar; (6) a receita própria: rodar.

**PR 1 — o resultado em texto e a receita "Proposta comercial" (26/10, Claude Code; branch `feat/receita-proposta`,
empilhado sobre o PR #55). No ar: o Luis fez o merge do #55 e do #56 na noite de 26/10, com os branches apagados.**
- **A receita:** o **Consultor** (Claude, reserva GPT) monta o roteiro; o **Redator** (GPT, reserva Claude) escreve; o
  **Cliente exigente** (Claude, reserva GPT) lê como quem vai receber a proposta e aponta o que melhorar; o Redator
  aplica os apontamentos e entrega a **versão final** (esforço baixo, partindo da própria proposta). Quatro etapas, uma
  depois da outra. Ninguém inventa preço, prazo, número, cliente ou depoimento: o que falta vira [marcador]. Estimativa
  **"até R$ 2,50"** (R$ 1,69 com o Gemini de Redator); com a IA simulada, a receita custa uns R$ 0,08.
- **O resultado em texto:** a tela "Sua proposta está pronta" (o título vem da receita) mostra o texto numa folha branca,
  com o título, as seções, as listas e os destaques que a IA marca (`# `, `## `, `- `, `**`), sem rodar nada do que ela
  escreveu (`lib/ock/rich-text.ts` e `components/RichText.tsx`); **Copiar o texto** (sem as marcas) e **Baixar em Word**
  (`GET /api/runs/[id]/document`, só para quem pediu, sempre como anexo). O Word vira uma **entrega** quando a receita
  termina (`lib/runs/delivery.ts`, que era o `site-delivery.ts`), com o nome da receita ("Proposta-comercial.docx"),
  nunca do pedido (F49). A tela e o arquivo do site não mudaram.
- **Os cartões:** saíram as três receitas antigas "Em breve"; entraram a Proposta comercial (pronta), os Posts e o
  Relatório ("Em breve", com o time de cada um).
- **Decisão do Claude:** as quatro etapas da proposta rodam uma depois da outra, sem a "revisão que manda refazer" do
  site: com uma rodada só, quem aplica a crítica é a versão final, e o caminho fica mais simples e barato.
- **Como foi conferido:** lint, tipos, 550 testes (26 novos: a receita, o texto lido em partes, o Word, a entrega, a rota
  do Word, a proposta rodando do começo ao fim no servidor, a conferência das receitas) e build. **Ponta a ponta** contra
  o projeto de testes, com o Chrome por roteiro e uma empresa de mentira sem crédito: 49 conferências, todas certas (os
  cartões, a tela da receita com a estimativa e a recusa sem crédito; a execução encerrada pelo servidor cobrando as 4
  etapas e guardando o Word uma vez só; a tela do resultado, Copiar e Baixar em Word; Entregas, Meus gastos e o "Ver o
  que fez" do dono, sem o pedido; o site igual a antes; colega, dono e outra empresa sem acesso ao Word pela execução;
  360 e 320 px sem rolar para o lado).
- **Guia do teste:** `docs/GUIA-TESTE-PROPOSTA.md`, para o Luis seguir com o chat do Claude.

**PR 2 — a receita "Posts para redes sociais" (27/10, Claude Code; branch `feat/receita-posts`, a partir da `main`)**
- **A receita** (`lib/recipes/social-posts.ts`): o **Estrategista** (Claude, reserva GPT) define o objetivo, o público,
  a rede (o Instagram, se o pedido não disser), o tom, a chamada para ação e **três ângulos**; o **Redator 1** (GPT) e o
  **Redator 2** (Claude) escrevem **ao mesmo tempo** um post para cada ângulo, com a mesma tarefa; o **Editor** (GPT,
  reserva Claude) compara as duas versões de cada ângulo, fica com a melhor (ou junta o melhor das duas) e entrega **3
  opções**, cada uma com a chamada, o texto, as hashtags e uma ideia de imagem, e uma seção "Antes de publicar" com os
  [marcadores] a preencher. Regras dos posts (`POST_RULES`): tamanho e hashtags por rede (Instagram, Facebook, LinkedIn,
  WhatsApp) e nada de promessa que a empresa não pode cumprir ou provar. Resultado: "Seus posts estão prontos" e o Word
  "Posts-para-redes-sociais.docx". Estimativa **"até R$ 2,03"** (R$ 1,81 com o Gemini num redator); com a IA simulada,
  uns R$ 0,12.
- **Decisões do Claude:** (1) a **reserva dos dois redatores é o Gemini**: se o GPT ou o Claude falhar, os dois
  continuam sendo de IAs diferentes (com a reserva cruzada, os dois virariam a mesma IA); (2) os **três ângulos** vêm do
  Estrategista, e cada redator escreve um post por ângulo: a disputa fica justa (o Editor compara versão com versão do
  mesmo ângulo) e as 3 opções saem diferentes entre si; (3) **esforço baixo nos redatores** (textos curtos não pedem
  "pensamento") e médio no Estrategista e no Editor, o que deixa a receita mais barata que a proposta; (4) o Editor
  não cita os redatores no texto final; quem quiser ver a disputa abre "Ver todas as etapas".
- **Correção (F56, nova e resolvida):** a caixa "O documento vai tomando forma" da tela ao vivo foi feita para o site e
  aparecia também na proposta (já na `main`) e nos posts com o nome errado "Plano do chefe". Agora só aparece nas
  receitas que terminam num site (`components/run-state.ts`).
- **Risco aceito (F57, nova):** o Editor (GPT) escolhe entre os textos de um redator GPT e de um Claude e pode preferir
  os do GPT. É o time aprovado na issue #54; a comparação com um Editor de outra IA fica para o bloco 6.
- **Como foi conferido:** lint, tipos, 563 testes (13 novos: a receita, os dois redatores ao mesmo tempo com a troca do
  GPT pelo Gemini no servidor, as hashtags que não viram título, a estimativa de toda receita contra o gasto da IA
  simulada, o documento vivo só no site) e build. **Ponta a ponta** contra o projeto de testes, com uma empresa de
  mentira sem crédito: 60 conferências, todas certas (os cartões; a estimativa e a troca de IA na tela do time; a recusa
  sem crédito; a tela ao vivo com os dois redatores lado a lado, o aviso de troca e sem a caixa do site, que continua
  no site; a execução encerrada pelo servidor cobrando as 4 etapas e guardando o Word uma vez só; a tela do resultado,
  Copiar e o Word com as hashtags e os emojis; Entregas, Meus gastos e o painel do dono, sem o pedido; colega, dono e
  outra empresa sem acesso ao Word; 360 e 320 px).
- **Guia do teste:** `docs/GUIA-TESTE-POSTS.md`, com uma parte opcional que faz o GPT simulado falhar
  (`MOCK_AI_FAILURES`, só naquele terminal).
- **Ideia de ajuste (para a lista de depois do MVP):** um "Copiar" para cada opção de post (hoje o botão copia as 3).

## Próximo passo

1. **Luis:** contar ao Claude Code como foi o teste da Proposta comercial (`docs/GUIA-TESTE-PROPOSTA.md`), se ele foi
   feito antes do merge do #56. Depois, testar o PR dos Posts com o `docs/GUIA-TESTE-POSTS.md` (uns 25 minutos, com o
   chat do Claude) e contar como foi. O merge vem depois do teste.
2. **Claude Code, numa conversa nova:** o PR 3 do bloco 1, a receita "Relatório mensal para cliente" (analista dos
   números, redator e conferente que checa cada número contra os dados colados no pedido), e com ela sai o último
   "Em breve". Parte da `main` se o PR dos posts já tiver entrado; senão, empilhado sobre ele.
3. **Luis, quando quiser (no chat do Claude, sem código):** as decisões provisórias da madrugada, o câmbio e a F52
   (lista no resumo da madrugada, acima). A sessão 2 do guia das IAs de verdade ficou para o bloco 6.
4. **Com o parceiro (sem código):** avisar da F27, caso o banco dele esteja no ar com dados de verdade; confirmar a
   visão e as etapas 5 a 8; combinar o jeito de trabalhar: cada um com a própria conta no GitHub (F21), uma tarefa = um
   PR pequeno, o PROGRESSO atualizado em todo PR (F20) e tabelas só por migração; e decidir o PR #36 dele (o botão
   "Ouvir"), ainda aberto.

## Decisões em aberto

- Nome e marca (OCK é provisório)
- Formato do preço (por empresa, por funcionário, pelo consumo), margem e plano de teste (F04)
- Se e quando nichar (F02)
- Modelo de cada papel e de cada nível (econômico, padrão, potente): escolha provisória do Claude desde 26/10 (resumo da
  madrugada), a confirmar e a rever no bloco 6, com as primeiras medições e a pesquisa
  `docs/pesquisas/melhor-ia-por-funcao-2026-10-12.pdf`
- Cronograma

## Como retomar em uma conversa nova

**No Claude Code (etapas de código):**
1. Abra o VS Code na pasta `C:\Users\Luis\projetos\multi-ia` e abra o terminal (Ctrl + ').
2. Rode `git pull` (traz a versão mais nova do GitHub) e depois `claude`.
3. Cole: "Estamos no projeto Multi-IA. Leia o AGENTS.md e o docs/PROGRESSO.md e continue de onde paramos."

**No chat do Claude (claude.ai), para tarefas feitas à mão** (painéis do Supabase e do GitHub, configurações, testes):
1. Anexe o guia da tarefa, que fica em `docs/` (ex.: `docs/GUIA-PROJETO-DE-TESTES.md`).
2. Cole: "Estamos no projeto da plataforma multi-IA. Leia o guia anexado e me guie em cada parte, uma de cada vez."
3. No fim, volte ao Claude Code contando como foi.

**No chat do Claude (claude.ai), para discutir decisões:**
1. Anexe `docs/PROGRESSO.md`, `docs/BANCO-DE-DADOS.md` e `docs/FALHAS.md` (o chat não lê a pasta sozinho).
2. Cole: "Estamos no projeto da plataforma multi-IA. Leia os arquivos anexados e me ajude a decidir [o assunto]."

**No Cowork (discussões, documentos, planejamento):**
1. Conecte a pasta `C:\Users\Luis\projetos\multi-ia`.
2. Cole: "Estamos no projeto da plataforma multi-IA. Leia o docs/PROGRESSO.md e o docs/FALHAS.md e continue de onde paramos."

# Banco de dados

> **Status (24/10/2026):** proposta aprovada e decisões tomadas pelo Luis (fim deste arquivo). As migrações entraram na
> `main` no PR #24 e já estão no projeto de verdade (conferido pelo Luis: 11 tabelas vazias, pasta `files` privada,
> Postgres 17.11, a mesma versão das checagens). A migração 6 (convites, PR 2b) chegou com o merge do PR #30; a 7 (as
> contas do mês, parte 3d) chegou com o merge do PR #45 (conferida pelo Luis no projeto de verdade em 26/10).
> **A versão oficial das tabelas são as migrações** em
> `supabase/migrations/`; este arquivo explica o desenho em português e precisa mudar junto quando elas mudarem.

O banco é refeito **do zero**, num projeto novo do Supabase (Gmail do projeto, região São Paulo), sem usar as tabelas
que o parceiro criou no Supabase dele (`ock_*`, `runs`, `run_events`, `run_steps`, `run_secrets`). O login, a equipe e as
receitas e o chat usam o banco novo (PRs 2a, 2b, 3a, 3b e 3c da etapa 5); nenhuma parte do código usa mais o antigo.

## As três ideias do desenho

**1. Toda linha do banco pertence a uma empresa.** Todas as tabelas têm o campo `company_id`. Sobre ele entram as
**regras de acesso (RLS)**: regras gravadas no próprio banco que dizem quem pode ler cada linha. O endereço do banco e
a chave pública do Supabase vão junto com o site (o Supabase foi feito para funcionar assim). Qualquer pessoa pode
pegar essa chave e consultar o banco direto, sem passar pelas nossas telas, e só as regras de acesso impedem que ela
veja o que não deve. Toda tabela é criada com as regras ligadas, e uma checagem automática falha se alguma ficar sem.
Analogia: um prédio só, em que cada empresa tem o seu andar e o crachá de cada pessoa abre apenas o andar da empresa dela.

**2. Login e senha ficam com o Supabase Auth.** É o serviço de login que já vem no Supabase: guarda e-mail e senha com
segurança, manda convites e recupera senhas. As nossas tabelas não guardam senha nenhuma. Elas só registram que tal
pessoa logada pertence a tal empresa, com tal papel.

**3. A carteira funciona como um extrato.** Cada movimento é uma linha que nunca é apagada nem editada: recarga (+),
gasto (−) ou ajuste (±). O saldo é a soma das linhas, como num extrato de banco. O dinheiro só se mexe por funções
dentro do próprio banco, que travam a carteira da empresa enquanto conferem e lançam. Assim duas tarefas rodando ao
mesmo tempo não conseguem gastar o mesmo real.

## As tabelas

Nomes em inglês, como pede o AGENTS.md. Valores em centavos de real.

**Empresa e pessoas** (migração 1)

| Tabela | O que guarda |
|---|---|
| `companies` | A empresa: nome e data de criação. O crédito não fica aqui, porque vem do extrato. |
| `members` | As pessoas da empresa: ligação com o login (Supabase Auth), nome, e-mail, papel (`owner` dono, `employee` funcionário), teto de gasto por mês (`monthly_budget_cents`; vazio = sem teto) e situação (`active` ou `disabled`). No MVP, cada login pertence a uma empresa só. Ninguém apaga uma pessoa: quem sai é desativado. |

**Dinheiro** (migração 2)

| Tabela | O que guarda |
|---|---|
| `wallet_entries` | O extrato. Cada linha: tipo (`topup` recarga, `charge` gasto, `adjustment` ajuste), valor, quem gastou, com qual IA, de qual execução ou tarefa veio, e uma descrição escrita pelo servidor ("Criar um site · Programador"), nunca com o pedido do funcionário. Não aceita edição nem exclusão. |
| `wallet_holds` | As reservas: o valor separado antes de uma execução ou tarefa começar, quanto dele já foi cobrado, se está aberta ou fechada e até quando segura o saldo (reserva esquecida aberta, por exemplo se o servidor cair, para de segurar sozinha). |

**Trabalho** (migração 3)

| Tabela | O que guarda |
|---|---|
| `custom_recipes` | As receitas próprias, no mesmo formato das prontas, e se cada uma é só de quem criou (`private`) ou da empresa toda (`company`). As receitas prontas continuam no código (`lib/recipes/`), porque assim passam por revisão e pelos testes. |
| `runs` | Cada execução de receita: pedido, time, etapas, resultado, status (com o novo `paused`), estimativa e o estado do motor para continuar de onde parou. Três colunas são só internas: o erro técnico e o controle de quem está rodando a execução. |
| `run_events` | A narração ao vivo (o que aparece nos cartões enquanto as IAs trabalham). |
| `conversations` | As conversas da tarefa rápida. |
| `tasks` | Cada pedido dentro de uma conversa: pedido, resposta, o que a plataforma fez (responder, documento...), o que ela recomendou (IA, nível, esforço) e o que o funcionário escolheu de fato. Dá para medir quantas vezes as pessoas trocam a recomendação (F03). |
| `files` | Arquivos que o funcionário envia (`upload`) e entregas que as IAs produzem (`delivery`), ligados à tarefa ou execução de origem. O conteúdo fica na pasta fechada `files` do Storage, no caminho `<empresa>/<pessoa>/...`, e só sai por link temporário gerado pelo servidor depois de conferir quem pede. |

**Uso interno** (migração 4; nenhuma regra libera a leitura: só o nosso servidor enxerga)

| Tabela | O que guarda |
|---|---|
| `ai_calls` | Toda chamada a uma IA, inclusive as que falharam: modelo exato, tokens, custo em dólar, câmbio usado, se foi cobrada e o erro técnico. Base para preço e margem (F04, F26). O servidor só acrescenta linhas; não muda nem apaga. |

**A pasta fechada** (migração 5): `files`, no Storage do Supabase. Não é pública e não tem regra de acesso nenhuma, então
só o servidor lê e grava nela.

**Convites** (migração 6, PR 2b)

| Tabela | O que guarda |
|---|---|
| `member_invites` | O link que o funcionário ainda não usou: de quem é, o tipo (`invite` primeiro convite, `reset` senha nova), até quando vale (24 horas) e o **resumo** (sha256) do código que vai no link, nunca o código em si. Uma linha por pessoa: um link novo troca o código, e o antigo para de valer. A linha é apagada quando o link é usado. |

**O que sai em relação ao banco antigo:** as senhas (vão para o Supabase Auth), a empresa fixa "demo", o crédito
guardado na empresa, o gasto guardado no funcionário, as chaves de API dos usuários (`run_secrets`) e o código anônimo
que identifica o dono de uma execução (passa a ser o funcionário logado).

**Ligações que garantem a empresa certa:** quando uma linha aponta para uma pessoa (ou uma tarefa aponta para uma
conversa), o banco confere que as duas são da mesma empresa. Nem um erro no nosso código consegue ligar o gasto de uma
empresa a uma pessoa de outra.

## A carteira, num exemplo

A agência tem R$ 200,00 de saldo. A Ana pede a receita "Criar um site", com estimativa de R$ 3,00.

1. **Reserva:** numa operação só, o banco confere se a Ana está ativa, se a empresa tem saldo e se a Ana não passa do
   teto do mês, e separa R$ 3,00. O saldo disponível cai para R$ 197,00. O extrato ainda não muda.
2. **Cobrança por etapa:** cada etapa concluída vira uma linha de gasto no extrato, pelo consumo real
   ("Ana · Criar um site · Programador (GPT) · −R$ 0,90"). Etapa que falhou não vira linha; o custo dela fica só na
   `ai_calls`.
3. **Fim:** a reserva fecha. Se o total foi R$ 2,40, os R$ 0,60 que sobraram voltam a ficar disponíveis sozinhos,
   porque nunca saíram do extrato.

Como a pré-autorização do cartão num hotel: bloqueiam um valor na entrada, mas na fatura só aparece o que foi gasto.
Se o custo for passar da estimativa, a execução pausa antes da próxima etapa e pergunta. A tarefa rápida usa a mesma
reserva, com o máximo de uma resposta (abaixo).

**Quando o custo real passa da estimativa:** o consumo da IA já aconteceu, então a cobrança entra assim mesmo (a
plataforma não absorve diferenças) e o banco avisa o servidor que a reserva estourou. Se a empresa estava sem folga, o
saldo pode ficar um pouco negativo; aí nenhuma reserva nova passa até a próxima recarga (F29).

**O teto do mês** conta os gastos da pessoa desde o dia 1º, à meia-noite de Brasília, mais o que ela tem reservado no
momento. O extrato guarda tudo, de todos os meses; só a conferência do teto olha o mês corrente.

**Como as receitas usam a carteira (PR 3b, 25/10/2026):** a estimativa é o máximo que o time pode gastar
(`lib/runs/estimate.ts`). O servidor reserva antes de criar a execução, já com o id dela em `wallet_holds.run_id`: é
assim que cada fase acha a reserva da sua execução, sem coluna nova em `runs`. Antes de cada fase, o servidor confere se
o que sobra da reserva cobre o máximo do que falta; se não cobre, a execução fica `paused` e pergunta. "Continuar" fecha
a reserva antiga e reserva o que falta (com as mesmas conferências de saldo e teto). Cada etapa concluída vira uma linha
de gasto, com no mínimo 1 centavo: assim, o número de linhas de gasto da execução diz quantas etapas já foram cobradas,
e uma fase gravada mas não cobrada (o servidor caiu entre os dois) é cobrada na chamada seguinte, sem cobrar nada duas
vezes.

**Como o chat usa a carteira (PR 3c, 25/10/2026):** cada mensagem tem duas reservas, as duas com o id da mensagem em
`wallet_holds.task_id` e prazo de 15 minutos (`p_ttl`), em vez de 1 hora: uma resposta leva no máximo 5 minutos.
1. Antes de qualquer IA, o máximo que o Chefe pode gastar para decidir (uns 2 centavos). Recusou: nenhuma IA trabalha e
   nada é guardado. Essa reserva fecha assim que o Chefe decide.
2. O que o Chefe gastou mais o máximo da IA que vai responder (de uns R$ 0,05 numa pergunta simples a uns R$ 9 num projeto
   no Claude potente). Recusou: nada é cobrado, e o custo do Chefe (frações de centavo) fica só em `ai_calls`.
3. Com a resposta pronta e gravada, **uma linha de gasto só** por mensagem ("Tarefa rápida · Documento", com a IA que
   respondeu e `task_id`), pelo consumo real do Chefe e da resposta, com no mínimo 1 centavo. Resposta que falhou não
   vira linha. A reserva fecha e a sobra volta.
No chat não há pausa: como a reserva é o máximo, o custo real só passaria dela se a medição estivesse errada (F40, F29).

### As contas do mês (migração 7, parte 3d)

O painel do dono, o "Gasto do mês" do `/trabalho` e a aba Meus gastos não somam linhas no nosso servidor: o Supabase
devolve no máximo 1.000 linhas por pedido, e a soma ficava menor que o real depois disso (F48). As contas são feitas
dentro do banco, por quatro funções que **rodam com o login de quem chama** (`security invoker`): as regras de acesso das
tabelas valem dentro delas, então cada um só soma o que já podia ler. Nenhuma lê pedido, resposta ou conversa.

| Função | Quem recebe o quê |
|---|---|
| `company_credit()` | Só o dono: o saldo (o extrato inteiro), o que está reservado agora (reservas abertas e no prazo) e o gasto das pessoas no mês. O disponível é o saldo menos o reservado. Para o funcionário, nenhuma linha. |
| `company_month_by_provider()` | Só o dono: o gasto do mês por IA; os ajustes, que não têm IA, numa linha à parte. A soma bate com o gasto do mês. |
| `member_month_summary(pessoa)` | O mês de cada pessoa que quem chama enxerga (o dono, a equipe; o funcionário, ele mesmo): gasto, reservado, mensagens do chat cobradas, receitas e entregas do mês. |
| `month_statement(pessoa, limite)` | O extrato do mês, das linhas mais novas para as mais antigas, com **cada execução de receita numa linha só** (as etapas somadas, as IAs que trabalharam e a hora da última cobrança). Para o dono, com as recargas; com uma pessoa, só os gastos dela. Até 500 linhas por pedido. |

O mês conta como o teto: do dia 1º, à meia-noite de Brasília. Para essas contas, quem está logado passou a poder usar
`private.month_start`, que é só a conta da data (não lê dado nenhum).

### As funções do dinheiro

| Função | Quem chama | O que faz |
|---|---|---|
| `wallet_reserve` | o servidor | Reserva o valor estimado. Recusa com `insufficient_balance` (sem saldo), `monthly_budget_exceeded` (passaria do teto) ou `member_inactive` (pessoa desativada). |
| `wallet_charge` | o servidor | Cobra uma etapa ou tarefa concluída e devolve quanto sobra da reserva (negativo = passou da estimativa). |
| `wallet_close_hold` | o servidor | Fecha a reserva e devolve o total cobrado. |
| `private.wallet_topup` | **só o painel do Supabase** | Recarga, depois de receber o Pix (F25). |
| `private.wallet_adjust` | **só o painel do Supabase** | Ajuste para corrigir um lançamento (+ devolve, − cobra). |

Nem o nosso servidor grava direto no extrato ou nas reservas: só por essas funções. E nem ele consegue lançar recarga.

**Como lançar uma recarga (no MVP, à mão):** no painel do Supabase, abra *SQL Editor* e rode, trocando o id da empresa
e o valor em centavos:

```sql
select private.wallet_topup('<id da empresa>', 20000, 'Pix de 24/10');  -- R$ 200,00; devolve o saldo novo
```

Isso não muda tabela nenhuma (só acrescenta uma linha ao extrato), então não fere a regra de "tabela só por migração".

- **Funcionário que sai:** é desativado e perde o acesso na hora, mas não é apagado; o extrato guarda o que ele gastou
  (F23). Se ele pedir para apagar os dados (LGPD), o conteúdo das conversas e dos arquivos vai embora, mas a linha
  "gastou R$ X em tal dia" fica, porque é registro financeiro da empresa.

## Quem vê o quê

| | Funcionário | Dono |
|---|---|---|
| Empresa e lista de funcionários | só o próprio cadastro | todos |
| Extrato e reservas | só os próprios gastos | tudo |
| Saldo da empresa e gasto por IA (contas do mês) | não | sim |
| Receitas próprias | as dele e as da empresa | as da empresa (e as dele) |
| Execuções, conversas e tarefas | as próprias | só as próprias. Dos funcionários, vê o resumo pelo extrato (quem, quando, receita ou IA, custo), sem pedidos nem respostas |
| Arquivos | os próprios | os próprios e as entregas de todos |
| Convites (`member_invites`) | não | os da empresa (quem, tipo e prazo), nunca o resumo do código |
| `ai_calls` | não | não |

## Quem grava o quê

Pela sessão de quem está logado (o "crachá"), o banco deixa fazer só isto, sempre dentro das regras acima:

| Quem | Pode |
|---|---|
| Funcionário e dono | criar, renomear e apagar as próprias conversas; criar, mudar e apagar as próprias receitas; apagar as próprias tarefas, arquivos e execuções que já pararam (LGPD) |
| Dono | mudar nome, teto e situação (ativo/desativado) dos funcionários; mudar e apagar as receitas da empresa. Convidar e gerar link novo, só pelo servidor (abaixo) |
| Ninguém pela sessão | escolher a empresa ou o autor de uma linha (vêm sozinhos de quem está logado), mudar papel, lançar dinheiro, ler as colunas internas |

O resto (criar empresa e pessoas, gravar execuções, tarefas e arquivos, e o dinheiro) é feito pelo servidor, com a
chave-mestra. As rotas comuns entram no banco com a sessão de quem está logado: se uma rota esquecer de filtrar pela
empresa, o próprio banco barra. A chave-mestra fica só para o dinheiro e para a parte do servidor que leva as execuções
adiante. A sessão chega ao servidor pela biblioteca oficial do Supabase para login no Next.js (`@supabase/ssr`,
aprovada pelo Luis e instalada no PR 2a, em 24/10).

**Como a empresa nasce (PR 2a):** no cadastro, o Supabase Auth cria só o login do dono, com o nome da empresa e o dele
guardados junto. A empresa e o dono só entram nas tabelas no primeiro acesso, com o e-mail já confirmado, pelo servidor
(`lib/auth/company-signup.ts`). Assim um cadastro abandonado não deixa empresa nenhuma. A empresa nasce com o mesmo id
do login do dono: se o primeiro acesso for processado duas vezes ao mesmo tempo, a segunda tentativa esbarra na mesma
chave e não sobra uma empresa vazia.

**Como o funcionário entra (PR 2b):** o dono preenche nome, e-mail e teto no painel. O servidor confere pela sessão que
quem pede é o dono e, com a chave-mestra, cria o login do funcionário no Supabase Auth (com o e-mail, ainda sem senha e
sem mandar e-mail nenhum), a pessoa em `members` e o convite em `member_invites`. O link (`/convite/<código>`) aparece
uma vez só para o dono, que o manda (ex.: pelo WhatsApp). Abrir o link só mostra o convite: a prévia do link no WhatsApp
não o gasta. Quando a pessoa cria a senha, o servidor apaga o convite na mesma operação que confere o código e o prazo
(dois envios ao mesmo tempo não usam o mesmo link), grava a senha no Supabase Auth e entra. Se a senha não puder ser
gravada, o convite volta. "Gerar link novo" serve para quem não aceitou a tempo (continua `invite`) e para quem perdeu a
senha (`reset`); a senha antiga vale até o link novo ser usado, e usar o link desconecta os outros aparelhos da pessoa.
O prazo de 24 horas fica na nossa tabela; não depende do *Email OTP Expiration* do Supabase.

Como a sessão consegue gravar conversas e receitas sem passar pelas nossas telas, o servidor confere o formato de uma
receita própria de novo antes de rodá-la.

**Como uma execução de receita anda (PR 3a):** o servidor cria a linha em `runs` com a empresa e a pessoa tiradas do
login e roda uma fase de cada vez, numa chamada interna (`/api/runs/<id>/continue`). Quem roda "reserva" a execução
por 60 segundos e renova a reserva a cada 2 segundos; se o servidor cair, a reserva vence e a execução é retomada na
próxima vez que a tela pede novidades. A narração vai para `run_events` aos poucos, enquanto a fase roda. A tela lê a
execução e a narração pelo nosso servidor, com a sessão de quem está logado: o banco só devolve as execuções da
própria pessoa. Cancelar procura a execução pela sessão (a de outra pessoa nem aparece) e grava pela chave-mestra.
Cada etapa concluída vira uma linha em `ai_calls` (modelo e tokens; o custo entra com a cobrança, na parte 3b).

**Como uma mensagem do chat anda (PR 3c):** tudo numa chamada só (`POST /api/ock`), com a resposta voltando no fim. A
conversa nova é criada pela sessão da pessoa (o banco põe a empresa e a pessoa sozinho); a mensagem (`tasks`) e os
arquivos (`files`) são gravados pelo servidor. Os anexos sobem antes (`POST /api/ock/files`), como `upload`, e ficam
ligados à mensagem (`files.task_id`) quando ela é enviada; as entregas que a IA faz entram como `delivery`, também com
a mensagem. Na pasta fechada, todo arquivo é gravado como "só para baixar" (`application/octet-stream`); o tipo de
verdade fica em `files.mime_type`. Baixar passa pelo nosso servidor, que acha o arquivo com a sessão de quem pede (o
dono acha também as entregas dos funcionários, não os anexos) e manda para um link de 5 minutos que sempre baixa. Cada
chamada às IAs (o Chefe, `step_id` "chief", e a resposta, "answer", com cada tentativa) vira uma linha em `ai_calls`
com `task_id`. Uma mensagem que ficou "respondendo" (o servidor caiu no meio) aparece como falha depois de 6 minutos;
ela nunca foi cobrada, porque a resposta é gravada antes da cobrança.

**O site vira entrega (parte 3d, F47):** quando a receita "Criar um site" termina, o servidor guarda o `.html` na pasta
fechada como `delivery` da pessoa, com `files.run_id` da execução, antes de marcar a execução como terminada. Assim o
dono, que não lê a execução, vê e baixa o site pelas entregas. Se o servidor cair e retomar, ele confere pelo `run_id` e
não guarda duas vezes. Na pasta, o Supabase entrega todo `.html` como texto puro, com "nosniff" e como anexo.

## Migrações

**Migração** é um arquivo SQL numerado que cria ou muda tabelas. Quem roda os arquivos em ordem monta o banco
igualzinho, do zero. Ficam em `supabase/migrations/`:

1. `..._companies_and_members.sql`: empresas e pessoas, com as regras de acesso
2. `..._wallet.sql`: carteira (extrato, reservas e as funções do dinheiro)
3. `..._work.sql`: trabalho (receitas próprias, execuções, conversas, tarefas e arquivos)
4. `..._ai_calls.sql`: a tabela interna `ai_calls`
5. `..._files_bucket.sql`: a pasta fechada dos arquivos
6. `..._member_invites.sql`: os convites dos funcionários (PR 2b)
7. `..._month_summaries.sql`: as contas do mês (parte 3d): crédito da empresa, gasto por IA, mês de cada pessoa e extrato
   do mês com a receita numa linha

**Regras para as próximas migrações:** toda tabela nova liga o RLS e diz com `grant` exatamente o que cada papel pode
fazer (o projeto não dá acesso automático a tabelas novas, e a chave pública sem login, `anon`, não recebe acesso a
nada); toda função nova tem o acesso de todos tirado (`revoke`) e só ganha `grant` para quem precisa. As checagens
abaixo falham se isso for esquecido.

**Empresa de exemplo:** `supabase/seed.sql`, com a dona Marina e os funcionários Ana e Bruno (logins e a senha de
teste no começo do arquivo). Só existe no banco local e nas checagens; o banco de verdade nunca recebe esse arquivo.

## Testes do banco

Ficam em `supabase/tests/database/` (formato pgTAP, que é SQL com conferências):

- `01_structure`: toda tabela com RLS ligado; a chave pública sem login sem acesso a nada; quem pode chamar cada função;
  ninguém lê a `ai_calls`; ninguém grava direto no extrato; a pasta de arquivos fechada.
- `02_access`: duas empresas de mentira. Uma não enxerga nada da outra, um funcionário não lê o que é do colega, o dono
  vê o extrato, as pessoas e as entregas mas não as execuções, conversas e tarefas dos funcionários, e quem é
  desativado perde o acesso na hora.
- `03_wallet`: reserva, cobrança pelo consumo real, fechamento, teto do mês (inclusive a virada do mês no horário de
  Brasília), falta de saldo e o extrato que não pode ser editado.
- `04_invites`: o dono vê os convites só da própria empresa e nunca o resumo do código; ninguém pela sessão cria, muda
  ou apaga convite; o banco só aceita o resumo (nunca o código), um convite por pessoa e sempre da empresa dela; o
  convite serve uma vez só e não depois do prazo.
- `05_month_summaries`: as contas do mês com duas empresas de mentira. O saldo, o reservado (sem a reserva vencida) e o
  gasto do mês da empresa; o gasto por IA e por pessoa batendo com o total; a receita numa linha só; o mês passado e os
  anexos fora; o funcionário sem o saldo da empresa e sem o mês do colega; o dono de outra empresa sem nada; sem login,
  recusado. O `01_structure` confere que as contas rodam com o login de quem chama.

**Onde rodam:** nas checagens do GitHub (`.github/workflows/ci.yml`, parte "Banco de dados"), com a ferramenta oficial
do Supabase (aprovada pelo Luis em 24/10), num banco temporário que some no fim. O banco de verdade não é tocado.
Rodar no computador exige o Docker, que não está instalado; por enquanto, quem confere é o GitHub.

**Limite conhecido:** os testes rodam numa conexão só, então não simulam dois pedidos ao mesmo tempo. A proteção contra
isso (F24) é a trava da carteira da empresa dentro de cada função do dinheiro.

## Ligação do GitHub com o Supabase

Orientada em 24/10 e conferida pelo Luis. No projeto novo do Supabase (*Project Settings → Integrations → GitHub*):

| Opção | Escolha | Por quê |
|---|---|---|
| Acesso do GitHub | **Only select repositories** → `lgvoliveira/multi-ia` | O Supabase só enxerga este repositório |
| Pasta do Supabase (*Supabase directory*) | `.` | Aponta para a pasta `supabase/` na raiz |
| Branch de produção | `main` | É onde o Luis faz o merge |
| **Deploy to production** | ligado | No merge, o Supabase aplica as migrações novas sozinho |
| **Automatic branching** | desligado | Exige o plano pago (Pro) e cobra por hora |

A ligação não coloca chave no código (as chaves vão à mão para o `.env.local`), e os dados de exemplo (`seed.sql`) não
vão para o banco no merge. As configurações de login do `supabase/config.toml` também não vão: elas valem só para o
banco local. Para desfazer: desconectar em *Project Settings → Integrations* e revogar em *Settings → Applications* no
GitHub.

**Opções de segurança escolhidas na criação do projeto (24/10):** *Enable Data API* ligada; *Automatically expose new
tables* **desligada** (nenhuma tabela nova fica acessível pela chave pública sozinha); *Enable automatic RLS* **ligada**
(rede de proteção: toda tabela nova do `public` já nasce com as regras de acesso ligadas). As migrações não dependem
dessas opções: ligam o RLS e dão as permissões explicitamente, então o banco local e o das checagens ficam iguais ao de
verdade.

**Regra:** mudança de tabela só por migração no GitHub, nunca pelo editor de tabelas ou de SQL do painel do Supabase.
Senão o banco deixa de bater com o repositório (F14). Vale para todos, inclusive o parceiro. Lançar recarga e ajuste
pelo editor de SQL é permitido, porque não muda tabela.

## Projeto de testes

Decidido pelo Luis em 24/10/2026. O computador de desenvolvimento **não usa o banco de verdade**: usa um segundo
projeto grátis do Supabase, `multi-ia-teste` (mesma organização, região São Paulo), só com dados de mentira.
Passo a passo para criar e configurar: `docs/GUIA-PROJETO-DE-TESTES.md`.

Por quê:
- O computador guarda só chaves de teste. Se uma vazar, ficam expostos só dados de mentira. A chave-mestra do banco de
  verdade só vai para a hospedagem (Vercel), na publicação.
- O banco de verdade fica limpo para as empresas reais. O extrato não deixa apagar linhas, então uma recarga de teste
  ficaria lá para sempre.
- Dá para testar uma migração nova antes do merge.

**Como as migrações chegam nele:** pelo workflow "Banco de testes" (`.github/workflows/test-db.yml`), com a mesma
ferramenta oficial do Supabase das checagens. Ele roda sozinho quando uma migração nova entra na `main` e também por
botão: *Actions → Banco de testes → Run workflow*, escolhendo o branch do PR. A ligação é o segredo
`SUPABASE_TEST_DB_URL` do repositório (*Settings → Secrets and variables → Actions*): o endereço do banco de testes com
a senha, pelo *Session pooler* (o GitHub não alcança o endereço direto do banco). Só o GitHub enxerga esse segredo. A
empresa de exemplo (`seed.sql`) não vai para lá: as contas de teste são criadas pelas próprias telas.

**Configuração do login no projeto de testes** (painel do Supabase, *Authentication*):

| Onde | Opção | Valor | Por quê |
|---|---|---|---|
| *URL Configuration* | *Site URL* | `http://localhost:3000` | O site roda no computador |
| *URL Configuration* | *Redirect URLs* | `http://localhost:3000/**` | Os links de confirmação só podem voltar para o nosso site |
| *Sign In / Providers → Email* | *Confirm email* | ligado | O dono confirma o e-mail antes de entrar |
| *Sign In / Providers → Email* | *Email OTP Expiration* | `86400` (24 horas) | Prazo do link de confirmação do cadastro (o do convite do funcionário fica na tabela `member_invites`) |
| *Sign In / Providers → Email* | *Minimum password length* | `8` | Senha mínima |

No projeto de verdade, as mesmas opções, com o endereço do site no ar, na publicação. As opções de segurança da criação
são as mesmas do projeto de verdade (acima).

**Limites do plano grátis:** o projeto pausa depois de 7 dias sem uso (volta com *Restore project* no painel), e o
envio de e-mail embutido só entrega para quem é da equipe do Supabase, no máximo 2 por hora (F30). O projeto de testes
também só muda por migração. Se ele ficar bagunçado, dá para apagar e criar de novo, e o workflow remonta as tabelas.

## Decisões tomadas (Luis, 24/10/2026)

1. **Teto do funcionário: por mês.** Renova todo dia 1º, à meia-noite no horário de Brasília. O extrato guarda tudo;
   só a conferência do teto olha os gastos do mês corrente. (O código do parceiro usava acumulado e muda no PR 3.)
2. **O que o dono vê (F05): opção (a).** Só o resumo de cada funcionário (quem fez, quando, com qual receita ou IA,
   quanto custou) e as entregas. Não lê pedidos nem respostas. O "resumo do dia" do parceiro fica desligado; se voltar,
   é refeito usando só esses dados. Passar para (b) no futuro exige aviso aos funcionários e uma migração própria.
3. **"Traga sua chave": fora do banco novo.** Nenhuma tabela guarda chave de API de empresa. Se voltar, entra numa
   migração própria.

# Banco de dados — proposta da etapa 5

> **Status (24/10/2026):** proposta aprovada. **As 3 decisões foram tomadas pelo Luis em 24/10** (fim deste arquivo).
> Nenhuma migração foi escrita ainda. Este arquivo é a referência do banco até as migrações em
> `supabase/migrations/` existirem; a partir daí, elas são a versão oficial das tabelas.

O banco é refeito **do zero**, num projeto novo do Supabase (Gmail do projeto, região São Paulo), sem usar as tabelas
que o parceiro criou no Supabase dele (`ock_*`, `runs`, `run_events`, `run_steps`, `run_secrets`).

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
gasto (−) ou ajuste (±). O saldo é a soma das linhas, como num extrato de banco. O dinheiro só se mexe por quatro
funções dentro do próprio banco (reservar, cobrar, fechar a reserva, recarregar), que travam a carteira da empresa
enquanto conferem e lançam. Assim duas tarefas rodando ao mesmo tempo não conseguem gastar o mesmo real.

## As tabelas

Nomes em inglês, como pede o AGENTS.md.

**Empresa e pessoas**

| Tabela | O que guarda |
|---|---|
| `companies` | A empresa: nome e data de criação. O crédito não fica aqui, porque vem do extrato. |
| `members` | As pessoas da empresa: ligação com o login (Supabase Auth), nome, e-mail, papel (`owner` dono, `employee` funcionário), teto de gasto e situação (ativo ou desativado). No MVP, cada login pertence a uma empresa só. |

**Dinheiro**

| Tabela | O que guarda |
|---|---|
| `wallet_entries` | O extrato. Cada linha: tipo (recarga, gasto, ajuste), valor em centavos de real, quem gastou, com qual IA e de qual execução ou tarefa o gasto veio. |
| `wallet_holds` | As reservas: o valor separado antes de uma execução ou tarefa começar, e quanto dele já foi cobrado. |

**Trabalho**

| Tabela | O que guarda |
|---|---|
| `custom_recipes` | As receitas próprias, no mesmo formato das prontas, e se cada uma é só de quem criou ou da empresa toda. As receitas prontas continuam no código (`lib/recipes/`), porque assim passam por revisão e pelos testes. |
| `runs` | Cada execução de receita: pedido, time, etapas, resultado, status (com o novo "pausada"), estimativa e valor cobrado. |
| `run_events` | A narração ao vivo (o que aparece nos cartões enquanto as IAs trabalham). |
| `conversations` | As conversas da tarefa rápida. |
| `tasks` | Cada pedido dentro de uma conversa: pedido, resposta, o que a plataforma recomendou (IA, nível, esforço) e o que o funcionário escolheu de fato. Dá para medir quantas vezes as pessoas trocam a recomendação (F03). |
| `files` | Arquivos que o funcionário envia e entregas que as IAs produzem, ligados à tarefa ou execução de origem. O conteúdo fica numa pasta fechada do Supabase e só sai por link temporário gerado pelo servidor depois de conferir quem pede. |

**Uso interno** (nenhuma regra libera a leitura: só o nosso servidor enxerga)

| Tabela | O que guarda |
|---|---|
| `ai_calls` | Toda chamada a uma IA, inclusive as que falharam: modelo exato, tokens, custo em dólar, câmbio usado, se foi cobrada e o erro técnico. Base para preço e margem (F04, F26). |

**O que sai em relação ao banco antigo:** as senhas (vão para o Supabase Auth), a empresa fixa "demo", o crédito
guardado na empresa, o gasto guardado no funcionário e o código anônimo que identifica o dono de uma execução (passa a
ser o funcionário logado).

## A carteira, num exemplo

A agência tem R$ 200,00 de saldo. A Ana pede a receita "Criar um site", com estimativa de R$ 3,00.

1. **Reserva:** numa operação só, o banco confere se a empresa tem saldo e se a Ana não passa do teto dela, e separa
   R$ 3,00. O saldo disponível cai para R$ 197,00. O extrato ainda não muda.
2. **Cobrança por etapa:** cada etapa concluída vira uma linha de gasto no extrato, pelo consumo real
   ("Ana · Criar um site · Programador (GPT) · −R$ 0,90"). Etapa que falhou não vira linha; o custo dela fica só na
   `ai_calls`.
3. **Fim:** a reserva fecha. Se o total foi R$ 2,40, os R$ 0,60 que sobraram voltam a ficar disponíveis sozinhos,
   porque nunca saíram do extrato.

Como a pré-autorização do cartão num hotel: bloqueiam um valor na entrada, mas na fatura só aparece o que foi gasto.
Se o custo for passar da estimativa, a execução pausa antes da próxima etapa e pergunta. A tarefa rápida usa a mesma
reserva, com uma estimativa pequena.

- **Recarga:** só a plataforma lança (F25). No MVP, o Luis ou o parceiro roda um comando no painel do Supabase depois
  de receber o Pix. O dono vê o saldo e o extrato, mas não mexe neles.
- **Funcionário que sai:** é desativado e perde o acesso na hora, mas não é apagado; o extrato guarda o que ele gastou
  (F23). Se ele pedir para apagar os dados (LGPD), o conteúdo das conversas e dos arquivos vai embora, mas a linha
  "gastou R$ X em tal dia" fica, porque é registro financeiro da empresa.

## Quem vê o quê

| | Funcionário | Dono |
|---|---|---|
| Empresa e lista de funcionários | só o próprio cadastro | todos |
| Extrato e reservas | só os próprios gastos | tudo |
| Receitas próprias | as dele e as da empresa | as da empresa |
| Execuções, conversas e tarefas | as próprias | só o resumo (quem, quando, receita ou IA, custo), sem pedidos nem respostas |
| Arquivos | os próprios | as entregas de todos |
| `ai_calls` | não | não |

Nenhuma tela grava direto no banco: tudo passa pelas rotas do nosso servidor, que conferem o pedido. As rotas comuns
entram no banco com a sessão de quem está logado (o "crachá"), não com a chave-mestra que o código usa hoje: se uma
rota esquecer de filtrar pela empresa, o próprio banco barra. A chave-mestra fica só para o dinheiro e para a parte do
servidor que leva as execuções adiante. Para isso, no PR do login, o Claude vai propor a biblioteca oficial do Supabase
para login no Next.js (`@supabase/ssr`); só instala com aprovação.

## Migrações

**Migração** é um arquivo SQL numerado que cria ou muda tabelas. Quem roda os arquivos em ordem monta o banco
igualzinho, do zero. Ficam em `supabase/migrations/`:

1. empresas e pessoas, com as regras de acesso
2. carteira: extrato, reservas e as quatro funções do dinheiro
3. trabalho: receitas próprias, execuções, conversas, tarefas e arquivos
4. a tabela interna `ai_calls`
5. a pasta fechada dos arquivos

Junto vão uma empresa de exemplo (um dono e dois funcionários, em `supabase/seed.sql`) e um teste das regras de
acesso: duas empresas de mentira, conferindo que uma não enxerga nada da outra e que um funcionário não lê o que é do
colega.

**Ordem dos PRs da etapa 5:**
1. Migrações, empresa de exemplo e teste das regras. O código antigo ainda não usa o banco novo.
2. Login de verdade, cadastro da empresa e convite de funcionário (F10 a F13).
3. Troca do código do parceiro para o banco novo (F16, F23 a F27).

## Ligação do GitHub com o Supabase

Orientada em 24/10. No projeto novo do Supabase (*Project Settings → Integrations → GitHub*):

| Opção | Escolha | Por quê |
|---|---|---|
| Acesso do GitHub | **Only select repositories** → `lgvoliveira/multi-ia` | O Supabase só enxerga este repositório |
| Pasta do Supabase (*Supabase directory*) | `.` | Aponta para a pasta `supabase/` na raiz |
| Branch de produção | `main` | É onde o Luis faz o merge |
| **Deploy to production** | ligado | No merge, o Supabase aplica as migrações novas sozinho |
| **Automatic branching** | desligado | Exige o plano pago (Pro) e cobra por hora |

A ligação não coloca chave no código (as chaves vão à mão para o `.env.local`), e os dados de exemplo (`seed.sql`) não
vão para o banco no merge. Para desfazer: desconectar em *Project Settings → Integrations* e revogar em
*Settings → Applications* no GitHub.

**Opções de segurança escolhidas na criação do projeto (24/10):** *Enable Data API* ligada; *Automatically expose new
tables* **desligada** (nenhuma tabela nova fica acessível pela chave pública sozinha); *Enable automatic RLS* **ligada**
(rede de proteção: toda tabela nova do `public` já nasce com as regras de acesso ligadas). Consequência para as
migrações: cada tabela que as telas usam precisa de `grant` explícito para o papel `authenticated` (e nunca para `anon`,
salvo decisão), além de ligar o RLS e criar as políticas. `ai_calls` não recebe `grant` nenhum.

**Regra:** mudança de tabela só por migração no GitHub, nunca pelo editor de tabelas ou de SQL do painel do Supabase.
Senão o banco deixa de bater com o repositório (F14). Vale para todos, inclusive o parceiro.

## Decisões tomadas (Luis, 24/10/2026)

1. **Teto do funcionário: por mês.** Renova todo dia 1º, à meia-noite no horário de Brasília. O extrato guarda tudo;
   só a conferência do teto olha os gastos do mês corrente. (O código do parceiro usava acumulado e muda no PR 3.)
2. **O que o dono vê (F05): opção (a).** Só o resumo de cada funcionário (quem fez, quando, com qual receita ou IA,
   quanto custou) e as entregas. Não lê pedidos nem respostas. O "resumo do dia" do parceiro fica desligado; se voltar,
   é refeito usando só esses dados. Passar para (b) no futuro exige aviso aos funcionários e uma migração própria.
3. **"Traga sua chave": fora do banco novo.** Nenhuma tabela guarda chave de API de empresa. Se voltar, entra numa
   migração própria.

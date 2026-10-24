# Guia: criar o projeto de testes do Supabase e testar o login

> Escrito em 24/10/2026 (etapa 5) para o Luis fazer à mão, com a ajuda do chat do Claude (claude.ai).
> **Status:** feito pelo Luis em 24/10/2026, com tudo dando o resultado esperado, e corrigido com o que ele encontrou
> pelo caminho (partes A, B, D e E). Se precisar refazer (projeto de testes apagado, ou outra pessoa montando o dela),
> o guia continua valendo; só o `git checkout feat/login` da parte E não é mais preciso, porque o login já está na `main`.
> **Para o chat do Claude:** guie o Luis uma parte de cada vez, em português simples, e espere ele confirmar antes de
> seguir. O painel do Supabase muda de vez em quando: se um nome de botão não bater, ajude a achar o equivalente pelo
> print. **Nunca peça para ele colar no chat senhas, chaves ou o endereço do banco com a senha**; isso vai só para o
> GitHub (segredo) e para o arquivo `.env.local` do computador dele.

## Para que serve

O computador do Luis não usa o banco de verdade do Supabase (`multi-ia`): usa um segundo projeto grátis, só com dados
de mentira, o `multi-ia-teste`. Assim o computador guarda só chaves de teste, e o extrato de verdade (que não deixa
apagar linhas) fica sem recargas de mentira. Detalhes em `docs/BANCO-DE-DADOS.md`, seção "Projeto de testes".

Depois de criado, ele serve para testar o **PR #29** (login de verdade): o dono cria a conta da empresa, confirma o
e-mail, entra, vê o painel e sai.

Tempo total: uns 30 minutos. Ferramentas: o navegador, o VS Code e o terminal do VS Code (abre com **Ctrl + '**).

## Antes de começar

- O merge do PR #28 já foi feito (24/10). É ele que traz o botão "Banco de testes" no GitHub.
- Tenha à mão o login do Gmail do projeto (é com ele que se entra no Supabase).
- Um lugar seguro para guardar uma senha nova (gerenciador de senhas ou um bloco de notas fora da pasta do projeto).

## Parte A — Criar o projeto (5 min)

1. Entre em https://supabase.com/dashboard com o Gmail do projeto.
2. Abra a organização `multi-ia` e clique em **New project**.
3. Preencha:
   - **Project name:** `multi-ia-teste`
   - **Region:** South America (São Paulo)
   - **Plano:** Free
   - **GitHub (optional):** deixe **vazio**. Só o projeto de verdade fica ligado ao GitHub, porque é ele que recebe as
     migrações sozinho no merge. O de testes recebe pelo workflow da parte C.
4. **Database password:** clique em *Generate a password* e copie a senha para o lugar seguro. Se ela tiver algum destes
   símbolos `@ # / : ? %`, gere outra até sair só letras e números (com símbolo, o endereço da parte C quebra).
5. Opções de segurança (iguais às do projeto de verdade):
   - *Enable Data API*: **ligada**
   - *Automatically expose new tables*: **desligada**
   - *Enable automatic RLS*: **ligada**
6. Clique em **Create new project** e espere uns 2 minutos até o projeto ficar pronto.

**Deu certo se:** o painel do `multi-ia-teste` abre, e no *Table Editor* não há tabela nenhuma (ainda).

## Parte B — Configurar o login (5 min)

No menu da esquerda, **Authentication**:

1. **URL Configuration**
   - *Site URL*: o campo vem vazio, e o **Save** só funciona depois de preenchido. Digite `http://localhost:3000` →
     **Save**
   - *Redirect URLs* → **Add URL**: `http://localhost:3000/**` → **Save**
2. **Sign In / Providers → Email** (clique em "Email" para abrir as opções)
   - *Confirm email*: **ligado**
   - *Email OTP Expiration*: `86400` (são 24 horas, em segundos)
   - *Minimum password length*: `8`
   - **Save**

**Deu certo se:** as opções continuam com esses valores depois de recarregar a página.

## Parte C — Ligar ao GitHub e criar as tabelas (5 min)

1. No projeto de testes, clique em **Connect** (no alto da página).
2. Na aba **Connection String**, escolha o tipo **Session pooler** (não o *Direct connection*: o GitHub não alcança
   esse). Copie o endereço, que começa com `postgresql://postgres.`.
3. Num bloco de notas (fora do chat), troque `[YOUR-PASSWORD]` pela senha da parte A, **sem os colchetes**.
4. No GitHub, abra o repositório `lgvoliveira/multi-ia` → **Settings → Secrets and variables → Actions → New
   repository secret**:
   - **Name:** `SUPABASE_TEST_DB_URL`
   - **Secret:** o endereço do passo 3
   - **Add secret**
5. No GitHub: **Actions** → na lista da esquerda, **Banco de testes** → botão **Run workflow** → deixe `main` →
   **Run workflow**. Espere uns 2 minutos.

**Deu certo se:** a execução fica com o símbolo verde, e no *Table Editor* do projeto de testes aparecem 11 tabelas:
`ai_calls`, `companies`, `conversations`, `custom_recipes`, `files`, `members`, `run_events`, `runs`, `tasks`,
`wallet_entries` e `wallet_holds`. Todas vazias. (Depois do PR do convite, são 12: entra também `member_invites`.)

**Se ficar vermelho:** clique na execução, depois em "Aplicar as migrações" e leia a última mensagem.
- "Falta o segredo SUPABASE_TEST_DB_URL": o nome do segredo está diferente (confira letra por letra) ou ele não foi salvo.
- "password authentication failed": a senha no endereço está errada, ou ficaram os colchetes.
- "network is unreachable" ou "no route to host": foi copiado o *Direct connection*; volte ao passo 2 e use o *Session pooler*.
- Para corrigir o segredo: **Settings → Secrets and variables → Actions → SUPABASE_TEST_DB_URL → Update**, e rode de novo.
- Se não der para resolver, anote a mensagem (sem a senha) para levar ao Claude Code.

## Parte D — Chaves no computador (5 min)

1. No projeto de testes, clique em **Connect → App Frameworks** e escolha **Next.js**. Aparecem duas linhas prontas:
   `NEXT_PUBLIC_SUPABASE_URL=...` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...` (a segunda começa com `sb_publishable_`).
   Se a tela mostrar um nome diferente para a segunda (ex.: `..._ANON_KEY`), use o valor dela com o nome
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. A chave secreta fica em **Project Settings → API Keys → Secret keys**: clique no olho para ver e copie (começa com
   `sb_secret_`). Ela é a chave-mestra do banco de testes: só vai para o `.env.local`.
3. No VS Code, abra o arquivo `.env.local` na raiz da pasta do projeto. Ele já existe e é ignorado pelo Git. Acrescente
   no fim, cada uma na sua linha e sem espaços em volta do `=`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://....supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   SUPABASE_SECRET_KEY=sb_secret_...
   ```
4. Se o arquivo tiver linhas `NEXT_PUBLIC_SUPABASE_ANON_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` (do banco antigo do
   parceiro), apague essas linhas.
5. Salve: **clique dentro do arquivo** e aperte **Ctrl + S**. Sem o clique, o Ctrl + S pode ir para o terminal, e o
   arquivo não é salvo. Confira que a bolinha branca ao lado do nome, na aba do arquivo, sumiu.

**Deu certo se:** o arquivo tem as três linhas preenchidas e a aba está sem a bolinha. Ninguém além de você vê esse
arquivo. Se o site mostrar "faltam as chaves do Supabase", o arquivo não foi salvo: volte ao passo 5.

## Parte E — Testar o login (10 min)

1. O terminal em que o Claude Code está rodando fica ocupado. Abra um **terminal novo**: no menu do VS Code,
   **Terminal → New Terminal** (ou o **+** no canto do painel do terminal). Nele, na pasta do projeto:
   ```
   git checkout feat/login
   git pull
   npm install
   npm run dev
   ```
   O primeiro comando põe a pasta na versão do PR #29. O `npm install` traz a biblioteca nova do login e o Next.js
   16.4.3. Espere aparecer "Ready" e abra http://localhost:3000.
2. Clique em **Criar a conta da empresa**. Preencha:
   - o nome da empresa (pode ser inventado);
   - o seu nome;
   - o **Gmail do projeto** (o Supabase grátis só manda e-mail para quem é da equipe do projeto, e no máximo 2 por hora);
   - uma senha de 8 caracteres ou mais.

   **Esperado:** "Confira o seu e-mail".
3. Abra o e-mail **no computador, no mesmo navegador**, e clique no link. O e-mail vem em inglês: é o modelo padrão do
   Supabase.
   - O link volta para `localhost`, que só existe no seu computador. Se abrir no celular, a página não carrega, mas o
     e-mail fica confirmado do mesmo jeito: é só ir em **Entrar** no computador.

   **Esperado:** abre o **Painel do dono**, com o nome da empresa e você na equipe, com a etiqueta "Dono". No topo
   aparecem o seu nome, a empresa e o botão **Sair**.
4. No painel do Supabase, em *Table Editor*: `companies` tem 1 linha e `members` tem 1 linha (com `role` = `owner`).
5. Clique em **Sair** e depois em **Entrar**.

   **Esperado:** com uma senha errada, aparece "E-mail ou senha incorretos"; com a senha certa, você volta ao painel.
6. Logado, abra http://localhost:3000/trabalho.

   **Esperado:** "Em obras", com um link para o painel.
7. Clique em **Sair** e abra http://localhost:3000/dono.

   **Esperado:** você é mandado para **Entrar**.
8. **Extra (opcional), o "desativado":** no *Table Editor*, na tabela `members`, mude o seu `status` para `disabled`.
   Recarregue a página do site.

   **Esperado:** "Seu acesso foi desativado". Depois, volte o `status` para `active`. Editar dados assim é só para o
   projeto de testes.
9. Para desligar o site: **Ctrl + C** no terminal.

**Se algo não sair como esperado:** tire um print da tela e copie o texto que apareceu no terminal do `npm run dev`
(confira que não tem nenhuma chave nele). Não faça o merge do #29; leve o print e o texto para o Claude Code.

## Parte F — Depois do teste

- **Se tudo funcionou:** faça o merge do **PR #29** no GitHub. Depois, no terminal:
  ```
  git checkout main
  git pull
  npm install
  ```
- Volte ao Claude Code contando como foi (veja abaixo).

**O que contar ao voltar:**
- se as 11 tabelas apareceram no projeto de testes (parte C);
- quais passos da parte E deram o resultado esperado e quais não (com print e o texto do terminal);
- se fez o merge do #29;
- qualquer tela do Supabase que estava diferente do guia (para corrigir este arquivo).

**Bom saber:**
- Projeto grátis parado por 7 dias é pausado. Para voltar, use *Restore project* no painel do projeto.
- Nas checagens dos PRs aparece "Supabase Preview: skipping". É normal: é a cópia automática do banco por PR, que
  ficou desligada porque é paga.

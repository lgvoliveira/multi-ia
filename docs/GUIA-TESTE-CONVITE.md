# Guia: testar o convite de funcionário (PR 2b)

> Escrito em 24/10/2026 (etapa 5) para o Luis fazer à mão, com a ajuda do chat do Claude (claude.ai). Atualizado no
> mesmo dia, depois do primeiro teste: a janela anônima explicada (Parte C) e a Parte H, do aviso de troca de login.
> **Para o chat do Claude:** guie o Luis uma parte de cada vez, em português simples, e espere ele confirmar antes de
> seguir. Se uma tela não bater com o guia, ajude pelo print. **Nunca peça para ele colar no chat senhas, chaves ou o
> link do convite** (o link funciona como uma senha de uso único). As partes A a G já foram feitas (PR #30, no ar);
> se o Luis veio testar o aviso de troca de login, vá direto à **Parte H**.

## Para que serve

Conferir, no computador do Luis e com o projeto de testes do Supabase, o que o PR 2b trouxe: o dono convida um
funcionário, manda o link, o funcionário cria a própria senha e entra; o dono muda o teto, desativa, reativa e gera um
link de senha nova. Nenhum e-mail é mandado: o link vai do dono para a pessoa (no teste, você mesmo abre).

Tempo total: uns 20 minutos. Ferramentas: o navegador (Chrome, Edge ou Opera GX) e o terminal do VS Code.

## Antes de começar

- O projeto de testes (`multi-ia-teste`) já tem a tabela nova, `member_invites`: o Claude rodou o workflow "Banco de
  testes" no branch do PR em 24/10. No *Table Editor* do projeto de testes aparecem agora 12 tabelas.
- Ali também há empresas de teste criadas pelo Claude ("Empresa de teste do Claude", com e-mails `@example.com`).
  São dados de mentira e podem ficar; não atrapalham.
- Tenha à mão a senha da conta de dono que você criou no teste do login (com o Gmail do projeto).

## Parte A — Pôr o site na versão do PR (3 min)

1. Abra um **terminal novo** no VS Code (menu **Terminal → New Terminal**; o do Claude Code fica ocupado). Nele:
   ```
   git checkout feat/convite
   git pull
   npm run dev
   ```
   Não precisa de `npm install`: o PR não trouxe biblioteca nova. Espere aparecer "Ready".
2. Abra http://localhost:3000 e entre com a sua conta de dono.

**Deu certo se:** o Painel do dono mostra a parte nova **"Convidar um funcionário"**, acima da Equipe.

## Parte B — Convidar (3 min)

1. Em "Convidar um funcionário", preencha:
   - **Nome:** `Ana Teste`
   - **E-mail:** um inventado, por exemplo `ana.teste@example.com` (nenhum e-mail é mandado; é só o nome de entrada)
   - **Teto do mês:** `50`
2. Clique em **Gerar o link do convite**.

**Deu certo se:** aparece a caixa verde "Convite criado para Ana", com o link, os botões **Copiar o link** e **Mandar
pelo WhatsApp**; e na Equipe aparece a Ana com "Teto de R$ 50,00 por mês" e a etiqueta **Convite pendente**.

3. Clique em **Copiar o link**. O botão muda para "Link copiado!".
4. (Opcional) **Mandar pelo WhatsApp** abre o WhatsApp com a mensagem pronta. Não precisa mandar para ninguém.
5. (Opcional) Clique em **Convidar outra pessoa** e tente o mesmo e-mail da Ana: aparece "Esta pessoa já está na equipe".

## Parte C — Aceitar como a funcionária (4 min)

1. Abra uma **janela anônima**: **Ctrl + Shift + N** no Chrome, no Edge e no Opera GX (no Opera ela se chama "janela
   privada"; no Firefox, o atalho é Ctrl + Shift + P). **Não use outra aba normal.**

   **Por quê:** o "estar conectado" fica guardado no navegador (num *cookie*, um crachá que o site deixa com ele), e
   todas as abas normais dividem o mesmo crachá. Se a funcionária entrar numa aba normal, o navegador inteiro passa a
   estar conectado como ela, **inclusive a aba do dono**, sem nada mudar na tela; os botões do painel passam a pedir
   com o crachá dela, e o servidor recusa. A janela anônima guarda o crachá à parte, como se fosse outro navegador: o
   dono continua conectado na janela normal. Atenção: as janelas anônimas abertas ao mesmo tempo dividem um crachá
   entre elas. Para testar duas funcionárias de uma vez, use um segundo navegador.
2. Cole o link na barra de endereço e abra.

   **Esperado:** "Convite para a equipe", o nome da sua empresa, "Olá, Ana!" e o e-mail dela já preenchido (cinza).
3. Digite uma senha nos dois campos, mas **diferentes** de propósito, e clique em **Aceitar o convite e entrar**.

   **Esperado:** "As duas senhas não são iguais. Digite de novo."
4. Digite a mesma senha nos dois (8 caracteres ou mais) e clique de novo. Guarde essa senha por enquanto.

   **Esperado:** abre a página "Em obras", com "Ana Teste" e a sua empresa no topo.
5. Na mesma janela anônima, cole o link de novo.

   **Esperado:** "Este link não vale mais" (o link só funciona uma vez).

## Parte D — O que o dono faz com a equipe (5 min)

Na janela normal (o dono), recarregue a página (**F5**).

1. **Esperado:** a etiqueta "Convite pendente" da Ana sumiu.
2. **Mudar teto** → apague e digite `80` → **Salvar**. **Esperado:** "Teto de R$ 80,00 por mês".
3. **Desativar** → leia o aviso → **Desativar Ana**. **Esperado:** etiqueta "Desativado" e um botão **Reativar**.
4. Na janela anônima, recarregue. **Esperado:** "Seu acesso foi desativado".
5. Na janela normal, **Reativar**. Na anônima, abra http://localhost:3000. **Esperado:** volta para "Em obras".

## Parte E — Link de senha nova (4 min)

Para quem perdeu a senha.

1. Na janela normal, no cartão da Ana: **Gerar link novo** → leia o aviso → **Gerar o link** → **Copiar o link**.

   **Esperado:** caixa "Link de senha nova para Ana" e a etiqueta **Senha nova pendente** no cartão.
2. Na janela anônima, abra o link novo. **Esperado:** "Senha nova". Crie uma senha **diferente** da anterior e clique em
   **Salvar a senha e entrar**. **Esperado:** "Em obras".
3. Na janela anônima, clique em **Sair** e depois em **Entrar**, com o e-mail da Ana:
   - com a senha **antiga**: "E-mail ou senha incorretos";
   - com a senha **nova**: entra.

## Parte F — Olhar o banco (2 min, opcional)

No painel do Supabase, projeto de testes, *Table Editor*:
- `members`: a Ana aparece com `role` = `employee` e `monthly_budget_cents` = `8000` (os R$ 80,00 em centavos).
- `member_invites`: enquanto há um link sem uso, uma linha com um `token_hash` comprido. Ele é só um "resumo" do código:
  o link em si não fica guardado em lugar nenhum. Depois que o link é usado, a linha some.

Para desligar o site: **Ctrl + C** no terminal do `npm run dev`. Feche a janela anônima.

**Se algo não sair como esperado:** tire um print da tela e copie o texto que apareceu no terminal do `npm run dev`
(confira que não tem nenhuma chave nem link de convite nele). Não faça o merge; leve o print e o texto para o Claude Code.

## Parte G — Depois do teste

- **Se tudo funcionou:** faça o merge do PR do convite no GitHub. Depois, no terminal:
  ```
  git checkout main
  git pull
  ```
- No merge, o Supabase aplica a migração nova no projeto **de verdade** sozinho. Uns minutos depois, confira no *Table
  Editor* do `multi-ia` (o de verdade) que apareceu a tabela `member_invites` (12 tabelas, todas vazias).

**O que contar ao voltar ao Claude Code:**
- quais passos deram o resultado esperado e quais não (com print e o texto do terminal);
- se fez o merge, e se a tabela `member_invites` apareceu no projeto de verdade;
- qualquer tela diferente do guia, ou texto confuso (para corrigir).

## Parte H — O aviso de troca de login (PR novo, 6 min)

Depois do primeiro teste, o Claude fez um PR pequeno (issue #31, falha F34): se o navegador trocou de conta enquanto o
painel do dono estava aberto, os botões da Equipe não mudam nada e o painel avisa o que houve, em vez de pular para a
tela do funcionário. Aqui você faz **de propósito** o que aconteceu por acaso: tudo em abas normais, sem janela anônima.

1. Se o site estiver rodando, pare-o com **Ctrl + C** no terminal dele. Depois, nesse terminal (ou num novo, menu
   **Terminal → New Terminal**):
   ```
   git fetch
   git checkout fix/aviso-troca-de-login
   npm run dev
   ```
   Espere aparecer "Ready". Feche as janelas anônimas que estiverem abertas.
2. Numa janela normal, abra http://localhost:3000 e entre como dono.
3. Convide alguém novo: **Nome** `Bruno Teste`, **E-mail** `bruno.teste@example.com`, teto vazio. **Copiar o link**.
4. Abra uma **aba normal nova** (**Ctrl + T**), cole o link e abra.

   **Esperado:** o convite já avisa "Neste navegador, quem está conectado é Luis. Ao continuar, essa conta sai e você
   entra com a sua."
5. Crie a senha do Bruno (igual nos dois campos) e clique em **Aceitar o convite e entrar**. **Esperado:** "Em obras".
6. Volte à aba do dono **sem recarregar**. No cartão do Bruno: **Desativar** → **Desativar Bruno**.

   **Esperado:** a aba continua no painel, com o aviso vermelho "Nada foi mudado. Neste navegador, quem está conectado
   agora é Bruno Teste…". O cartão do Bruno **não** ganha a etiqueta "Desativado".
7. Na aba do Bruno, clique em **Sair**. Volte à aba do dono e clique em **Desativar Bruno** de novo.

   **Esperado:** "Nada foi mudado. A sua conta de dono não está mais conectada neste navegador…".
8. Na aba do dono, clique em **Sair** (no topo) e entre de novo como dono. **Desativar** → **Desativar Bruno**.

   **Esperado:** agora funciona: etiqueta "Desativado" e o botão **Reativar**. (O Bruno pode ficar desativado: é um
   cadastro de teste.)

**Se tudo funcionou:** faça o merge do PR do aviso no GitHub e, no terminal, `git checkout main` e `git pull`. Esse PR
não muda o banco: nada a conferir no Supabase.

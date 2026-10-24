# Guia: testar as receitas com login (PR 3a)

> Escrito em 24/10/2026 (etapa 5, parte 3a do PR 3) para o Luis fazer à mão, com a ajuda do chat do Claude
> (claude.ai). **Para o chat do Claude:** guie o Luis uma parte de cada vez, em português simples, e espere ele
> confirmar antes de seguir. Se uma tela não bater com o guia, ajude pelo print. **Nunca peça para ele colar no chat
> senhas, chaves ou o link do convite** (o link funciona como uma senha de uso único).

## Para que serve

Conferir, no computador do Luis e com o projeto de testes do Supabase, o que a parte 3a trouxe: a receita "Criar um
site" voltou a funcionar, agora em nome de quem está logado. O texto das IAs aparece enquanto elas escrevem, Cancelar
para o time na hora e a página "Minhas chaves" saiu.

**Importante:** as receitas ainda rodam com a **IA simulada**, que não custa nada e sempre devolve o mesmo site de
exemplo (a confeitaria "Doce Encanto"), seja qual for o pedido. As IAs de verdade entram com a cobrança, na parte 3b.

Tempo total: uns 20 minutos. Ferramentas: o navegador (Chrome, Edge ou Opera GX) e o terminal do VS Code.

## Antes de começar

- Este PR **não muda o banco** (nenhuma migração nova) e **não traz biblioteca nova**: não precisa rodar o workflow
  "Banco de testes" nem `npm install`.
- Não precisa mexer no `.env.local`. (A variável `INTERNAL_RUN_SECRET`, que o código antigo pedia, não é mais usada.)
- Tenha à mão a senha da sua conta de dono no projeto de testes.

## Parte A — Pôr o site na versão do PR (3 min)

1. Se o site estiver rodando num terminal, pare com **Ctrl + C**. Num **terminal novo** do VS Code (menu **Terminal →
   New Terminal**; o do Claude Code fica ocupado):
   ```
   git checkout feat/receitas-com-login
   git pull
   npm run dev
   ```
   Espere aparecer "Ready".
2. Abra http://localhost:3000 e entre com a sua conta de dono.

**Deu certo se:** o Painel do dono abre normalmente.

## Parte B — Uma funcionária para o teste (4 min)

1. No painel, em "Convidar um funcionário": **Nome** `Carla Teste`, **E-mail** `carla.teste@example.com` (inventado;
   nenhum e-mail é mandado), **Teto do mês** vazio. Clique em **Gerar o link do convite** e depois em **Copiar o link**.
2. Abra uma **janela anônima** (**Ctrl + Shift + N**; no Opera GX, "janela privada"), cole o link, crie uma senha
   (digitada duas vezes) e entre.

**Deu certo se:** a janela anônima mostra "Olá, Carla!", com o aviso **Em obras** (o chat ainda não voltou) e o link
novo **Abrir a receita "Criar um site"**.

Se o e-mail já tiver sido usado num teste anterior, troque por outro (ex.: `carla2.teste@example.com`).

## Parte C — Rodar a receita (3 min)

1. Na janela anônima, clique em **Abrir a receita "Criar um site"**.
2. Escreva um pedido qualquer (ex.: "Quero um site para a minha confeitaria") e clique em **Começar**.

**Deu certo se:**
- aparece "Seu time está trabalhando", e o texto do **Chefe · Claude** vai aparecendo **aos pouquinhos**, com o cartão
  ainda em **Trabalhando…** (antes deste PR, o texto só aparecia quando a fase inteira terminava);
- as fases seguem sozinhas (o Programador, o Revisor...), e em uns 30 segundos aparece **"Seu site está pronto"**, com
  **"Concluído em"** perto do tempo que você esperou;
- a prévia mostra o site da "Doce Encanto Confeitaria".

3. Aperte **F5** (recarregar). **Deu certo se:** o site pronto aparece de novo.

## Parte D — Cancelar no meio (2 min)

1. Clique em **Começar de novo**, escreva um pedido e clique em **Começar**.
2. Assim que o texto do Chefe começar a aparecer, clique em **Cancelar**.

**Deu certo se:** aparece **"Você cancelou"**, e, esperando uns 10 segundos, nada mais muda na tela.

## Parte E — Sair da página no meio (2 min)

1. Clique em **Começar de novo**, peça de novo e clique em **Começar**.
2. Logo depois, clique em **Trabalho** (no caminho, acima do título) para sair da receita. Espere uns 10 segundos.
3. Clique de novo em **Abrir a receita "Criar um site"**.

**Deu certo se:** a tela volta a acompanhar a mesma execução (o time continuou trabalhando no servidor) e chega ao
"Seu site está pronto".

## Parte F — Login trocado em outra aba (4 min)

Este é o mesmo cuidado do painel do dono (F34), agora nas receitas.

1. Na janela anônima (Carla), clique em **Começar de novo**, peça e clique em **Começar**.
2. **Na mesma janela anônima**, abra uma aba nova (**Ctrl + T**), vá a http://localhost:3000, clique em **Sair** e
   entre com a sua conta de **dono**.
3. Volte para a aba da receita da Carla, **sem recarregar**.

**Deu certo se:**
- em poucos segundos aparece o aviso vermelho **"Não dá para continuar acompanhando aqui: neste navegador, outra conta
  entrou…"**;
- clicando em **Cancelar**, aparece **"Nada foi feito. Neste navegador, quem está conectado agora é [seu nome]…"**, e a
  tela **não** mostra "Você cancelou" (o time da Carla continua no servidor).

4. Para voltar: na aba nova, **Sair** e entrar de novo como a Carla. Abrindo a receita, aparece o site pronto da
   execução que continuou.

## Parte G — "Minhas chaves" saiu (1 min)

1. Abra http://localhost:3000/chaves.

**Deu certo se:** aparece a página "não encontrada", em português.

## Parte H — Depois do teste

- **Se tudo funcionou:** faça o merge do PR no GitHub. Depois, no terminal:
  ```
  git checkout main
  git pull
  ```
  Este PR não muda o banco, então nada muda no projeto de verdade do Supabase.
- A Carla e as execuções de teste podem ficar no projeto de testes: são dados de mentira.

**O que contar ao voltar ao Claude Code:**
- quais passos deram o resultado esperado e quais não (com print e o texto do terminal);
- se o texto apareceu aos poucos (Parte C) e quanto tempo o "Concluído em" mostrou;
- se fez o merge;
- qualquer tela diferente do guia, ou texto confuso (para corrigir).

# Guia: testar as receitas cobrando (PR 3b)

> Escrito em 25/10/2026 (etapa 5, parte 3b do PR 3) para o Luis fazer à mão, com a ajuda do chat do Claude
> (claude.ai). **Para o chat do Claude:** guie o Luis uma parte de cada vez, em português simples, e espere ele
> confirmar antes de seguir. Se uma tela não bater com o guia, ajude pelo print. **Nunca peça para ele colar no chat
> senhas, chaves, o e-mail dele ou o link de um convite.** Todo SQL deste guia roda no projeto **de testes** do Supabase
> (`multi-ia-teste`), nunca no de verdade (`multi-ia`).

## Para que serve

Conferir, no computador do Luis e com o projeto de testes do Supabase, o que a parte 3b trouxe: a receita "Criar um
site" passa a gastar o crédito da empresa.
- Antes de começar, a tela mostra o **custo estimado**, que é o máximo que o time pode gastar.
- O servidor **reserva** esse valor do saldo da empresa.
- Cada etapa concluída vira **uma linha de gasto** no extrato.
- No fim, a reserva fecha e o que sobrou volta para o saldo.
- Se o custo for passar do reservado, o time **pausa** e pergunta.

**Importante:** as receitas ainda rodam com a **IA simulada**. Ela devolve sempre o mesmo site de exemplo (a confeitaria
"Doce Encanto"), mas agora "custa" o mesmo que a IA de verdade custaria. O dinheiro é de mentira: um crédito que você
mesmo vai colocar na empresa do projeto de testes (Parte C).

Tempo total: uns 30 minutos.

Ferramentas:
- o navegador (Chrome, Edge ou Opera GX);
- o terminal do VS Code;
- o painel do Supabase (supabase.com, projeto `multi-ia-teste`).

## Antes de começar

- Este PR **não muda o banco** (nenhuma migração nova) e **não traz biblioteca nova**: não precisa rodar o workflow
  "Banco de testes" nem `npm install`.
- Tenha à mão a senha da sua conta de dono no projeto de testes e a da funcionária Carla Teste (do guia anterior). Se
  não lembrar a da Carla, convide outra funcionária, como na Parte B do `GUIA-TESTE-RECEITAS.md`.

## Parte A: pôr o site na versão do PR (3 min)

1. Se o site estiver rodando num terminal, pare com **Ctrl + C**.
2. Abra um **terminal novo** do VS Code (menu **Terminal → New Terminal**; o do Claude Code fica ocupado) e rode:
   ```
   git checkout feat/receitas-cobrando
   git pull
   npm run dev
   ```
   Espere aparecer "Ready".
3. Abra uma **janela anônima** (**Ctrl + Shift + N**; no Opera GX, "janela privada"), vá a http://localhost:3000 e entre
   como a **Carla**.

**Deu certo se:** aparece "Olá, Carla!" com o link **Abrir a receita "Criar um site"**.

## Parte B: a estimativa e a recusa sem saldo (4 min)

1. Clique em **Abrir a receita "Criar um site"**.
2. Olhe embaixo do botão **Começar**.

**Deu certo se:** aparece **"Custo estimado: até R$ 5,31"** e, embaixo, "Você paga só o que o time usar; o que sobrar
volta para o saldo da empresa." O botão "+ Adicionar agente" não existe mais.

3. Troque a IA do **Front-end** para **Gemini**.

**Deu certo se:** a estimativa cai para **até R$ 3,54**. Volte o Front-end para **GPT (recomendada)**: volta a R$ 5,31.

4. Escreva um pedido qualquer e clique em **Começar**.

**Deu certo se:** aparece, em vermelho: **"A empresa não tem saldo para reservar R$ 5,31, o máximo que o time pode
gastar. Peça ao dono da empresa para colocar crédito."** e o time não começa. (No projeto de testes, nenhuma empresa tem
crédito ainda.)

## Parte C: colocar crédito de mentira na empresa (5 min)

A recarga só acontece pelo editor de SQL do Supabase, de propósito: nem as telas nem o nosso servidor conseguem criar
crédito (F25). No projeto de verdade, isso só vai acontecer depois de receber o Pix de uma empresa.

1. No painel do Supabase, abra o projeto **`multi-ia-teste`** (confira o nome no topo). No menu da esquerda, clique em
   **SQL Editor** e depois em **New query**.
2. Cole o comando abaixo, **troque `SEU-EMAIL` pelo e-mail da sua conta de dono** (só no editor, não no chat) e clique em
   **Run**:
   ```sql
   select c.id, c.name
   from public.companies c
   join public.members m on m.company_id = c.id
   where m.email = 'SEU-EMAIL' and m.role = 'owner';
   ```
   Aparece uma linha com o **id** da sua empresa de testes (um código comprido) e o nome dela.
3. Apague o comando, cole este, **troque `ID-DA-EMPRESA` pelo id da linha acima** (mantendo as aspas simples) e clique em
   **Run**:
   ```sql
   select private.wallet_topup('ID-DA-EMPRESA', 2000, 'Crédito de teste (guia da cobrança)');
   ```

**Deu certo se:** o resultado é **2000**, ou seja, R$ 20,00 de saldo (o valor é em centavos).

Deixe essa aba do Supabase aberta: ela volta nas próximas partes.

## Parte D: uma receita cobrando do começo ao fim (4 min)

1. Na janela anônima (Carla), escreva um pedido e clique em **Começar**.

**Deu certo se:**
- o time trabalha como antes, e embaixo do título aparece **"Gasto até agora: R$ …"**, que sobe a cada fase
  (com "reservado ao começar: até R$ 5,31");
- em uns 30 segundos aparece **"Seu site está pronto"**, com **"Concluído em … · Custou R$ 0,37"** (pode variar alguns
  centavos com o tamanho do pedido).

2. No editor de SQL, rode:
   ```sql
   select description, amount_cents, provider, created_at
   from public.wallet_entries
   where kind = 'charge'
   order by id desc
   limit 6;
   ```

**Deu certo se:** aparecem **6 linhas de gasto**, uma por etapa ("Criar um site · Chefe", "· Front-end", "· Back-end",
"· Pesquisador", "· Revisão do chefe", "· Montagem final"). Cada linha tem um valor negativo, em centavos, e a IA que fez
a etapa. O seu pedido não aparece em nenhuma linha.

3. Rode também:
   ```sql
   select amount_cents, charged_cents, status
   from public.wallet_holds
   order by created_at desc
   limit 1;
   ```

**Deu certo se:** a reserva mais recente tem `amount_cents` **531** (o máximo reservado), `charged_cents` igual ao que
apareceu em "Custou" (uns 37) e `status` **closed**. A diferença voltou para o saldo da empresa.

## Parte E: cancelar no meio (2 min)

1. Clique em **Começar de novo**, escreva um pedido e clique em **Começar**.
2. Assim que o texto do Chefe começar a aparecer, clique em **Cancelar**.

**Deu certo se:** aparece **"Você cancelou"** e, embaixo, **"Custou R$ 0,00, só pelas etapas concluídas. O resto da
reserva voltou para o saldo da empresa."** Se o Chefe tiver terminado antes do clique, aparece só o valor dele (uns
R$ 0,04).

3. No editor de SQL, rode de novo a consulta das reservas (passo 3 da Parte D).

**Deu certo se:** a reserva mais recente está **closed**.

## Parte F: a pausa quando o custo passa do previsto (6 min)

Com a estimativa pelo máximo, o custo quase nunca passa dela. Para ver a pausa, um interruptor de teste faz o Claude
simulado "gastar" 10 vezes mais que o limite de cada etapa.

1. No VS Code, abra o arquivo **`.env.local`** (na raiz do projeto). No fim, acrescente a linha:
   ```
   MOCK_AI_OVERSPEND=claude
   ```
   e salve (**Ctrl + S**). No terminal do site aparece "Reload env".
2. Na janela anônima, clique em **Começar de novo**, escreva um pedido e clique em **Começar**.

**Deu certo se:** depois que o Chefe termina o plano, o título muda para **"O time está esperando você"**, com um quadro
amarelo:
- "O custo vai passar do que foi reservado, então o time parou antes da próxima fase. Até aqui, ele gastou R$ 1,00."
  (pode variar um ou dois centavos com o tamanho do pedido)
- "Para terminar, é preciso reservar até **R$ 4,52** do saldo da empresa."
- os botões **Continuar** e **Parar aqui**.

3. Clique em **Continuar**.

**Deu certo se:** o time volta a trabalhar, termina sem pausar de novo e mostra **"Custou R$ 3,53"**, alguns centavos a
mais ou a menos (mais caro, por causa do interruptor).

4. Clique em **Começar de novo**, peça de novo e clique em **Começar**. Na pausa, clique em **Parar aqui**.

**Deu certo se:** aparece **"Você cancelou"** e "Custou R$ 1,00, só pelas etapas concluídas": só o plano do Chefe, de
novo com um ou dois centavos de diferença.

5. **Desligue o interruptor:** no `.env.local`, apague a linha `MOCK_AI_OVERSPEND=claude` e salve.

## Parte G: o teto do mês (4 min)

1. Numa **janela normal** (não a anônima), vá a http://localhost:3000 e entre com a sua conta de **dono**.
2. No painel, no cartão da Carla, clique em **Mudar teto**, escreva **1,00** e clique em **Salvar**.
3. Volte à janela anônima (Carla), clique em **Começar de novo**, peça e clique em **Começar**.

**Deu certo se:** aparece em vermelho **"Reservar R$ 5,31, o máximo que o time pode gastar, passaria do seu teto do mês.
Peça ao dono da empresa para aumentar o seu teto."** e o time não começa.

4. No painel do dono, clique em **Mudar teto** no cartão da Carla, **apague o valor** (vazio = sem teto) e clique em
   **Salvar**.

## Parte H: depois do teste

- **Se tudo funcionou:** faça o merge do PR no GitHub. Depois, no terminal:
  ```
  git checkout main
  git pull
  ```
  Este PR não muda o banco, então nada muda no projeto de verdade do Supabase.
- O crédito de mentira e as linhas de gasto podem ficar no projeto de testes. O extrato não pode ser apagado, de
  propósito: nem no teste.
- Confira se a linha `MOCK_AI_OVERSPEND` saiu do `.env.local` (Parte F, passo 5).

**O que contar ao voltar ao Claude Code:**
- quais passos deram o resultado esperado e quais não (com print e o texto do terminal);
- os valores que apareceram em "Custo estimado", "Custou" e na pausa;
- se fez o merge;
- qualquer tela diferente do guia, ou texto confuso (para corrigir).

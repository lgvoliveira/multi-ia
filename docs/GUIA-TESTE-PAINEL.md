# Guia: testar o painel do dono (PR 3d)

> Escrito em 25/10/2026 (etapa 5, parte 3d do PR 3, PR #45, ainda **fora** da `main`) para o Luis fazer à mão, com a
> ajuda do chat do Claude (claude.ai). **Para o chat do Claude:** guie o Luis uma parte de cada vez, em português
> simples, e espere ele confirmar antes de seguir. Se uma tela não bater com o guia, ajude pelo print. **Nunca peça para
> ele colar no chat senhas, chaves, o e-mail dele ou o link de um convite.** Todo SQL deste guia roda no projeto **de
> testes** do Supabase (`multi-ia-teste`), nunca no de verdade (`multi-ia`).

## Para que serve

Conferir, no computador do Luis e com o projeto de testes do Supabase, o que a parte 3d trouxe:
- **No painel do dono (`/dono`):** no alto, o **crédito da empresa** ("Disponível para a equipe", o saldo, o que está
  separado agora e o gasto do mês dividido por IA); na **Equipe**, o gasto do mês de cada pessoa contra o teto, o resumo
  do que fez e **"Ver o que fez"** (as linhas do mês e as entregas, para baixar); e o **Extrato do mês**, com as recargas.
- **Uma receita vira uma linha só** ("Criar um site", com as IAs que trabalharam), no painel e no Meus gastos.
- **O site da receita vira entrega:** aparece na aba Entregas da Carla e no painel, e baixa como arquivo.
- **O funcionário lê o que o dono vê:** "O dono da empresa vê suas entregas e quanto cada tarefa custou. Suas
  conversas, não."
- **O nome dos documentos do chat** (PDF, Word, Excel) passa a vir do que a IA escreveu, nunca do pedido (falha F49).

O dono **nunca** vê pedidos, respostas ou conversas: nem no painel, nem pelo banco.

Tudo continua com a **IA simulada** (ela "custa" o mesmo que a IA de verdade custaria).

Tempo total: uns 35 minutos.

Ferramentas: o navegador (com uma janela normal e uma anônima), o terminal do VS Code e o painel do Supabase
(supabase.com, projeto `multi-ia-teste`).

## Antes de começar

- **Não faça o merge do PR #45 antes de terminar este guia.**
- Este PR traz **uma migração** (as contas do mês, feitas dentro do banco). O Claude já a mandou para o projeto de testes
  (workflow "Banco de testes", rodado no branch do PR): você não precisa rodar nada.
- Não há biblioteca nova: não precisa de `npm install`.
- Tenha à mão a senha da sua conta de dono e a da funcionária **Carla Teste**, no projeto de testes.

## Parte A: pôr o site na versão do PR (3 min)

1. Se o site estiver rodando num terminal, pare com **Ctrl + C**.
2. Num **terminal novo** do VS Code (menu **Terminal → New Terminal**), rode:
   ```
   git fetch
   git checkout feat/painel-do-dono
   git pull
   npm run dev
   ```
   Espere aparecer "Ready".
3. Numa **janela normal**, vá a http://localhost:3000 e entre com a sua conta de **dono**.

**Deu certo se:** abre o **Painel do dono**, sem o aviso amarelo "Em obras".

## Parte B: o crédito da empresa (3 min)

Olhe o primeiro cartão, **Crédito da empresa**.

**Deu certo se:**
- aparece **"Disponível para a equipe"** com um valor grande (o que sobrou da recarga de R$ 20,00 do teste da cobrança);
- embaixo, **"Saldo R$ …"**. Se alguém estiver com uma receita ou mensagem em andamento, aparece também
  "· R$ … separado agora para tarefas em andamento" (normalmente não aparece);
- **"Gasto da empresa neste mês: R$ …"**, com uma barra colorida (laranja = Claude, verde = GPT, azul = Gemini) e, embaixo
  dela, cada IA com o nome e o valor;
- no fim do cartão, **"Para colocar crédito, fale com a nossa equipe…"**;
- **não** aparece o aviso vermelho "A empresa está sem crédito".

Anote o **Disponível**, o **Saldo** e o **Gasto da empresa neste mês**: a Parte C confere os três no banco.

## Parte C: conferir as contas no banco (4 min)

1. No painel do Supabase, abra o projeto **`multi-ia-teste`** (confira o nome no topo) e clique em **SQL Editor**.
2. Primeiro, o nome exato da sua empresa de teste:
   ```sql
   select name from public.companies order by created_at;
   ```
   Nos comandos abaixo, troque **OCK** pelo nome dela, se for outro.
3. Cole e rode (Run):
   ```sql
   with empresa as (select id from public.companies where name = 'OCK'),
   mes as (select date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' as inicio)
   select
     (select sum(e.amount_cents) from public.wallet_entries e where e.company_id = (select id from empresa)) as saldo,
     (select coalesce(sum(greatest(h.amount_cents - h.charged_cents, 0)), 0) from public.wallet_holds h
       where h.company_id = (select id from empresa) and h.status = 'open' and h.expires_at > now()) as reservado,
     (select coalesce(-sum(e.amount_cents), 0) from public.wallet_entries e
       where e.company_id = (select id from empresa) and e.member_id is not null
         and e.kind in ('charge', 'adjustment') and e.created_at >= (select inicio from mes)) as gasto_do_mes;
   ```

**Deu certo se** (os valores vêm em centavos: 1534 = R$ 15,34):
- **saldo** = o Saldo do painel;
- **saldo − reservado** = o Disponível do painel (com o reservado em 0, os dois são iguais);
- **gasto_do_mes** = o Gasto da empresa neste mês.

## Parte D: a equipe e o "Ver o que fez" (5 min)

Desça até **Equipe**.

**Deu certo se**, no cartão da Carla:
- aparece **"Gasto do mês: R$ … · sem teto"** (ou "de R$ …" com uma barra, se ela tiver teto);
- embaixo, **"Neste mês: … tarefas rápidas, … receitas, … entregas"**;
- a etiqueta antiga "Teto de R$ … por mês" sumiu (o teto aparece no "Gasto do mês").

1. Clique em **Ver o que fez** no cartão da Carla.

**Deu certo se:**
- o botão vira **"Esconder o que fez"** e abre **"O que fez neste mês"**, com dia e hora, o que foi, a IA e o valor;
- cada receita dos testes anteriores aparece **numa linha só**, "Criar um site", com "Claude, GPT e Gemini" (antes eram 6
  linhas, uma por etapa);
- as mensagens do chat aparecem como "Tarefa rápida · Resposta", "Tarefa rápida · Documento"…;
- em **"Entregas do mês"**, os arquivos que ela gerou no chat, cada um com **Baixar**. (Os sites das receitas antigas não
  aparecem: só os sites novos viram entrega. E os documentos antigos continuam com o nome tirado do pedido, F49.)
- **nenhum pedido** dela aparece (nem "Me dê 3 ideias", nem o texto da confeitaria).

2. Rode este SQL para conferir o gasto de cada pessoa (troque OCK se precisar):
   ```sql
   select m.name, coalesce(-sum(e.amount_cents), 0) as gasto_centavos
   from public.members m
   left join public.wallet_entries e on e.member_id = m.id and e.kind in ('charge', 'adjustment')
     and e.created_at >= date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
   where m.company_id = (select id from public.companies where name = 'OCK')
   group by m.name order by m.name;
   ```

**Deu certo se:** o gasto de cada pessoa bate com o "Gasto do mês" do cartão dela, e a soma bate com o Gasto da empresa
neste mês (Parte B).

## Parte E: o site vira entrega (8 min)

1. Abra uma **janela anônima** (**Ctrl + Shift + N**; no Opera GX, "janela privada"), vá a http://localhost:3000 e entre
   como a **Carla**.
2. Clique na aba **Meus gastos**.

**Deu certo se:**
- logo embaixo do cartão do gasto, a frase **"O dono da empresa vê suas entregas e quanto cada tarefa custou. Suas
  conversas, não."**;
- a lista mostra cada receita **numa linha só** ("Criar um site", com as bolinhas e "Claude, GPT e Gemini");
- o "Gasto do mês" no alto da página é o mesmo do cartão da Carla no painel.

3. Clique na aba **Receitas**, em **Usar receita** no "Criar um site", escreva um pedido (ex.: "Site para a Doceria da
   Carla, com cardápio e WhatsApp") e clique em **Começar**. Espere o site ficar pronto (uns 30 segundos).
4. Clique na aba **Entregas**.

**Deu certo se:**
- aparece a mesma frase do que o dono vê;
- o site está na lista, com um nome tirado do título dele (algo como **"doce-encanto-confeitaria.html"**), e **Baixar**;
- clicando em **Baixar**, o navegador **salva** o arquivo (não abre o site numa aba).

5. Em **Meus gastos**, a receita nova aparece numa linha só, com uns **R$ 0,37**.
6. Volte à **janela normal** (dono) e aperte **F5** no painel.

**Deu certo se:**
- o "Gasto do mês" da Carla subiu uns R$ 0,37, e o resumo conta uma receita e uma entrega a mais;
- em **Ver o que fez**, a receita nova aparece numa linha, e o site aparece em "Entregas do mês";
- **Baixar** salva o site como arquivo;
- no **Extrato do mês**, a receita aparece numa linha, com "Carla Teste" e **"− R$ 0,37"**.

## Parte F: o nome do documento do chat (3 min)

1. Na janela anônima (Carla), aba **Chat**, peça: **Gere um PDF com o resumo da reunião de hoje com o cliente**.

**Deu certo se:** a resposta diz "Gerei o arquivo **Resumo.pdf**" (a IA simulada sempre começa o documento com "Resumo").
Antes, o nome seria "Gere-um-PDF-com-o-resumo-da-reuniao-de-hoje-com-o-cliente.pdf", e o dono leria o pedido.

2. No painel (janela normal), **F5** e **Ver o que fez** da Carla: em "Entregas do mês" aparece **Resumo.pdf**, sem
   nenhum pedaço do pedido.

## Parte G: o teto do mês (4 min)

Esta é a Parte I do guia do chat, que ficou de fora.

1. No painel, no cartão da Carla, clique em **Mudar teto**, escreva **1,00** e clique em **Salvar**.

**Deu certo se:** o cartão mostra "Gasto do mês: R$ … de R$ 1,00" com a barra **vermelha e cheia** (ela já gastou mais
que R$ 1,00 no mês).

2. Na janela anônima (Carla), aperte **F5**, escreva **Oi** no chat e envie.

**Deu certo se:** aparece em vermelho **"Você chegou ao seu teto do mês. Peça ao dono da empresa para aumentar o seu
teto. Nada foi cobrado."**, o "Oi" volta para a caixa e nenhuma conversa nova aparece.

3. No painel, clique em **Mudar teto** no cartão da Carla, **apague o valor** (vazio = sem teto) e clique em **Salvar**.

## Parte H: a recarga aparece no extrato (3 min)

É assim que você vai conferir se o Pix de uma empresa entrou.

1. No SQL Editor do **`multi-ia-teste`**, rode (troque OCK se precisar):
   ```sql
   select private.wallet_topup((select id from public.companies where name = 'OCK'), 500, 'Pix de teste');
   ```
2. No painel, aperte **F5**.

**Deu certo se:**
- o **Disponível** e o **Saldo** subiram **R$ 5,00**;
- no **Extrato do mês**, aparece "Pix de teste", com "Recarga" e **"+ R$ 5,00"** em verde (e a sua recarga de
  R$ 20,00 do teste da cobrança, mais abaixo, se foi neste mês).

## Parte I: quem não é dono não vê nada disso (2 min)

1. Na janela anônima (Carla), vá a http://localhost:3000/dono.

**Deu certo se:** ela volta para o espaço de trabalho dela; o painel não abre.

2. Na janela normal (dono), clique em **Trabalho** no topo e abra **Meus gastos**.

**Deu certo se:** aparecem os seus gastos (de dono), **sem** a frase "O dono da empresa vê…" (ela é só para os
funcionários), e nenhuma conversa da Carla aparece no Chat.

## Parte J: no celular (2 min, opcional)

Na janela normal, clique com o **botão direito** em qualquer lugar da página → **Inspecionar** (funciona em qualquer
navegador; no Opera GX, o F12 e o Ctrl + Shift + I não abrem as ferramentas). Clique no ícone de celular (ou
**Ctrl + Shift + M**) e escolha uma largura pequena (ex.: 360). Volte ao painel.

**Deu certo se:** tudo cabe na largura (sem rolar para o lado) e o "Ver o que fez" continua funcionando. Feche as
ferramentas no **X** do canto delas.

## Depois do teste

1. Pare o site no terminal (**Ctrl + C**).
2. Volte ao Claude Code e conte como foi (o que deu certo e o que não bateu, com prints se puder).
3. **Só faça o merge do PR #45 depois de o Claude confirmar** que está tudo certo. No merge, o Supabase aplica a migração
   nova no projeto de verdade sozinho.

**O que já foi conferido pelo Claude** (para você não precisar repetir): o aviso vermelho de empresa sem crédito, o
dono de outra empresa sem acesso a nada, o funcionário sem o saldo da empresa, e as contas no banco com duas empresas de
mentira (67 conferências de ponta a ponta e 26 testes do banco).

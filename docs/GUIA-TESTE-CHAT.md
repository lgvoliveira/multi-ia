# Guia: testar o chat (PR 3c)

> Escrito em 25/10/2026 (etapa 5, parte 3c do PR 3, já na `main` pelo PR #40) para o Luis fazer à mão, com a ajuda do chat do Claude
> (claude.ai). **Para o chat do Claude:** guie o Luis uma parte de cada vez, em português simples, e espere ele
> confirmar antes de seguir. Se uma tela não bater com o guia, ajude pelo print. **Nunca peça para ele colar no chat
> senhas, chaves, o e-mail dele ou o link de um convite.** Todo SQL deste guia roda no projeto **de testes** do Supabase
> (`multi-ia-teste`), nunca no de verdade (`multi-ia`).

## Para que serve

Conferir, no computador do Luis e com o projeto de testes do Supabase, o que a parte 3c trouxe: o `/trabalho` deixou de
ser "Em obras" e voltou a ter o **chat** (a tarefa rápida), agora no banco novo e cobrando da carteira da empresa.
- A pessoa pede; o **Chefe** escolhe a IA, o nível e o esforço; e cada resposta mostra **"Custou R$ X"**.
- No chat não há estimativa antes de mandar (decisão do Luis, issue #39): o servidor confere o saldo e o teto, reserva o
  máximo que a resposta pode custar e cobra só o que foi usado, **numa linha só** do extrato por mensagem.
- Pedidos de PDF, Word, Excel, CSV, gráfico e projeto em .zip viram arquivos para baixar.
- Dá para anexar PDF, texto e imagem.
- As abas **Entregas** (os arquivos que as IAs fizeram) e **Meus gastos** (o gasto do mês e o teto, em reais).

**Importante:** o chat ainda roda com a **IA simulada**. Ela responde sempre um texto parecido ("Esta é uma resposta
simulada. Recebi uma instrução de … caracteres e uma entrada de … caracteres…") e devolve exemplos prontos de documento,
gráfico e projeto. Mas cada resposta "custa" o mesmo que a IA de verdade custaria, e o dinheiro sai do crédito de
mentira que você colocou na empresa no teste anterior (sobraram uns R$ 15). Imagem, pesquisa na internet, rodar código
e voz chegam com as IAs de verdade.

Tempo total: uns 30 minutos.

Ferramentas:
- o navegador (Chrome, Edge ou Opera GX);
- o terminal do VS Code;
- o painel do Supabase (supabase.com, projeto `multi-ia-teste`);
- o Bloco de Notas, para criar um arquivo de texto (Parte E).

## Antes de começar

- Este PR **não muda o banco** (nenhuma migração nova) e **não traz biblioteca nova**: não precisa rodar o workflow
  "Banco de testes" nem `npm install`.
- Tenha à mão a senha da sua conta de dono no projeto de testes e a da funcionária Carla Teste.

## Parte A: pôr o site na versão do PR (3 min)

1. Se o site estiver rodando num terminal, pare com **Ctrl + C**.
2. Abra um **terminal novo** do VS Code (menu **Terminal → New Terminal**; o do Claude Code fica ocupado) e rode:
   ```
   git checkout main
   git pull
   npm run dev
   ```
   Espere aparecer "Ready".
3. Abra uma **janela anônima** (**Ctrl + Shift + N**; no Opera GX, "janela privada"), vá a http://localhost:3000 e entre
   como a **Carla**.

**Deu certo se:**
- aparece **"Olá, Carla!"**, sem o "Em obras";
- à direita, **"Gasto do mês: R$ …"**, com o que ela gastou nas receitas do teste anterior (uns R$ 4,94), e "(sem teto)";
- embaixo, o atalho **Receita "Criar um site"** e as abas **Chat**, **Entregas** e **Meus gastos**;
- no meio, "Descreva a tarefa. O Chefe cuida do resto." e a caixa de escrever, com **"0/4.000 caracteres"**,
  **Anexar arquivo** e **Enviar**. Não há microfone.

## Parte B: a primeira mensagem (3 min)

1. Escreva **Me dê três ideias de post para uma confeitaria** e clique em **Enviar** (ou aperte Enter; Shift + Enter
   pula linha). Enquanto escreve, o contador sobe.

**Deu certo se:**
- a sua mensagem aparece à direita, em azul, e logo embaixo "O Chefe está escolhendo quem responde…";
- em um ou dois segundos chega a resposta, com:
  - uma bolinha verde e **"O Chefe escolheu GPT (padrão, esforço médio)"**;
  - em itálico, o motivo ("Texto geral: GPT Sol (padrão).");
  - à direita, **"Custou R$ 0,01"**;
  - o texto da IA simulada;
- a conversa aparece na lateral, com o começo da mensagem como título;
- no alto, o "Gasto do mês" subiu R$ 0,01.

## Parte C: o extrato e o registro interno (4 min)

1. No painel do Supabase, abra o projeto **`multi-ia-teste`** (confira o nome no topo), clique em **SQL Editor** e em
   **New query**. Cole e rode (**Run**):
   ```sql
   select description, amount_cents, provider, task_id
   from public.wallet_entries
   where kind = 'charge'
   order by id desc
   limit 1;
   ```

**Deu certo se:** aparece **uma linha** "Tarefa rápida · Resposta", com **-1** (um centavo, negativo), **gpt** e um
`task_id` preenchido. O seu pedido não aparece.

2. Rode:
   ```sql
   select amount_cents, charged_cents, status, task_id
   from public.wallet_holds
   order by created_at desc
   limit 2;
   ```

**Deu certo se:** aparecem **duas reservas** da mensagem, as duas **closed** e com o mesmo `task_id`:
- a do Chefe (a de baixo, mais antiga), com uns 2 centavos e nada cobrado;
- a da resposta, com o máximo que ela podia custar (uns 26 centavos) e **1** cobrado.

A sobra voltou para o saldo.

3. Rode:
   ```sql
   select step_id, provider, tier, charged, status
   from public.ai_calls
   order by id desc
   limit 2;
   ```

**Deu certo se:** aparecem as duas chamadas às IAs, as duas **ok** e **cobradas** (`charged` = true):
- **answer**, do **gpt**, nível **padrao**;
- **chief**, do **gpt**, nível **economico**.

Essa tabela só a nossa equipe enxerga.

## Parte D: arquivos (5 min)

Volte à janela anônima (Carla) e mande, uma de cada vez:

1. **Gere um PDF com um resumo da reunião de hoje**

**Deu certo se:** a resposta diz "Pronto! Gerei o arquivo … .pdf. É só baixar aqui embaixo.", com o botão **Baixar …pdf**.
Clicar **baixa** o arquivo (não abre como página). Aberto, o PDF tem o título e um texto de exemplo ("Resumo / Este é
um documento de exemplo…"). A linha do extrato desta vez diz "Tarefa rápida · Documento".

2. **Faça um gráfico de barras com as vendas do mês**

**Deu certo se:** aparece **"Gráfico pronto: Vendas por mês (exemplo)"**, o **gráfico de barras desenhado** dentro da
conversa e o botão **Baixar grafico.svg**.

3. **Crie uma planilha Excel com as vendas do mês**

**Deu certo se:** vem um arquivo **.xlsx** para baixar, que abre no Excel com as colunas Mês, Vendas e Clientes.

4. **Gere um site simples em arquivos .zip**

**Deu certo se:** a resposta diz "Projeto pronto com 2 arquivo(s): index.html, estilo.css. Baixe o .zip aqui embaixo.",
com o botão **Baixar projeto.zip**.

5. Clique na aba **Entregas**.

**Deu certo se:** aparecem os quatro arquivos, do mais novo para o mais antigo, com o dia e a hora e um **Baixar** em
cada um.

## Parte E: anexos (5 min)

1. No Bloco de Notas, escreva umas linhas (ex.: "Ata da reunião: aprovar o orçamento de R$ 1.200 e contratar um
   confeiteiro.") e salve como **ata.txt** na Área de Trabalho.
2. Na aba **Chat**, clique em **+ Novo chat** e depois em **Anexar arquivo**. Escolha o **ata.txt**.

**Deu certo se:** o seletor de arquivos mostra só PDF, textos e imagens, e o `ata.txt` aparece embaixo da caixa, como
uma etiqueta com um **×** para tirar.

3. Escreva **Resuma este arquivo** e envie.

**Deu certo se:** a sua mensagem mostra **"Anexos: ata.txt"**, e a resposta simulada diz que recebeu "uma entrada de …
caracteres" com bem mais caracteres do que tem a frase "Resuma este arquivo": o texto do arquivo foi junto. O título da
conversa nova é "Resuma este arquivo".

4. (Opcional) Tente anexar um arquivo **.docx** ou **.xlsx**: no seletor, troque o tipo para "Todos os arquivos".

**Deu certo se:** aparece em vermelho "A IA ainda não lê este tipo de arquivo. Anexe um PDF, um texto (.txt, .csv, .md,
.json) ou uma imagem." e nada é anexado.

## Parte F: o que ainda não existe (3 min)

1. Mande **Crie uma imagem de um bolo de chocolate**

**Deu certo se:** a resposta diz **"Ainda não consigo criar imagens aqui. Isso chega em breve. Nada foi cobrado."** e
mostra **"Sem custo"**.

2. Mande **Pesquise as notícias de hoje sobre o preço do café**

**Deu certo se:** vem uma resposta do **Gemini (econômico, esforço baixo)** com um quadro amarelo: **"A pesquisa na
internet ainda não está ligada: esta resposta vem do que a IA já sabe e pode estar desatualizada."**

## Parte G: conversas guardadas (2 min)

1. Aperte **F5** para recarregar a página.
2. Na lateral, clique na conversa das ideias de post (a das Partes B e D; a mais recente fica no alto).

**Deu certo se:** as mensagens dela voltam, com "Feito por GPT (padrão, esforço médio)" e "Custou R$ 0,01" na primeira, e
as respostas da Parte D com o gráfico desenhado e os botões de baixar. Depois de recarregar, aparece "Feito por" no
lugar de "O Chefe escolheu", e o motivo em itálico não aparece mais (ele não fica guardado).

## Parte H: Meus gastos (2 min)

1. Clique na aba **Meus gastos**.

**Deu certo se:** aparece o **Gasto do mês**, igual ao do alto da página, "Seu teto do mês: **Sem teto**" e a lista do
mês, da mais nova para a mais antiga: as linhas "Tarefa rápida · …" de hoje e as "Criar um site · …" do teste anterior,
cada uma com a IA e o valor.

## Parte I: o teto do mês (4 min)

1. Numa **janela normal** (não a anônima), vá a http://localhost:3000 e entre com a sua conta de **dono**.
2. No painel, no cartão da Carla, clique em **Mudar teto**, escreva **1,00** e clique em **Salvar**.
3. Volte à janela anônima (Carla), aperte **F5**, escreva **Oi** e envie.

**Deu certo se:**
- no alto aparece "Gasto do mês: R$ … de R$ 1,00";
- ao enviar, aparece em vermelho **"Você chegou ao seu teto do mês. Peça ao dono da empresa para aumentar o seu teto.
  Nada foi cobrado."**;
- o "Oi" volta para a caixa, e nenhuma conversa nova aparece.

4. No painel do dono, clique em **Mudar teto** no cartão da Carla, **apague o valor** (vazio = sem teto) e clique em
   **Salvar**.

## Parte J: o dono não lê as conversas (2 min)

1. Na janela normal (dono), vá a http://localhost:3000/trabalho.

**Deu certo se:** aparece o espaço de trabalho do **dono**, com o atalho **Painel do dono** no alto e a lateral **sem
nenhuma conversa da Carla** ("Suas conversas aparecem aqui."). O dono também pode usar o chat, e o gasto dele conta no
crédito da empresa.

## Parte K: depois do teste

- O código deste guia **já está na `main`** (PR #40, mergeado antes do teste): não há merge a fazer. Se algum passo
  não der o resultado esperado, a correção vem num PR novo.
- Este PR não mudou o banco, então nada mudou no projeto de verdade do Supabase.
- As conversas, os arquivos e as linhas de gasto de teste podem ficar no projeto de testes.

**O que contar ao voltar ao Claude Code:**
- quais passos deram o resultado esperado e quais não (com print e o texto do terminal);
- os valores que apareceram em "Custou", no "Gasto do mês" e nas consultas da Parte C;
- qualquer tela diferente do guia, ou texto confuso (para corrigir).

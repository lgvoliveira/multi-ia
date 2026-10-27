# Guia: preparar e ligar as IAs de verdade

> Escrito em 26/10/2026 (etapa 5, PR das IAs de verdade) para o Luis fazer à mão, com a ajuda do chat do Claude
> (claude.ai). **Para o chat do Claude:** guie o Luis uma parte de cada vez, em português simples, e espere ele
> confirmar antes de seguir. Se uma tela não bater com o guia (os sites das empresas de IA mudam de tempos em tempos),
> ajude pelo print. **Nunca peça para ele colar no chat senhas, chaves de API, o número do cartão, o e-mail dele ou o
> link de um convite.** Todo SQL deste guia roda no projeto **de testes** do Supabase (`multi-ia-teste`), nunca no de
> verdade (`multi-ia`).

## Para que serve

Este PR deixa o site pronto para usar as IAs de verdade (Claude, GPT e Gemini), **sem gastar nada até você decidir**:

- **Uma chave só liga de propósito:** uma linha nova no `.env.local`, `OCK_AI_MODE`, diz qual IA responde.
  - `simulada`: as respostas de mentira de sempre.
  - `real`: as IAs de verdade.
  - Vazia: simulada no seu computador.
  Antes, uma chave faltando fazia o site usar a IA simulada sem avisar, e a empresa pagaria por uma resposta de mentira
  (F42). Agora, com `real`, a IA sem chave **falha**, e nada é cobrado.
- **O consumo cobrado é o que a empresa da IA informa** no fim de cada resposta, contando o "pensamento" da IA. Antes,
  era uma conta pelo tamanho do texto, que deixava o pensamento de fora (F40).
- **Os nomes dos modelos e os preços foram conferidos nas páginas oficiais** (F17). Vários estavam errados: o GPT mais
  forte cobraria da empresa menos do que custa, e o jeito de pedir o esforço baixo seria recusado pelo GPT (o Chefe do
  chat falharia em toda mensagem).
- **Pesquisa na internet, contas com um programa, imagens e voz** no chat, cada uma ligada por você numa linha nova,
  `OCK_AI_TOOLS` (vazia: nenhuma). Quem pesquisa é o Claude, que cita as fontes no fim da resposta (US$ 0,01 por
  pesquisa, até 3 por mensagem); quem roda o programa é o Gemini (sem custo a mais); quem cria a imagem é o GPT (uns
  R$ 0,29 por imagem); quem transcreve a voz ditada é o GPT (uns R$ 0,03 por minuto, até 2 minutos). Com a IA simulada,
  elas são fingidas, para você ver a tela sem gastar.

São duas sessões:
- **Sessão 1 (uns 25 minutos, sem gastar nada):** Partes A, B, C e D. Pode fazer já.
- **Sessão 2 (uns 50 minutos, com dinheiro de verdade):** Partes E, F, G e H. Só quando você decidir comprar os
  créditos.

Ferramentas: o navegador, o terminal do VS Code, o painel do Supabase (projeto `multi-ia-teste`) e, na sessão 2, o
cartão de crédito.

## Antes de começar

- Este PR **não muda o banco** (nenhuma migração nova) e **não traz biblioteca nova**: não precisa rodar o workflow
  "Banco de testes" nem `npm install`.
- Os PRs desta parte estão **empilhados** (um sobre o outro). Teste tudo de uma vez no branch do PR mais alto da pilha
  (Parte A) e, se der certo, faça os merges na ordem do `PROGRESSO.md` ("Ordem de testar e fazer o merge").
- Tenha à mão a sua senha de dono no projeto de testes e a da funcionária Carla Teste. A sua empresa de teste tem
  crédito de mentira (uns R$ 19), da recarga do guia anterior.

---

# Sessão 1 — sem gastar nada

## Parte A: pôr o site na versão do PR (3 min)

1. Se o site estiver rodando num terminal, pare com **Ctrl + C**.
2. Abra um **terminal novo** do VS Code (menu **Terminal → New Terminal**) e rode:
   ```
   git fetch
   git checkout fix/site-sem-crases
   git pull
   npm run dev
   ```
   Espere aparecer "Ready".
3. Abra uma **janela anônima** (**Ctrl + Shift + N**; no Opera GX, "janela privada"), vá a http://localhost:3000 e entre
   como a **Carla**.

**Deu certo se:** aparece "Olá, Carla!" com as abas Chat · Receitas · Entregas · Meus gastos.

## Parte B: com a IA simulada, tudo igual, com os preços novos (5 min)

O seu `.env.local` ainda não tem a linha `OCK_AI_MODE`. Vazia, o seu computador continua com a IA simulada.

1. Na aba **Receitas**, clique em **Usar receita** em "Criar um site" e olhe embaixo do **Começar**.

**Deu certo se:** aparece **"Custo estimado: até R$ 6,09"** (antes era R$ 5,31: os preços oficiais e a folga para o
"pensamento" das IAs mudaram a conta). Trocando o **Front-end** para **Gemini**, cai para **até R$ 4,30**. Volte para
**GPT (recomendada)**.

2. Escreva um pedido (ex.: "Quero um site para a minha padaria, com cardápio e WhatsApp") e clique em **Começar**.
   Espere o site ficar pronto (uns 30 segundos).

**Deu certo se:** o site da "Doce Encanto" aparece, como sempre, e o fim mostra **"Custou"** com uns **R$ 0,32**
(antes, uns R$ 0,37; o valor exato muda um pouco com o tamanho do pedido).

3. Vá à aba **Chat** e mande "Me dê 3 ideias de nome para uma padaria".

**Deu certo se:** a resposta simulada aparece com **"Custou R$ 0,01"** embaixo.

4. Mande "Gere uma planilha Excel com 3 produtos e preços". Baixe o `Planilha.xlsx` e abra no Excel (ou arraste para o
   Google Planilhas, em sheets.google.com).

**Deu certo se:** a planilha abre sem aviso de arquivo com problema, com a tabela de exemplo da IA simulada (Mês,
Vendas, Clientes), os nomes das colunas em **negrito** e os números como números (dá para somar). A planilha agora é montada pela própria plataforma: o pacote antigo, com falhas de
segurança, saiu (F15).

## Parte C: IAs de verdade ligadas, mas sem chave: falha sem cobrar (8 min)

Aqui você liga as IAs de verdade **sem ter chave nenhuma**. O certo é tudo falhar, sem cobrar nada e sem cair na IA
simulada.

1. No VS Code, abra o arquivo **`.env.local`** (na raiz do projeto). Numa linha nova, no fim, escreva:
   ```
   OCK_AI_MODE=real
   ```
   Clique dentro do arquivo e salve com **Ctrl + S** (a bolinha da aba some). No terminal do `npm run dev`, aparece
   "Reload env".
2. Na janela anônima (Carla), aba **Chat**, mande de novo "Me dê 3 ideias de nome para uma padaria".

**Deu certo se:** a resposta é **"A IA não conseguiu responder agora. Nada foi cobrado. Tente de novo daqui a pouco."**
No terminal do `npm run dev`, aparece uma linha com **"A chave do Claude não está configurada no servidor
(OCK_CLAUDE_KEY)"** (é o servidor contando para nós o motivo; a Carla nunca vê isso).

3. Na aba **Receitas**, abra "Criar um site", escreva um pedido e clique em **Começar**.

**Deu certo se:** o time para logo no começo: **"O time parou no meio do caminho"** e **"Chefe: nem o Claude nem o GPT
conseguiram terminar a etapa."** (o Claude, sem chave, falhou; o GPT, a IA reserva do Chefe, também). O custo mostrado
é **R$ 0,00**.

4. Confira o dinheiro: na aba **Meus gastos**, o total do mês é o mesmo de antes do passo 2 (as duas tentativas não
   cobraram nada).
5. Confira o registro interno no Supabase: no painel, abra o projeto **`multi-ia-teste`** → **SQL Editor** → **New
   query**, cole e clique em **Run**:
   ```sql
   select created_at, step_id, provider, model, status, charged, left(error_message, 90) as motivo
   from ai_calls
   order by created_at desc
   limit 6;
   ```

**Deu certo se:** as linhas mais novas têm `status` = `error`, `charged` = `false` e o motivo "A chave do ... não está
configurada no servidor (OCK_..._KEY)". Nenhuma tem modelo `mock-...`: a simulada não entrou no lugar.

6. **Volte para a simulada:** no `.env.local`, apague a linha `OCK_AI_MODE=real` (ou troque por
   `OCK_AI_MODE=simulada`) e salve.

## Parte D: pesquisa, contas, imagem e voz, fingidas pela IA simulada (10 min)

1. No `.env.local`, confira que **não** há `OCK_AI_MODE=real` (passo 6 acima). Numa linha nova, escreva
   `OCK_AI_TOOLS=pesquisa,codigo,imagem,voz` e salve. **Recarregue a página** (F5): o botão da voz só aparece depois.
2. Na janela anônima (Carla), aba **Chat**, clique em **+ Novo chat** e mande "Pesquise a cotação do dólar hoje".

**Deu certo se:** a resposta diz **"Informação atual: o Claude pesquisa na internet e cita as fontes."**, vem do
**Claude**, termina com **"Fontes consultadas:"** e uma fonte de exemplo ("Fonte de exemplo (resposta simulada)") e
**não** tem o aviso amarelo de que não pesquisou. O custo tem uns 6 centavos a mais que uma resposta comum (a pesquisa
fingida "custa" US$ 0,01, como a de verdade).

3. Mande "Calcule e rode os juros compostos de R$ 1.000 a 1% ao mês por 12 meses".

**Deu certo se:** a resposta vem do **Gemini** e termina com **"A IA rodou um programa para fazer esta conta."**, sem
aviso amarelo.

4. Mande "Crie uma imagem de um banner para a Padaria Pão Dourado".

**Deu certo se:** a resposta diz **"Imagem: o GPT cria a imagem."** e **"Pronto! Criei a imagem…"**, mostra um
**quadriculado azul** (a "imagem" da IA simulada) e o botão **Baixar imagem.png**. O custo fica perto de **R$ 0,30**
(a imagem fingida "custa" o mesmo que uma de verdade). Na aba **Entregas**, aparece o `imagem.png`.

5. Recarregue a página (**F5**) e abra a conversa de novo.

**Deu certo se:** as três respostas continuam com as fontes, a frase do programa e a imagem, sem aviso amarelo.

6. Embaixo da caixa de escrever, ao lado de **Anexar arquivo**, clique em **Ditar**. Na primeira vez, o navegador pede
   licença para usar o microfone: **Permitir**. Fale qualquer coisa por uns segundos (o botão mostra "Parar (0:03)") e
   clique em **Parar**.

**Deu certo se:** aparece "Transcrevendo…" e, em seguida, a caixa ganha o texto **"Texto ditado (transcrição
simulada)."** (a simulada não ouve de verdade). O "Gasto do mês" sobe 1 centavo. Nada é enviado sozinho: você revisa e
clica em Enviar. Em **Meus gastos**, aparece a linha **"Voz · Transcrição"**.

7. Apague a linha `OCK_AI_TOOLS=pesquisa,codigo,imagem,voz` (ou deixe vazia), salve e recarregue a página. Mande de
   novo "Pesquise a cotação do dólar hoje" e "Crie uma imagem de um banner".

**Deu certo se:** volta o aviso amarelo **"Esta resposta não veio de uma pesquisa na internet…"**, a imagem responde
"Ainda não consigo criar imagens aqui. Isso chega em breve. Nada foi cobrado." e o botão **Ditar** some.

**Fim da sessão 1.** Conte ao Claude Code como foi. Se tudo deu certo, os PRs podem entrar na `main` (o site continua
com a IA simulada e as ferramentas desligadas até a sessão 2).

---

# Sessão 2 — com dinheiro de verdade

Faça esta sessão só quando quiser começar a gastar. O total para começar é de **uns US$ 10 (uns R$ 60)**: US$ 5 na
Anthropic e US$ 5 na OpenAI. O Gemini começa no **plano grátis**.

**O código já está na `main`** (os PRs da sessão 1 entraram em 26/10). Antes de começar, pare o site (**Ctrl + C**) e
rode no terminal `git checkout main` e depois `git pull`. O branch `fix/site-sem-crases` da Parte A não existe mais.

**Cuidados que valem para as três empresas:**
- Use o **Gmail do projeto**, não o pessoal (decisão de 09/10).
- **Recarga automática desligada** em todas. Na OpenAI ela vem **ligada** na hora da compra: desligue.
- O crédito comprado **não é devolvido** e vale por cerca de 1 ano.
- **A chave é como uma senha:** ela aparece **uma vez só**, na hora de criar. Copie direto para o `.env.local`. Nunca
  cole no chat, num e-mail, num print ou no WhatsApp. Se vazar, apague a chave no site da empresa e crie outra.
- O nome da chave pode ser `computador-luis-teste`: quando o site for publicado, criaremos outras, separadas.

## Parte E: comprar os créditos e criar as chaves (30 min)

### E1. Anthropic (Claude)

1. Entre em **https://platform.claude.com** com o Gmail do projeto (o antigo console.anthropic.com leva para lá). Se for
   a primeira vez, ele pede para criar uma organização: use `multi-ia`.
2. Menu **Settings → Billing** (ou "Plans & billing"): **Buy credits** (comprar créditos), escolha o mínimo
   (**US$ 5**) e pague com o cartão. Na mesma página, confira que **Auto reload** (recarga automática) está
   **desligada**.
3. Menu **Settings → Limits**: se houver "Spend limit" (limite de gasto por mês), coloque **US$ 10**. Assim, nem um
   defeito nosso gasta mais do que isso.
4. Menu **Settings → API keys → Create Key**. Nome: `computador-luis-teste`. **Copie a chave** (começa com `sk-ant-`).
5. No VS Code, no `.env.local`, ache a linha `OCK_CLAUDE_KEY=` e cole a chave **depois do `=`**, sem espaços nem aspas.
   Salve.

### E2. OpenAI (GPT)

1. Entre em **https://platform.openai.com** com o Gmail do projeto.
2. Engrenagem (**Settings**) → **Billing** → **Add payment details** (cartão) e depois **Add to credit balance**: o
   mínimo (**US$ 5**). Na mesma tela da compra, a OpenAI oferece **recarga automática** ("automatic recharge"),
   **ligada**: **desligue antes de confirmar**. Depois, confira em **Billing** que ela aparece desligada.
3. **Settings → Limits**: coloque um limite (ou alerta) de gasto mensal de **US$ 10**.
4. **API keys → Create new secret key**. Nome: `computador-luis-teste`; projeto: o padrão ("Default project") serve;
   permissões: **All**. **Copie a chave** (começa com `sk-`).
5. No `.env.local`, cole na linha `OCK_GPT_KEY=` e salve.
6. **Talvez:** a OpenAI pode pedir a **verificação da organização** (foto de documento e selfie, por uma empresa
   parceira) para os modelos mais novos responderem "ao vivo", que é como o site pede. Se, na Parte F, o terminal
   mostrar um erro com "verify" ou "organization must be verified", faça a verificação em **Settings → Organization →
   General** e espere uns 15 minutos.

### E3. Google (Gemini) — plano grátis

1. Entre em **https://aistudio.google.com** com o Gmail do projeto.
2. Clique em **Get API key** → **Create API key** (ele cria um projeto do Google Cloud para você; aceite o nome
   sugerido). **Copie a chave** (começa com `AIza`).
3. No `.env.local`, cole na linha `OCK_GEMINI_KEY=` e salve.
4. **Importante:** no plano grátis, o Google usa o que é mandado para melhorar os produtos dele. Por isso, nos testes,
   **só pedidos inventados**, nunca dados de cliente ou de empresa de verdade (F05). Antes da primeira empresa real, o
   Gemini passa para o plano pago. No plano grátis, o Gemini **potente** (Gemini 4 Argon) não funciona; o site quase
   nunca o usa, e, se usar, a troca de IA entra.

**Deu certo se:** o `.env.local` tem as três linhas preenchidas (`OCK_CLAUDE_KEY=sk-ant-…`, `OCK_GPT_KEY=sk-…`,
`OCK_GEMINI_KEY=AIza…`). Não mostre o arquivo a ninguém.

## Parte F: o primeiro teste com as IAs de verdade (10 min, uns R$ 1 a R$ 3)

1. No `.env.local`, numa linha nova, escreva `OCK_AI_MODE=real` e salve. No terminal: "Reload env".
2. Na janela anônima (Carla), aba **Chat**, mande: "Me dê 3 ideias de nome para uma padaria."

**Deu certo se:** em alguns segundos chega uma resposta **de verdade** (não o texto "Esta é uma resposta simulada"),
com **"Custou R$ 0,01"** ou perto disso.

3. Mande: "Gere um PDF com 5 dicas para atender bem no balcão."

**Deu certo se:** sai um PDF de verdade para baixar, com um custo de alguns centavos.

4. Na aba **Receitas**, rode "Criar um site" com um pedido inventado (ex.: "Site para a Padaria Pão Dourado, com
   cardápio, horário e WhatsApp"). Agora demora mais: uns 2 a 5 minutos, porque as IAs escrevem de verdade.

**Deu certo se:** o texto aparece aos poucos em cada etapa, o site fica pronto na prévia e o fim mostra "Custou R$ X",
**abaixo dos R$ 6,09** reservados. Anote o valor, o tempo total e quanto demorou a fase mais longa (o Front-end): são
os primeiros números de verdade do projeto, e o tempo de cada fase importa para a publicação (F54).

5. Confira o registro interno (SQL Editor do `multi-ia-teste`):
   ```sql
   select created_at, step_id, provider, model, input_tokens, output_tokens, cost_usd, charged, status
   from ai_calls
   order by created_at desc
   limit 12;
   ```

**Deu certo se:** os modelos são os de verdade (`claude-haiku-5-5`, `claude-sonnet-5-5`, `gpt-6-luna`, `gpt-6.1-sol`,
`gemini-3.8-flash`…), com tokens e custo em dólar diferentes de zero. Mande um print dessa tabela ao Claude Code (ela não
tem chave nem conteúdo de pedido).

6. **No dia seguinte** (os painéis das empresas demoram para atualizar), compare o gasto em dólar da Anthropic
   (**Settings → Usage**) e da OpenAI (**Usage**) com a soma da coluna `cost_usd` do mesmo dia. Devem ficar perto. Se
   ficarem longe, conte ao Claude Code: é a conferência final da F40.

**Se algo der errado:** copie do terminal só a linha do erro (ela nunca mostra a chave) e mande ao Claude Code. Os
erros mais prováveis: chave colada com espaço ou aspas (erro 401), crédito ainda não liberado (erro 400 ou 429 com
"credit"), verificação da organização na OpenAI (passo 6 da E2) ou um nome de modelo que a empresa trocou (erro 404).

## Parte G: pesquisa, contas, imagem e voz de verdade (10 min, uns R$ 0,50)

1. Com `OCK_AI_MODE=real`, escreva também `OCK_AI_TOOLS=pesquisa,codigo,imagem,voz`, salve e recarregue a página.
2. Na janela anônima (Carla), mande "Pesquise a cotação do dólar hoje".

**Deu certo se:** o Claude responde com o valor de hoje e a lista **"Fontes consultadas:"** com páginas de verdade
(abra uma delas para conferir). Custa uns centavos (R$ 0,05 a R$ 0,50).

3. Mande "Calcule e rode os juros compostos de R$ 1.000 a 1% ao mês por 12 meses".

**Deu certo se:** o Gemini responde **R$ 1.126,83** (ou muito perto) e termina com "A IA rodou um programa para fazer
esta conta."

4. Mande "Crie uma imagem de um banner para a Padaria Pão Dourado, com pães na vitrine".

**Deu certo se:** em até uns 2 minutos, aparece uma imagem de verdade, com "Baixar imagem.jpg", custando uns
**R$ 0,30**. Pedidos com pessoas reais ou marcas podem ser barrados pela OpenAI: aí a resposta avisa e nada é cobrado.

5. Clique em **Ditar**, fale "Preciso de um orçamento de bolo para cinquenta pessoas no sábado" e clique em **Parar**.

**Deu certo se:** a caixa ganha a frase que você falou (pode vir com pequenas diferenças), custando 1 ou 2 centavos.

6. No SQL Editor, rode de novo a consulta da Parte F (passo 5).

**Deu certo se:** a linha da pesquisa (`claude-sonnet-5-5`) tem `cost_usd` com pelo menos 0,01 a mais que os tokens
(cada pesquisa é cobrada à parte), a da imagem (`gpt-image-2`) tem uns 0,053, e a da voz (`gpt-transcribe`,
`step_id` = `voice`) tem uns 0,0005 para 7 segundos.

**Se a pesquisa der erro 400 com "web search is not enabled":** na Anthropic, **Settings → Capabilities**, ligue a
pesquisa na internet ("Web search") e tente de novo.

## Parte H: voltar para a simulada (1 min)

No `.env.local`, troque `OCK_AI_MODE=real` por `OCK_AI_MODE=simulada` e salve. Assim, os próximos testes de outras
partes do site não gastam crédito de verdade. As chaves podem ficar no arquivo: com `simulada`, ninguém as usa.

## Depois do teste

1. Pare o site no terminal (**Ctrl + C**).
2. Volte ao Claude Code e conte como foi (o que deu certo, o que não bateu, os valores e o tempo da receita).

**O que já foi conferido pelo Claude** (para você não precisar repetir):
- Testes automáticos com respostas gravadas no formato de cada empresa: o pedido certo para cada uma (modelo, teto,
  esforço), o consumo lido com o pensamento e o cache, recusa da IA, conexão que cai no meio, sobrecarga, chave errada,
  e a chave nunca aparecendo numa mensagem de erro.
- Com as IAs de verdade ligadas e sem chave: a mensagem do chat e a receita falham sem cobrar, e o motivo fica no
  registro interno.
- De ponta a ponta, no projeto de testes, nos dois modos (simulada e "real" sem chave): as estimativas novas na tela
  (R$ 6,09 e R$ 4,30) e a recusa sem saldo antes de qualquer IA (22 conferências).
- A pesquisa e o código: o pedido de cada ferramenta à empresa certa, as fontes citadas (sem repetir e só endereços da
  web), as pesquisas cobradas à parte, o programa rodado contado, e a resposta guardada com as fontes no fim. Pela tela,
  com três mensagens gravadas no banco de testes: as fontes uma por linha, o aviso só onde a IA não pesquisou, e nada
  rolando para o lado em 360 px.
- A imagem: o pedido certo ao GPT Image (tamanho, qualidade, JPEG), o consumo e o preço próprios, o pedido barrado sem
  nova tentativa e sem cobrança, a entrega guardada, e, pela tela, a imagem na conversa, para baixar e na aba Entregas.
- A planilha sem o pacote antigo: o próprio pacote antigo leu a planilha nova com os valores certos, antes de sair.
- A voz: o envio do áudio ao gpt-transcribe, os segundos cobrados (sem eles, o máximo), a falha e o áudio sem fala sem
  cobrança, e, pela tela com um microfone falso do Chrome, gravar, parar, o relógio, o Enviar desligado durante a
  gravação e a recusa por falta de saldo antes de qualquer IA, sem perder o que já estava escrito (11 conferências).
- Não deu para testar pela tela a resposta cobrada (as empresas de teste do Claude não têm crédito; só a sua tem), por
  isso as Partes B, C e D deste guia.

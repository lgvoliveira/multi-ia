# Guia: testar a receita "Posts para redes sociais" (bloco 1, segundo PR)

> Escrito em 27/10/2026 (bloco 1 da nova ordem, issue #54) para o Luis fazer à mão, com a ajuda do chat do Claude
> (claude.ai). **Para o chat do Claude:** guie o Luis uma parte de cada vez, em português simples, e espere ele
> confirmar antes de seguir. Se uma tela não bater com o guia, ajude pelo print. **Nunca peça para ele colar no chat
> senhas, chaves, o e-mail dele ou o link de um convite.** Este guia não usa SQL nem o painel do Supabase.

## Para que serve

Conferir, no computador do Luis e com o projeto de testes do Supabase, o que este PR trouxe:
- **A receita "Posts para redes sociais"**, a segunda das três escolhidas para pequenas empresas: o **Estrategista**
  (Claude) define o público, o tom e **três ângulos** (três jeitos de contar a mesma novidade); o **Redator 1** (GPT) e o
  **Redator 2** (Claude) escrevem **ao mesmo tempo** um post para cada ângulo; e o **Editor** (GPT) fica com a melhor
  versão de cada ângulo e entrega **3 opções prontas**, cada uma com a chamada, o texto, as hashtags e uma ideia de
  imagem. O resultado tem Copiar e Word, como a proposta.
- **Uma correção (F56):** enquanto o time trabalha, a caixa "O documento vai tomando forma" aparecia também na proposta,
  com o nome errado "Plano do chefe". Agora ela só aparece no "Criar um site", que é para onde foi feita.

Tudo continua com a **IA simulada**: os posts que aparecem são sempre os mesmos de exemplo (os da padaria Pão Quente),
seja qual for o pedido, e eles "custam" o mesmo que a IA de verdade custaria.

Tempo total: uns 25 minutos (mais 5, se fizer a parte opcional).

Ferramentas: o navegador (com uma janela normal e uma anônima), o terminal do VS Code e o Word (ou outro programa que
abra arquivos .docx).

## Antes de começar

- **Não faça o merge deste PR antes de terminar este guia.**
- Este PR **não** está empilhado: ele parte da `main` (o PR da proposta já entrou). Confira que o alto do PR diz
  "into main".
- Não há migração nem biblioteca nova: não precisa rodar o workflow "Banco de testes" nem `npm install`.
- Tenha à mão a senha da sua conta de dono e a da funcionária **Carla Teste**, no projeto de testes. A sua empresa de
  teste tem crédito de mentira; este guia gasta menos de R$ 1 dele.

## Parte A: pôr o site na versão do PR (3 min)

1. Se o site estiver rodando num terminal, pare com **Ctrl + C**.
2. Num **terminal novo** do VS Code (menu **Terminal → New Terminal**), rode:
   ```
   git fetch
   git checkout feat/receita-posts
   git pull
   npm run dev
   ```
   Espere aparecer "Ready".
3. Abra uma **janela anônima** (**Ctrl + Shift + N**; no Opera GX, "janela privada"), vá a http://localhost:3000 e entre
   como a **Carla**.

**Deu certo se:** aparece "Olá, Carla!" com as abas Chat · Receitas · Entregas · Meus gastos.

## Parte B: os cartões das receitas (2 min)

Clique na aba **Receitas**.

**Deu certo se:**
- aparecem **4 cartões**, nesta ordem: **Criar um site**, **Proposta comercial**, **Posts para redes sociais** e
  **Relatório mensal para cliente**;
- **Posts para redes sociais** tem o botão **Usar receita**, a frase "… Você recebe 3 opções em Word." e o time
  **Estrategista** (bolinha laranja, Claude), **Redator 1** (verde, GPT), **Redator 2** (laranja, Claude) e **Editor**
  (verde, GPT);
- só o **Relatório** continua **"Em breve"**.

## Parte C: rodar os posts (5 min)

1. No cartão **Posts para redes sociais**, clique em **Usar receita**.

**Deu certo se:** abre a tela do time com os quatro papéis, cada um com a IA dele, o exemplo de pedido falando da
padaria Pão Quente e **"Custo estimado: até R$ 2,03"**.

2. No papel **Redator 1**, troque a IA para **Gemini**.

**Deu certo se:** a estimativa cai para **"até R$ 1,81"**. Volte o Redator 1 para **GPT** (volta a "até R$ 2,03").

3. Na caixa do pedido, escreva algo como: *Posts para o Instagram da Pão Quente, nossa padaria em Campinas, divulgando o
   café da manhã de sábado.* Clique em **Começar**.

**Deu certo se:**
- primeiro trabalha o **Estrategista**, sozinho;
- depois, o **Redator 1** e o **Redator 2** trabalham **ao mesmo tempo**, lado a lado (um embaixo do outro, se a janela
  for estreita), cada um escrevendo o seu texto, e o alto da tela diz "Redator 1 (GPT) e Redator 2 (Claude) estão
  trabalhando ao mesmo tempo.";
- por fim, o **Editor**;
- **não** aparece a caixa "O documento vai tomando forma" nem as palavras "Plano do chefe" (a correção F56);
- no fim (menos de um minuto), aparece a tela **"Seus posts estão prontos"**, com "Concluído em … · Custou R$ 0,1…"
  (uns 12 centavos).

## Parte D: a tela do resultado (5 min)

**Deu certo se**, na tela "Seus posts estão prontos":
- o texto aparece numa folha branca, com o título **"Posts para o Instagram — Café da manhã de sábado na Pão Quente"** em
  letra grande, e quatro subtítulos: **Opção 1 — O convite**, **Opção 2 — Programa em família**, **Opção 3 — O pão
  quentinho** e **Antes de publicar**;
- em cada opção: **Chamada:**, **Hashtags:** e **Ideia de imagem:** em negrito; as hashtags (#PãoQuente…) como texto
  normal, **não** como título; e os emojis ☕ e 🥐 nas chamadas;
- **nenhum** sinal estranho no texto, como `**` ou `## `;
- o "Antes de publicar" lista o que preencher: [preço do café da manhã], [WhatsApp da padaria] e [endereço da padaria];
- ao lado (ou embaixo, em tela estreita), **"Como o time chegou aqui"**, com as 4 etapas e a IA de cada uma.

1. Clique em **Copiar o texto**.

**Deu certo se:** o botão vira **"Copiado"** por uns segundos. Abra o **Bloco de Notas** e cole (**Ctrl + V**): vêm as 3
opções inteiras, sem `**`, mas **com** as hashtags e os emojis. (O botão copia tudo de uma vez; um "Copiar" para cada
opção pode virar um ajuste depois, se você achar que faz falta.)

2. Clique em **Baixar em Word**.

**Deu certo se:** o navegador salva o arquivo **Posts-para-redes-sociais.docx** (não abre uma página). Abra no Word: o
título como título, as opções como subtítulos, as hashtags e os emojis como texto, sem `**`.

3. Clique em **Ver todas as etapas**.

**Deu certo se:** aparecem o seu pedido e as 4 etapas, com o que cada IA escreveu. Repare que os dois redatores
escreveram versões **diferentes** dos mesmos três ângulos, e que o Editor juntou as melhores (a chamada da opção 1 veio
do Redator 1, a da opção 2 veio do Redator 2).

## Parte E: Entregas, Meus gastos e o painel do dono (4 min)

1. Ainda como Carla, abra a aba **Entregas**.

**Deu certo se:** aparece **Posts-para-redes-sociais.docx**, com "Baixar" (que salva o mesmo Word).

2. Abra **Meus gastos**.

**Deu certo se:** os posts aparecem numa **linha só**, "Posts para redes sociais", com "Claude e GPT" e o valor da
Parte C.

3. Numa **janela normal**, entre com a sua conta de **dono** e abra o painel. Na Carla, clique em **Ver o que fez**.

**Deu certo se:** aparecem a linha **"Posts para redes sociais"** (com o mesmo valor) e, nas entregas do mês,
**Posts-para-redes-sociais.docx** com "Baixar". O seu pedido da Parte C **não** aparece em lugar nenhum do painel.

## Parte F: o site e a proposta depois da correção (4 min)

Na janela anônima (Carla), volte a **Receitas**.

1. Abra **Criar um site** e rode com um pedido qualquer (ex.: *Um site para a minha confeitaria*).

**Deu certo se:** enquanto o time trabalha, aparece a caixa **"O documento vai tomando forma"**, com o **"Plano do
chefe"**, como antes. No fim, **"Seu site está pronto"**, com as abas **Prévia** e **Código** e o botão **Baixar
arquivo**.

2. Volte a **Receitas**, abra a **Proposta comercial**, clique em **Começar de novo** (se ela abrir já pronta) e rode com
   um pedido qualquer.

**Deu certo se:** enquanto o time trabalha, **não** aparece a caixa "O documento vai tomando forma"; no fim, "Sua
proposta está pronta", como antes.

## Parte G: quando o GPT falha (5 min, opcional)

Aqui você faz o GPT simulado falhar de propósito, para ver a IA reserva assumir sem que os dois redatores fiquem iguais.

1. No terminal do site, pare com **Ctrl + C** e rode (é um comando só, numa linha):
   ```
   $env:MOCK_AI_FAILURES="gpt"; npm run dev
   ```
   Espere aparecer "Ready".
2. Na janela anônima (Carla), abra **Posts para redes sociais**, clique em **Começar de novo** e rode com um pedido
   qualquer.

**Deu certo se:**
- na fase dos redatores, o **Redator 1** mostra "O GPT teve um problema e está tentando de novo…" (duas vezes) e depois
  o aviso **"O Gemini entrou no lugar do GPT, que não conseguiu responder."**; o **Redator 2** segue com o **Claude**.
  Os dois continuam sendo de IAs diferentes;
- o **Editor** também troca: o **Claude** entra no lugar do GPT;
- no fim, "Seus posts estão prontos", e em "Como o time chegou aqui" o Redator 1 aparece com o Gemini e o Editor com o
  Claude.

3. **Desligue a falha:** no terminal, **Ctrl + C**, depois rode `Remove-Item Env:MOCK_AI_FAILURES` e `npm run dev`. (Ou
   simplesmente feche esse terminal: a falha só valia nele.)

## Parte H: no celular (2 min, opcional)

Na janela anônima, clique com o **botão direito** em qualquer lugar da página → **Inspecionar** (no Opera GX, o F12 e o
Ctrl + Shift + I não abrem as ferramentas). Clique no ícone de celular (ou **Ctrl + Shift + M**) e escolha uma largura
pequena (ex.: 360). Abra os posts prontos (Receitas → Posts para redes sociais).

**Deu certo se:** tudo cabe na largura, sem rolar para o lado, e os botões ficam um embaixo do outro. Feche as
ferramentas no **X** do canto delas.

## Depois do teste

1. Pare o site no terminal (**Ctrl + C**).
2. Volte ao Claude Code e conte como foi (o que deu certo e o que não bateu, com prints se puder).
3. **Só faça o merge depois de o Claude confirmar** que está tudo certo.

**O que já foi conferido pelo Claude** (para você não precisar repetir), com uma empresa de mentira sem crédito, no
projeto de testes (60 conferências de ponta a ponta): os cartões; a estimativa e a troca de IA na tela do time; a
receita não começa sem crédito e diz por quê; a tela ao vivo com os dois redatores lado a lado, o aviso de troca de IA
e sem a caixa do site (que continua no site); o servidor cobra as 4 etapas com o nome da receita, cada redator com a IA
dele, e guarda o Word uma vez só (mesmo se cair e retomar), com o nome da receita, nunca com o pedido; a tela do
resultado, Copiar e Word com as hashtags e os emojis; Entregas, Meus gastos e o painel do dono, sem o pedido; o colega,
o dono e o dono de outra empresa **não** conseguem baixar os posts pela execução da Carla, e sem login também não; e as
telas em 360 e 320 px.

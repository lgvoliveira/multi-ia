# Guia: testar a receita "Proposta comercial" (bloco 1, primeiro PR)

> Escrito em 26/10/2026 (bloco 1 da nova ordem, issue #54) para o Luis fazer à mão, com a ajuda do chat do Claude
> (claude.ai). **Para o chat do Claude:** guie o Luis uma parte de cada vez, em português simples, e espere ele
> confirmar antes de seguir. Se uma tela não bater com o guia, ajude pelo print. **Nunca peça para ele colar no chat
> senhas, chaves, o e-mail dele ou o link de um convite.** Este guia não usa SQL nem o painel do Supabase.

## Para que serve

Conferir, no computador do Luis e com o projeto de testes do Supabase, o que este PR trouxe:
- **A receita "Proposta comercial"**, a primeira das três escolhidas para pequenas empresas: o **Consultor** (Claude)
  monta o roteiro, o **Redator** (GPT) escreve, o **Cliente exigente** (Claude) critica como quem vai receber a
  proposta, e o Redator entrega a **versão final**.
- **O resultado em texto:** até aqui, uma receita só sabia terminar num site. Agora termina também num texto, com a
  tela "Sua proposta está pronta", os botões **Copiar o texto** e **Baixar em Word**, e o Word vira uma **entrega** (aba
  Entregas e painel do dono).
- **Os cartões da aba Receitas:** saem as três receitas antigas ("Em breve") e entram as escolhidas para pequenas
  empresas: Proposta comercial (pronta), Posts para redes sociais e Relatório mensal para cliente (as duas "Em breve",
  que chegam nos próximos PRs).

Tudo continua com a **IA simulada**: a proposta que aparece é sempre a mesma de exemplo (a da Clínica Sorriso), seja
qual for o pedido, e ela "custa" o mesmo que a IA de verdade custaria.

Tempo total: uns 25 minutos.

Ferramentas: o navegador (com uma janela normal e uma anônima), o terminal do VS Code e o Word (ou outro programa que
abra arquivos .docx).

## Antes de começar

- **Não faça o merge deste PR antes de terminar este guia.**
- Este PR está **empilhado** sobre o PR #55 (o da nova ordem, só documentos). A ordem do merge é: primeiro o #55, depois
  clique em **Delete branch** nele, e só então este (confira que o alto do PR diz "into main").
- Não há migração nem biblioteca nova: não precisa rodar o workflow "Banco de testes" nem `npm install`.
- Tenha à mão a senha da sua conta de dono e a da funcionária **Carla Teste**, no projeto de testes. A sua empresa de
  teste tem crédito de mentira (uns R$ 18).

## Parte A: pôr o site na versão do PR (3 min)

1. Se o site estiver rodando num terminal, pare com **Ctrl + C**.
2. Num **terminal novo** do VS Code (menu **Terminal → New Terminal**), rode:
   ```
   git fetch
   git checkout feat/receita-proposta
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
- a **Proposta comercial** tem o botão **Usar receita** e o time **Consultor** (bolinha laranja, Claude), **Redator**
  (verde, GPT) e **Cliente exigente** (laranja, Claude);
- **Posts** e **Relatório** aparecem como **"Em breve"**;
- não aparecem mais "Escrever e revisar um texto", "Pesquisa com checagem cruzada" nem "Comitê de investimento".

## Parte C: rodar a proposta (5 min)

1. No cartão **Proposta comercial**, clique em **Usar receita**.

**Deu certo se:** abre a tela do time com os três papéis, cada um com a IA dele, e **"Custo estimado: até R$ 2,50"**.

2. No papel **Redator**, troque a IA para **Gemini**.

**Deu certo se:** a estimativa cai para **"até R$ 1,69"**. Volte o Redator para **GPT** (volta a "até R$ 2,50").

3. Na caixa do pedido, escreva algo como: *Proposta para a Clínica Sorriso, que pediu a gestão do Instagram dela por 3
   meses. Somos a Agência Ponto, de Campinas.* Clique em **Começar**.

**Deu certo se:** o time trabalha ao vivo, uma etapa de cada vez: **Consultor**, **Redator**, **Cliente exigente** e
**Versão final**. No fim (menos de um minuto), aparece a tela **"Sua proposta está pronta"**, com "Concluído em … ·
Custou R$ 0,0…" (uns 8 centavos).

## Parte D: a tela do resultado (5 min)

**Deu certo se**, na tela "Sua proposta está pronta":
- o texto aparece numa folha branca, com o título **"Proposta comercial — Clínica Sorriso"** em letra grande; as seções
  (**Apresentação**, **O que entendemos da sua necessidade**, **Solução proposta**, **Prazo**, **Investimento**,
  **Validade e próximos passos**) como subtítulos; os itens com bolinhas; e **Agência Ponto** em negrito;
- **nenhum** sinal estranho no texto, como `#` ou `**`;
- embaixo da folha, o aviso: "Confira o texto antes de mandar: o que estiver entre colchetes, como [valor], é para você
  preencher.";
- ao lado (ou embaixo, em tela estreita), **"Como o time chegou aqui"**, com as 4 etapas e a IA de cada uma.

1. Clique em **Copiar o texto**.

**Deu certo se:** o botão vira **"Copiado"** por uns segundos. Abra o **Bloco de Notas** e cole (**Ctrl + V**): vem a
proposta inteira, sem `#` nem `**`, com uma linha em branco antes de cada seção e os itens começando com "- ".

2. Clique em **Baixar em Word**.

**Deu certo se:** o navegador salva o arquivo **Proposta-comercial.docx** (não abre uma página). Abra no Word: o título
aparece como título, as seções como subtítulos, os itens como lista com marcadores e "Agência Ponto" em negrito, sem
`#` nem `**`.

3. Clique em **Ver todas as etapas**.

**Deu certo se:** aparecem o seu pedido e as 4 etapas, com o que cada IA escreveu.

## Parte E: recarregar e voltar (2 min)

1. Aperte **F5**.

**Deu certo se:** volta direto para "Sua proposta está pronta", com o mesmo texto.

2. Clique em **← Todas as receitas** e depois em **Usar receita** na Proposta comercial de novo.

**Deu certo se:** volta para a proposta pronta (o site lembra do último resultado da receita).

3. Clique em **Começar de novo**.

**Deu certo se:** volta para a tela do time, com a estimativa "até R$ 2,50".

## Parte F: Entregas, Meus gastos e o painel do dono (4 min)

1. Ainda como Carla, abra a aba **Entregas**.

**Deu certo se:** aparece **Proposta-comercial.docx**, com "Baixar" (que salva o mesmo Word).

2. Abra **Meus gastos**.

**Deu certo se:** a proposta aparece numa **linha só**, "Proposta comercial", com "Claude e GPT" e o valor da Parte C.

3. Numa **janela normal**, entre com a sua conta de **dono** e abra o painel. Na Carla, clique em **Ver o que fez**.

**Deu certo se:** aparecem a linha **"Proposta comercial"** (com o mesmo valor) e, nas entregas do mês,
**Proposta-comercial.docx** com "Baixar". O seu pedido da Parte C **não** aparece em lugar nenhum do painel.

## Parte G: o site continua igual (4 min)

Na janela anônima (Carla), volte a **Receitas**, abra **Criar um site** e rode com um pedido qualquer (ex.: *Um site para
a minha confeitaria*).

**Deu certo se:** termina em **"Seu site está pronto"**, com as abas **Prévia** e **Código** e o botão **Baixar
arquivo** (sem "Copiar o texto" nem "Baixar em Word"), como antes.

## Parte H: no celular (2 min, opcional)

Na janela anônima, clique com o **botão direito** em qualquer lugar da página → **Inspecionar** (no Opera GX, o F12 e o
Ctrl + Shift + I não abrem as ferramentas). Clique no ícone de celular (ou **Ctrl + Shift + M**) e escolha uma largura
pequena (ex.: 360). Abra a proposta pronta (Receitas → Proposta comercial).

**Deu certo se:** tudo cabe na largura, sem rolar para o lado, e os botões ficam um embaixo do outro quando não cabem
lado a lado. Feche as ferramentas no **X** do canto delas.

## Depois do teste

1. Pare o site no terminal (**Ctrl + C**).
2. Volte ao Claude Code e conte como foi (o que deu certo e o que não bateu, com prints se puder).
3. **Só faça o merge depois de o Claude confirmar** que está tudo certo, e na ordem: primeiro o PR #55, **Delete
   branch** nele, depois este.

**O que já foi conferido pelo Claude** (para você não precisar repetir), com uma empresa de mentira sem crédito, no
projeto de testes (49 conferências de ponta a ponta): a receita não começa sem crédito e diz por quê; o servidor cobra
as 4 etapas com o nome da receita, guarda o Word uma vez só (mesmo se cair e retomar) e com o nome da receita, nunca
com o pedido; o colega, o dono e o dono de outra empresa **não** conseguem baixar a proposta pela execução da Carla, e
sem login também não; o site continua virando o .html nas entregas; e a tela em 360 e 320 px.

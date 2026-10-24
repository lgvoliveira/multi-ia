# Plataforma Multi-IA (OCK) — Documento do Projeto

> **Versão oficial:** este arquivo, no repositório. Atualizado pelo Claude ao fim de cada etapa.
> Versão online (para leitura e compartilhamento, pode ficar defasada): https://claude.ai/code/artifact/2b5773d4-3ece-4278-9147-06cd89fda02d
> **Falhas e riscos conhecidos:** `docs/FALHAS.md` (lista viva, atualizada a cada falha nova).

Oct 8, 2026 · @Luis Gustavo Vilela Oliveira · **Revisado em 22/10/2026: o produto passou a ser para empresas.**
Atualizado em 24/10/2026 com as decisões do banco: teto por mês, o que o dono vê, "Traga sua chave" fora.

## Visão e problema

Uma plataforma brasileira de IA **para empresas pequenas e médias**. A empresa assina o serviço, cadastra os
funcionários, e cada funcionário usa as melhores IAs (Claude, GPT, Gemini e outras) nas tarefas e projetos do dia a dia,
sozinhas ou trabalhando juntas em **receitas** prontas. O dono acompanha o que cada um entregou e quanto gastou, e
define um teto de gasto para cada funcionário.

Nome provisório no código: **OCK**. O nome definitivo e a marca ainda estão em aberto.

**O problema:** nas empresas pequenas e médias, cada funcionário usa uma IA diferente, muitas vezes na conta pessoal,
com dados de clientes, sem padrão de qualidade. O dono não sabe o que está sendo feito, quanto custa, nem se o resultado
é bom. As soluções para empresas dos grandes laboratórios prendem a empresa a uma IA só e costumam ser cobradas em
dólar, por usuário. As ferramentas que combinam várias IAs (LangGraph, CrewAI, n8n, Gumloop, OpenRouter) são técnicas
e em inglês.

**A aposta:** uma plataforma em português, cobrada em reais, que junta as melhores IAs num só lugar, traz receitas
prontas para o trabalho de verdade e dá ao dono controle de uso e gasto.

**Como a ideia mudou:** até 19/10/2026 o produto era para a pessoa comum (uma pessoa, uma conta). No PR #19 (20/10) o
parceiro do Luis levou o produto para empresas, e em 22/10 o Luis confirmou essa direção e definiu como as receitas e a
escolha da IA entram (seções abaixo). O motor, as receitas e as regras de segurança feitos até a etapa 4 continuam
valendo.

## Público-alvo e proposta de valor

**Quem compra:** empresas pequenas e médias no Brasil que prestam serviço e cujos funcionários fazem muito trabalho de
texto, pesquisa, análise e criação. Exemplo típico: uma agência de marketing. Não é para empresas de ticket muito alto.

**Quem usa:** os funcionários dessas empresas, que não são desenvolvedores.

**Público amplo de propósito (decisão do Luis, 22/10):** por enquanto o produto serve qualquer PME, para testar com
tipos diferentes de empresa. Se mais adiante fizer sentido focar num nicho (ex.: agências), o produto já estará pronto e
muda pouco: receitas e textos mais específicos. Risco anotado em F02 do `FALHAS.md`.

| Diferencial | Por que importa |
| --- | --- |
| Várias IAs num lugar só | A empresa não fica presa a uma IA; cada tarefa usa a mais adequada |
| Receitas prontas para o trabalho | O funcionário escolhe o serviço e um time de IAs já vem montado |
| Controle do dono | Vê o que cada funcionário entregou, o que fez e quanto gastou; define um teto por funcionário |
| Tudo em português, preço em reais | Sem cartão internacional nem fatura em dólar |
| Sem chave de API | A empresa nunca precisa criar conta nas empresas de IA |
| Recomendação de IA com liberdade | A plataforma sugere a IA e o nível, mas o funcionário pode escolher outra |
| LGPD | Argumento de confiança (os cuidados necessários estão em F05 do `FALHAS.md`) |
| WhatsApp (futuro) | Canal onde o brasileiro realmente trabalha |

## Como funciona

### Dois lados: o dono e o funcionário

- **Dono da empresa:** cadastra os funcionários, define o teto de gasto de cada um, paga o crédito da empresa e
  acompanha, por funcionário, o que foi entregue, o que foi feito e quanto foi gasto (também por IA).
  - **O que o dono vê (decisão do Luis, 24/10):** o resumo do trabalho de cada um (quem fez, quando, com qual receita
    ou IA, quanto custou) e as entregas. Ele **não** lê pedidos, respostas nem conversas dos funcionários. Passar a
    mostrar as conversas no futuro exige avisar os funcionários antes.
  - **O crédito** só é lançado pela plataforma, depois do pagamento (no MVP, Pix conferido à mão). O dono vê o saldo e o
    extrato, mas não mexe neles (F25).
- **Funcionário:** recebe do dono um convite (um link que só funciona uma vez e vale 24 horas, mandado por WhatsApp ou
  como o dono preferir), cria a própria senha e trabalha no **workspace**. Só ele conhece a senha (decisão do Luis, 24/10).

### Três jeitos de trabalhar no workspace (decisão do Luis, 22/10)

1. **Receita pronta:** o funcionário escolhe um serviço (ex.: "Criar um site", "Escrever e revisar um texto") e um time
   de IAs já vem montado, com papéis (chefe, executor, revisor) e a IA recomendada para cada um. Ele pode trocar as IAs,
   descreve o pedido e acompanha cada IA trabalhando até o resultado.
2. **Receita própria:** se não houver receita pronta para o serviço, o funcionário monta a dele (papéis, IAs e
   instruções).
3. **Tarefa rápida:** para um serviço rápido, ele só pede, como num chat, sem montar receita.

Ideia aprovada em 09/10, ainda sem data: nas receitas, em vez de uma caixa em branco, perguntas guiadas (ex.: nome do
negócio, o que vende, cores), para o funcionário não precisar saber escrever um bom pedido.

### Quem escolhe a IA (decisão do Luis, 22/10)

A plataforma **recomenda** a IA, o nível do modelo (econômico, padrão ou potente) e o esforço para cada tarefa. Nas
receitas, a recomendação vem em cada papel; na tarefa rápida, quem recomenda é o **Chefe**, que lê o pedido e sugere o
que resolve melhor pelo menor custo. O funcionário sempre pode escolher outra coisa ("nesta tarefa quero o melhor",
"quero o Claude"). A recomendação é o padrão, nunca uma trava.

Cada papel é um modelo de IA com uma instrução específica (o "prompt de sistema"). Ferramentas como Claude Code e Codex
são produtos separados e ficam para integrações futuras.

### O que existe hoje no código (atualizado em 24/10)

- Login de verdade (etapa 5, PR 2a): o dono cria a conta da empresa e confirma o e-mail; dono e funcionário entram pela
  mesma tela, e cada um vai para a sua página. O painel do dono mostra a equipe; o convite de funcionário vem no PR 2b.
- Workspace com chat, ainda nas tabelas antigas: fica com um aviso de "em obras" até o PR 3.
- O Chefe já escolhe sozinho a IA, o nível, o esforço e a ação (responder, imagem, código, pesquisa, documento,
  gráfico ou projeto em .zip). **Falta** o funcionário poder escolher.
- O chat gera arquivos: PDF, Word, Excel, CSV, gráficos e projeto em .zip. Aceita voz e arquivos enviados.
- A receita "Criar um site" existe, mas **fora** do workspace. Faltam as receitas, a receita própria e a ligação com
  a empresa e os gastos (F08 do `FALHAS.md`).
- O painel antigo do dono (gastos por IA, tarefas, crédito) saiu no PR 2a; volta no PR 3, ligado ao banco novo.

## Receitas iniciais

As receitas ficam dentro do workspace do funcionário. A lista abaixo é a original; com o produto para empresas,
vale acrescentar receitas do trabalho de uma PME (ex.: post e legenda para redes sociais, proposta comercial,
relatório mensal para cliente). Essas novas ainda são ideias, não decisões.

O MVP começa com receitas cujo resultado é texto ou código, que só exigem as APIs. As que precisam de ambiente de execução ficam para depois.

| Receita | Time sugerido | Fase |
| --- | --- | --- |
| Criar um site simples | Chefe + programador + revisor | MVP |
| Escrever e revisar um texto | Redator + revisor crítico | MVP |
| Pesquisa com checagem cruzada | Pesquisador + verificador + síntese | MVP |
| Comitê de investimento | Analista da tese + advogado do diabo + consolidador | MVP |
| Analisar contrato ou documento | Leitor + revisor jurídico + resumo | Fase 2 |
| Revisão de modelo financeiro e valuation | Auditor + segundo auditor | Fase 2 (precisa ler planilhas) |
| Editar um vídeo gravado | Transcritor + editor (decide os cortes) + revisor | Fase 3 (precisa de oficina na nuvem) |
| Gerar vídeo do zero | Roteirista + diretor de cena + modelo de vídeo | Fase 3 (custo alto por segundo de vídeo) |

**Vídeo na fase 3** (ideias aprovadas pelo Luis em 09/10/2026):

1. **Editar um vídeo que a pessoa gravou:** cortar silêncios e erros, pôr legendas, fazer cortes curtos para Reels e TikTok, adicionar música e logo. Uma IA transcreve o áudio, o Claude ou o GPT decide os cortes lendo a transcrição, e a oficina na nuvem monta o vídeo (servidor próprio com ffmpeg ou APIs prontas como Shotstack e Creatomate). É a mais realista e a que mais combina com pequeno negócio e criador de conteúdo. Concorrentes: OpusClip, Submagic, CapCut.
2. **Gerar vídeo do zero:** cenas que não existem, criadas por modelos de vídeo via API. O custo por segundo é alto, então pede preço de plano próprio (ou créditos avulsos).

Fica de fora: edição criativa profissional (ritmo, montagem artística, efeitos), em que a IA ainda é fraca. As duas ideias exigem upload de arquivos grandes, armazenamento e um servidor que renderiza.

## Arquitetura técnica

O coração continua sendo um motor separado da interface. Ele recebe pedidos de qualquer canal, executa as receitas (ou
a tarefa rápida), chama cada IA pela API dela e mede o custo de cada passo, que é descontado da carteira da empresa e
somado ao gasto do funcionário.

```
CANAIS                         MOTOR                                IAs VIA API
- Web: painel do dono     -->  - Receitas e times              -->  - Claude (API Anthropic)
- Web: workspace          -->  - Tarefa rápida + Chefe         -->  - GPT (API OpenAI)
- Conector MCP (futuro)   -->  - Executor de etapas            -->  - Gemini (API Google)
- WhatsApp (futuro)       -->  - Medição de custo
                                      |
                                      +--> Banco de dados (empresas, funcionários, tarefas, gastos, carteira)
                                      +--> Arquivos gerados e enviados
                                      +--> Oficina na nuvem (vídeo e código, fase 3)
```

**Stack:** Next.js com TypeScript (interface e servidor), Supabase (banco de dados, arquivos e, depois, login), Vercel
(hospedagem) e os SDKs oficiais de cada IA, ligadas diretamente, sem intermediário como o OpenRouter (decidido em
09/10/2026: a troca de IA funciona melhor quando as IAs falham separadas e não há taxa de intermediário).

**Chaves das IAs:** a plataforma usa as próprias chaves ("chaves-mãe"), só no servidor; a empresa nunca vê nem conecta
chave. **O "Traga sua chave" fica fora do produto para empresas** (decisão do Luis, 24/10): "sem chave de API" é um
dos diferenciais, e guardar chaves é a parte mais sensível de um banco. A página "Minhas chaves" ainda existe no código
e sai quando o código passar para o banco novo. Se a ideia voltar, entra numa mudança própria.

**Banco de dados:** desenho, regras de acesso e carteira em `docs/BANCO-DE-DADOS.md`; as tabelas vivem no repositório,
como migrações (`supabase/migrations/`).

## Modelo de negócio e precificação

**A empresa paga, não o funcionário.** A empresa assina o serviço e tem uma **carteira de créditos**; cada tarefa dos
funcionários consome créditos pelo custo real das IAs mais a margem da plataforma. O dono define o **teto de gasto** de
cada funcionário, **por mês** (renova todo dia 1º, à meia-noite de Brasília; decisão do Luis, 24/10), e nada começa
sem saldo na carteira da empresa.

**Em aberto (F04 do `FALHAS.md`):**

- Formato da cobrança: mensalidade por empresa com créditos incluídos, valor por funcionário, só pelo consumo, ou uma
  mistura.
- Margem sobre o custo das IAs e como lidar com a variação do dólar.
- Se haverá plano de teste grátis para empresas e como ele funciona.

**A conta central:** quanto a empresa paga *versus* quanto as IAs custam de verdade para o uso dos funcionários dela.
Internamente, o custo real em dólar de cada tarefa fica registrado para definir preço e margem.

**Assinaturas de consumo:** a Anthropic não permite usar assinaturas Claude em ferramentas de terceiros, então o
Claude entra sempre via API. O "Sign in with ChatGPT" (29/09/2026) permite usar o plano do ChatGPT em apps de terceiros,
mas exige aprovação para produtos pagos e faz pouco sentido para empresas que pagam pela plataforma.

## Concorrência e riscos

| Tipo | Exemplos | Ponto fraco para a PME brasileira |
| --- | --- | --- |
| Planos para empresas dos laboratórios | ChatGPT para equipes, Claude para equipes, Gemini no Google Workspace, Microsoft Copilot | Uma IA só; geralmente cobrados por usuário e em dólar; sem receitas para o trabalho brasileiro |
| Acesso unificado a modelos | OpenRouter | Só infraestrutura, para desenvolvedores |
| Frameworks multiagente | LangGraph, CrewAI, AutoGen | Exigem programação |
| Automação no-code | n8n, Gumloop, Zapier Agents | Em inglês, em dólar, curva de aprendizado alta |

O concorrente mais perigoso é o que a empresa **já paga**: muitas PMEs já têm Google Workspace (com Gemini) ou
Microsoft 365 (com Copilot). O diferencial precisa estar nas receitas, na escolha entre várias IAs, no controle do dono
e no preço em reais. O mercado brasileiro (players nacionais fazendo algo parecido) ainda não foi mapeado.

**Riscos e falhas:** a lista completa e atualizada fica em `docs/FALHAS.md`, com status de cada uma. Os principais hoje:
produto virar commodity sem as receitas (F01), preço e margem (F04), LGPD (F05) e o login de demonstração (F10 a F13).

## Escopo do MVP

O MVP prova uma coisa: **uma empresa pequena ou média usa a plataforma no dia a dia e acha que vale pagar por ela**,
porque os funcionários entregam melhor ou mais rápido e o dono enxerga e controla o uso.

**Entra**

- Cadastro da empresa e login de verdade para o dono e para os funcionários
- Painel do dono: funcionários, teto de gasto, crédito da empresa, entregas e gastos por funcionário e por IA
- Workspace do funcionário com os três modos: receitas prontas, receita própria e tarefa rápida
- As 4 receitas do MVP (marcadas na tabela acima), adaptadas ao uso dentro da empresa
- Recomendação de IA, nível e esforço, com o funcionário livre para escolher
- Histórico de tarefas e entregas
- Claude, GPT e Gemini via API, com a medição do custo de cada tarefa
- Geração de arquivos (PDF, Word, Excel, gráficos), que já existe

**Fica de fora por enquanto**

- Pagamento real (no início, empresas convidadas, com crédito carregado à mão)
- Vídeo e execução de código no servidor
- Conector MCP e WhatsApp
- Nichar para um tipo de empresa (F02)

## Regras de funcionamento

As regras abaixo valem para o MVP e entram no `AGENTS.md` como especificação para o código.

**Com o produto para empresas:** onde se lê "usuário", leia o funcionário. O "saldo" é a carteira da empresa, e o
funcionário nunca passa do teto do mês que o dono definiu para ele. Do histórico dos funcionários, o dono vê só o
resumo e as entregas (decisão de 24/10, acima).

**Erro de uma IA no meio da execução**

1. Tenta de novo automaticamente, até 2 vezes, com uma pequena espera (1 s e depois 2 s).
2. Se persistir, troca de IA naquele papel e avisa o usuário. Vem ligado por padrão nas receitas e pode ser desligado.
   Quem assume é a IA recomendada pela receita ou, se foi ela que falhou, a IA reserva definida na receita para aquele papel.
   A IA que assumiu continua no papel até o fim da execução.
3. Se ainda falhar, pausa sem perder nada: as etapas concluídas ficam salvas, e o usuário escolhe tentar de novo, trocar a IA ou cancelar. Ao retomar, continua da etapa que falhou.
4. Etapa que falhou não é cobrada.
5. Erro na chave do próprio usuário: avisa e não passa a usar créditos da plataforma sem autorização. (Só vale se o
   "Traga sua chave" voltar; hoje ele está fora.)

**Créditos e estimativa**

1. Antes de começar, mostra uma estimativa de custo e reserva esse valor do saldo. Sem saldo suficiente, a execução não começa e aparece a opção de recarregar.
2. Cobra cada etapa concluída pelo consumo real. No fim, devolve ao saldo a diferença entre o reservado e o gasto.
3. Se o custo for passar da estimativa, a execução pausa e pergunta antes de continuar. A plataforma não absorve diferenças.
4. Cancelou no meio: paga só o que já foi consumido.
5. Prioridade: estimativas boas e honestas, calculadas a partir do histórico real de cada receita. Sem porcentagem de confiança na tela por enquanto.
6. Internamente, registrar o custo real em dólar de cada execução, para definir preço e margem.

**O que fica salvo no histórico**

- Para o usuário: pedido, resultado final, time usado (papéis, IAs e instruções), cada etapa com entrada, saída, status e tempo, créditos cobrados, forma de pagamento e o botão "rodar de novo".
- Só interno: modelo exato, tokens e custo em dólar por etapa, erros técnicos, trocas de IA e uso por receita.
- Privacidade (LGPD): o usuário pode apagar qualquer item ou a conta inteira. O conteúdo (pedidos, respostas, conversas, arquivos) vai embora, mas a linha "gastou R$ X em tal dia" fica no extrato, porque é registro financeiro da empresa. As chaves de API nunca aparecem no histórico e ficam guardadas à parte, criptografadas. O tempo de guarda pode variar por plano.

**Limites**

- Pedido de até cerca de 4.000 caracteres no MVP, com contador visível. Planos pagos podem ter mais.
- Limite interno de tamanho da resposta de cada papel, para controlar custo.
- Uma execução por vez no plano grátis; mais nos pagos.
- Upload de arquivos fica para a fase 2, com limites próprios.

**Visual**

- Cores, fontes, espaçamentos e arredondamentos ficam centralizados num único arquivo de variáveis (tokens), para trocar o visual inteiro mudando poucas linhas.

**Sites gerados pelas receitas**

- O site entregue é um arquivo único, sem nada carregado de outros sites, com visual caprichado (animações e efeitos).
- Pode ter JavaScript leve, só "de enfeite" (menu, fotos que passam, animações). O site precisa funcionar completo mesmo sem ele, porque o revisor lê o código mas ainda não roda o site.
- A prévia mostra o site numa moldura isolada ("quarto trancado"): o código roda, mas não enxerga a conta, os créditos, a página da plataforma nem a internet. Isso protege usuários e administradores contra código malicioso plantado por instruções escondidas num texto colado no pedido ("injeção de prompt").
- Na prévia, os links internos do site (ex.: "Cardápio") funcionam, mas os que levam para fora (WhatsApp, telefone, e-mail, outros sites) não abrem; um aviso embaixo da prévia explica isso. No arquivo baixado, todos funcionam.

**Ideia guardada para depois:** "preço máximo garantido" (cobrar o consumo real até um teto e a plataforma absorver o excedente). Descartada por enquanto pelo risco de absorver diferenças grandes; reavaliar quando houver histórico de custos.

## Fluxo de desenvolvimento: Claude, Codex e GitHub

O GitHub é o ponto de encontro: as duas IAs leem o mesmo repositório e conversam por issues, pull requests e comentários, sem copiar e colar.

| Quem | Papel | Onde trabalha |
| --- | --- | --- |
| Luis | Dono do produto: decide o que construir, aprova e testa | GitHub e plataforma rodando |
| Parceiro do Luis | Sócio no projeto: discute o produto e também programa (fez o PR #19) | Claude Code, no mesmo repositório |
| Claude | Arquiteto e programador principal: escreve especificações, quebra em tarefas, programa e revisa | Claude Code / Cowork, conectado ao repositório |
| Codex | Segundo programador e revisor independente: pega tarefas isoladas e revisa PRs com outro olhar | Codex conectado ao mesmo repositório |

**Como as duas IAs se comunicam**

1. **Regras do projeto num arquivo só.** Um `AGENTS.md` na raiz descreve stack, padrões de código e decisões. O Codex lê esse arquivo automaticamente; o `CLAUDE.md` aponta para ele.
2. **Cada tarefa vira uma issue** com descrição e critério de pronto, escrita pelo Claude e aprovada pelo Luis.
3. **Quem implementa abre um pull request.** O outro modelo revisa e comenta no próprio PR.
4. **O Luis decide e faz o merge.** Divergências entre as IAs ficam registradas no PR, e a decisão final é dele.

**Recomendação prática:** começar com um programador principal só, para o código nascer coerente. O Codex entra como revisor dos PRs desde o início e passa a implementar tarefas quando a base estiver de pé. Esse fluxo de IAs colaborando é o próprio produto em miniatura, e vale anotar as dores que aparecerem.

## Próximos passos e decisões em aberto

**Próximos passos**

- [x] Desenhar as telas principais (receitas, editor do time, execução, resultado)
- [x] Criar conta no GitHub e o repositório do projeto
- [x] Escrever o `AGENTS.md` com a stack e as regras
- [x] Primeiro fluxo ponta a ponta com IA simulada (etapa 4, Parte A)
- [x] IAs reais ligadas no código (PR #19); falta conferir com chaves no computador do Luis
- [ ] Alinhar a visão nova com o parceiro (este documento e o `FALHAS.md`)
- [ ] Base para empresas: banco no repositório, login de verdade, cadastro de empresa, painel do dono protegido
- [ ] Workspace com receitas prontas, receita própria e tarefa rápida; escolha livre da IA
- [ ] Créditos, teto e preço
- [ ] Conversar com 3 a 5 donos de empresa e testar com empresas reais
- [ ] Mapear players brasileiros de IA para empresas

**Decisões em aberto**

- Nome e marca (OCK é provisório)
- Formato do preço, margem e plano de teste (F04)
- Se e quando nichar (F02)
- Cronograma, considerando o ritmo de cerca de 1 h por dia útil e sessões mais longas no fim de semana

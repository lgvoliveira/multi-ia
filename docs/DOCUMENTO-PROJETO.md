# Plataforma Multi-IA (OCK) — Documento do Projeto

> **Versão oficial:** este arquivo, no repositório. Atualizado pelo Claude ao fim de cada etapa.
> Versão online (para leitura e compartilhamento, pode ficar defasada): https://claude.ai/code/artifact/2b5773d4-3ece-4278-9147-06cd89fda02d
> **Falhas e riscos conhecidos:** `docs/FALHAS.md` (lista viva, atualizada a cada falha nova).

Oct 8, 2026 · @Luis Gustavo Vilela Oliveira · **Revisado em 22/10/2026: o produto passou a ser para empresas.**
Atualizado em 24/10/2026 com as decisões do banco: teto por mês, o que o dono vê, "Traga sua chave" fora.
Atualizado em 25/10/2026 com o chat (tarefa rápida) no banco novo: custo mostrado depois de cada resposta, imagem,
pesquisa, código e voz só com as IAs de verdade, mensagem de até 4.000 caracteres e gastos do funcionário em reais.
Atualizado em 25/10/2026 com o painel do dono (parte 3d, issue #43): uma receita vira uma linha só no extrato, o site da
receita vira entrega, o funcionário lê o que o dono vê, e só o mês atual por enquanto.
Atualizado em 26/10/2026 com a nova ordem do Luis: as IAs de verdade ficam para o fim, depois de seis blocos (próximos
passos, no fim deste documento). No mesmo dia, as receitas do MVP para PMEs (issue #54): Proposta comercial, Posts para
redes sociais e Relatório mensal para cliente, ao lado de "Criar um site"; o resultado em texto vira um arquivo Word.
Atualizado em 27/10/2026 com a receita "Posts para redes sociais" pronta (bloco 1, PR 2).

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
  - **O funcionário sabe disso (F05, parte 3d):** as abas Entregas e Meus gastos dizem "O dono da empresa vê suas
    entregas e quanto cada tarefa custou. Suas conversas, não." Por isso o nome e o título de um documento feito no chat
    saem do que a IA escreveu, nunca do pedido (F49).
  - **Uma receita é uma linha só** no extrato que o dono e o funcionário veem ("Criar um site · R$ 0,37", com as IAs que
    trabalharam), e não uma por etapa (decisão do Luis, 25/10). O site pronto vira uma entrega da pessoa (F47).
  - **O crédito** só é lançado pela plataforma, depois do pagamento (no MVP, Pix conferido à mão). O dono vê o saldo e o
    extrato, mas não mexe neles (F25).
- **Funcionário:** recebe do dono um convite (um link que só funciona uma vez e vale 24 horas, mandado por WhatsApp ou
  como o dono preferir), cria a própria senha e trabalha no **workspace**. Só ele conhece a senha (decisão do Luis, 24/10).
  Se perder a senha, o dono gera um link de senha nova, do mesmo jeito (até existir o envio de e-mail, F30).

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

### O que existe hoje no código (atualizado em 25/10)

- Login de verdade (etapa 5, PR 2a): o dono cria a conta da empresa e confirma o e-mail; dono e funcionário entram pela
  mesma tela, e cada um vai para a sua página.
- Painel do dono com a equipe (etapa 5, PR 2b): o dono convida um funcionário (nome, e-mail e teto do mês) e recebe um
  link para mandar, com botões para copiar e para abrir o WhatsApp com a mensagem pronta. O funcionário abre, cria a
  própria senha e entra. O dono muda o teto, desativa e reativa, e gera um link novo para quem não aceitou a tempo ou
  perdeu a senha.
- O painel do dono com o crédito e os gastos (etapa 5, parte 3d): no alto, "Disponível para a equipe", o saldo, o que está
  separado agora para tarefas em andamento e o gasto do mês dividido por IA (aviso vermelho sem crédito); na equipe, o
  gasto do mês de cada pessoa contra o teto, o resumo ("8 tarefas rápidas, 1 receita, 3 entregas") e "Ver o que fez" (as
  linhas do mês e as entregas, para baixar); e o extrato do mês, com as recargas. Só o mês atual, por enquanto. As contas
  são feitas dentro do banco, com as mesmas regras de quem vê o quê.
- A receita "Criar um site" (etapa 5, PRs 3a e 3b), para quem está logado, cobrando da carteira da empresa: mostra
  "até R$ X" antes de começar, reserva esse máximo, cobra cada etapa pelo consumo real e pausa se for passar.
- O espaço de trabalho (`/trabalho`, etapa 5, PR 3c) com o chat da **tarefa rápida**: conversas, anexos (PDF, texto e
  imagens) e arquivos gerados (PDF, Word, Excel, CSV, gráficos e projeto em .zip), mais as abas Entregas e Meus gastos
  (gasto do mês e teto, em reais). Cada resposta mostra quem o Chefe escolheu e "Custou R$ X".
- A aba **Receitas** no espaço de trabalho (issue #42): as receitas em cartões (as prontas e as do MVP que ainda faltam,
  como "Em breve"); a escolhida abre ali mesmo, sem sair da página, e o chat vazio sugere as receitas prontas.
- A receita **"Proposta comercial"** (bloco 1, issue #54), a primeira que termina num texto: a tela "Sua proposta está
  pronta" mostra o texto com títulos, listas e destaques, com **Copiar o texto** e **Baixar em Word**, e o Word vira uma
  entrega da pessoa, como o site. O nome do arquivo vem da receita, nunca do pedido (F49). Falta a receita
  própria (etapa 6, F08). O dono tem atalhos no topo do site entre o painel e o espaço de trabalho.
- A receita **"Posts para redes sociais"** (bloco 1, PR 2): o Estrategista define o público e três ângulos, dois
  redatores de IAs diferentes escrevem ao mesmo tempo um post para cada ângulo, e o Editor fica com a melhor versão de
  cada um. A tela "Seus posts estão prontos" mostra 3 opções, cada uma com a chamada, o texto, as hashtags e uma ideia
  de imagem, com Copiar e Word, como a proposta.
- O Chefe escolhe sozinho a IA, o nível, o esforço e a ação (responder, documento, gráfico, projeto, pesquisa, código ou
  imagem). **Falta** o funcionário poder escolher (etapa 6).
- Imagem, pesquisa na internet, rodar código e voz chegam com as IAs de verdade (decisão do Luis, 25/10): até lá,
  imagem responde "chega em breve", e pesquisa e código respondem em texto, avisando que a IA não pesquisou nem rodou
  nada. Receitas e chat ainda rodam só com a IA simulada.
- O site feito pela receita "Criar um site" vira uma entrega da pessoa (F47): aparece na aba Entregas e no painel do
  dono, e sempre baixa como arquivo.
- **Falta:** escolher outro mês e baixar o extrato em planilha; ver a prévia do site no painel; recarga feita pelo
  próprio dono e aviso de saldo baixo.

## Receitas iniciais

As receitas ficam dentro do workspace do funcionário. As do MVP foram escolhidas pelo Luis em 26/10/2026 (issue #54)
para o trabalho de uma pequena empresa, no lugar de três da lista original, pensadas para a pessoa comum.

O MVP começa com receitas cujo resultado é texto ou código, que só exigem as APIs. As que precisam de ambiente de execução ficam para depois.
Nas receitas de texto, quem revisa é sempre de outra família de IA que quem escreveu (com uma exceção aceita nos posts,
F57), e ninguém inventa preço, prazo,
número, cliente ou depoimento: o que falta vira um marcador entre colchetes, como [valor], para a pessoa preencher.

| Receita | Time sugerido | Fase |
| --- | --- | --- |
| Criar um site | Chefe + pesquisador + front-end + back-end, com revisão do chefe | MVP (pronta) |
| Proposta comercial | Consultor (roteiro) + redator + cliente exigente (crítica), e o redator entrega a versão final em Word | MVP (pronta desde 26/10) |
| Posts para redes sociais | Estrategista (público e três ângulos) + dois redatores ao mesmo tempo (GPT e Claude), um post por ângulo + editor que fica com a melhor versão de cada ângulo e entrega 3 opções em Word | MVP (pronta desde 27/10) |
| Relatório mensal para cliente | Analista dos números + redator + conferente que checa cada número contra os dados | MVP |
| Escrever e revisar um texto | Redator + revisor crítico | Ideia (o chat já faz boa parte) |
| Pesquisa com checagem cruzada | Pesquisador + verificador + síntese | Ideia (depende da pesquisa na internet de verdade) |
| Avaliar uma decisão (o antigo "Comitê de investimento") | A favor + advogado do diabo + conselheiro | Ideia |
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
dos diferenciais, e guardar chaves é a parte mais sensível de um banco. A página "Minhas chaves" saiu do código
em 24/10 (PR 3a). Se a ideia voltar, entra numa mudança própria.

**IA simulada ou de verdade:** um interruptor do servidor (`OCK_AI_MODE`) diz qual responde. No site publicado, sempre
a de verdade; a simulada (respostas de mentira, cobradas como as de verdade) serve para testar no computador sem gastar.
Com as IAs de verdade ligadas, uma IA sem chave falha (e a troca de IA entra), nunca vira a simulada sem avisar (F42).

**Ferramentas do chat** (ligadas uma a uma pelo interruptor `OCK_AI_TOOLS`, desligadas até a decisão do Luis): a
**pesquisa na internet** é a do Claude, que cita as fontes no fim da resposta (US$ 0,01 por pesquisa, até 3 por
mensagem); a do Gemini exige mostrar junto um bloco do Google e proíbe misturar o resultado com outro conteúdo, o que não
combina com as entregas. **Rodar código** para fazer contas é do Gemini, sem custo além dos tokens. **Criar imagens** é
do GPT Image (uma imagem quadrada de qualidade média, uns US$ 0,053), entregue como arquivo e mostrada na conversa. Sem a
ferramenta, a resposta avisa que não pesquisou ou não rodou o programa (F45), e a imagem "chega em breve". A **voz**
(ditar a mensagem, até 2 minutos) é transcrita pelo gpt-transcribe (US$ 0,0045 por minuto) e volta como texto na caixa,
para a pessoa revisar antes de enviar; o áudio não é guardado, e o extrato mostra só "Voz · Transcrição".

**Modelos de cada nível** (econômico / padrão / potente), conferidos nas páginas oficiais em 26/10/2026: Claude Haiku,
Sonnet e Opus 5.5; GPT-6 Luna, GPT-6.1 Sol e GPT-6 Astra; Gemini 3.5 Flash-Lite, 3.8 Flash e 4 Argon. Nomes e preços
ficam num lugar só (`lib/providers/models.ts`); o consumo cobrado é o que cada empresa informa, com o "pensamento" da
IA (F40). A escolha é provisória (PR das IAs de verdade) e deve ser revista no bloco 6, com as primeiras medições de
custo e qualidade e a pesquisa "Melhor IA por função" (`docs/pesquisas/melhor-ia-por-funcao-2026-10-12.pdf`).

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
- Margem sobre o custo das IAs e como lidar com a variação do dólar. Até isso ser decidido, cada uso custa o que as IAs
  custam, sem margem, com o dólar fixo em R$ 5,50 (decisão do Luis, 25/10; um número só em `lib/ock/pricing.ts`).
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
- As 4 receitas do MVP (marcadas na tabela acima), escolhidas para o trabalho de uma pequena empresa
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
   Por enquanto, a estimativa é o **máximo** que o time pode gastar ("até R$ X"), como a pré-autorização do cartão num
   hotel: reserva o máximo e cobra só o que foi gasto (decisão do Luis, 25/10). No MVP, a recarga é à mão: a tela diz
   para o funcionário pedir crédito ao dono, e para o dono falar com a nossa equipe.
2. Cobra cada etapa concluída pelo consumo real. No fim, devolve ao saldo a diferença entre o reservado e o gasto.
3. Se o custo for passar da estimativa, a execução pausa e pergunta antes de continuar. A plataforma não absorve diferenças.
4. Cancelou no meio: paga só as etapas concluídas; a etapa que estava rodando não é cobrada (decisão do Luis, 25/10).
   **Na tarefa rápida (chat)** não há estimativa antes de cada mensagem (decisão do Luis, 25/10): ela só existiria
   depois de o Chefe decidir, e pedir um OK a cada mensagem tiraria a graça da tarefa rápida. O servidor confere saldo e
   teto antes de qualquer IA, reserva o máximo da resposta depois que o Chefe decide, cobra o consumo real numa linha só
   e a tela mostra "Custou R$ X" em cada resposta. Resposta que falhou não é cobrada.
5. Prioridade: estimativas boas e honestas, calculadas a partir do histórico real de cada receita. Sem porcentagem de confiança na tela por enquanto.
   O histórico só existe depois das IAs de verdade; até lá vale o máximo (item 1), que nunca fica abaixo do gasto real.
6. Internamente, registrar o custo real em dólar de cada execução, para definir preço e margem.

**O que fica salvo no histórico**

- Para o usuário: pedido, resultado final, time usado (papéis, IAs e instruções), cada etapa com entrada, saída, status e tempo, créditos cobrados, forma de pagamento e o botão "rodar de novo".
- Só interno: modelo exato, tokens e custo em dólar por etapa, erros técnicos, trocas de IA e uso por receita.
- Privacidade (LGPD): o usuário pode apagar qualquer item ou a conta inteira. O conteúdo (pedidos, respostas, conversas, arquivos) vai embora, mas a linha "gastou R$ X em tal dia" fica no extrato, porque é registro financeiro da empresa. As chaves de API nunca aparecem no histórico e ficam guardadas à parte, criptografadas. O tempo de guarda pode variar por plano.

**Limites**

- Pedido de até cerca de 4.000 caracteres no MVP, com contador visível. Planos pagos podem ter mais.
- Limite interno de tamanho da resposta de cada papel, para controlar custo.
- Uma execução por vez no plano grátis; mais nos pagos.
- Anexos no chat (desde o PR 3c, 25/10): até 5 por mensagem, de até 10 MB cada; a IA lê PDF, texto (.txt, .csv, .md,
  .json) e imagens, e o texto dos anexos entra até 30.000 caracteres por mensagem, com aviso quando corta (F44). Ler
  Word e Excel anexados, e anexos nas receitas, ficam para depois.

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
- [x] IAs reais ligadas no código (PR #19) e preparadas sem gastar (consumo real, modelos e preços oficiais); falta
  conferir com chaves (bloco 6)
- [x] Base para empresas: banco no repositório, login de verdade, cadastro de empresa, painel do dono protegido,
  carteira, teto e estimativa (etapa 5, concluída em 26/10)
- [ ] Alinhar a visão nova com o parceiro (este documento e o `FALHAS.md`)

**Nova ordem (decisão do Luis, 26/10/2026):** as IAs de verdade ficam para o fim. Antes, todo o resto do site
funcionando com a IA simulada, um bloco de cada vez, cada um com a proposta aprovada pelo Luis antes de começar:

| Bloco | O que entra |
| --- | --- |
| 1 — O produto do funcionário | 3 receitas escolhidas para PMEs (no lugar das 3 "Em breve"), receita própria salva só para a pessoa ou para a empresa toda, e escolha livre da IA, do nível e do esforço no chat (F03) |
| 2 — Conta de verdade | E-mail próprio para o login (F30), recuperar a senha do dono, termos de uso e política de privacidade com aceite no cadastro (F05; rascunho a ser revisto por um advogado antes da primeira empresa de verdade) |
| 3 — Painel interno da plataforma | Área protegida para a equipe da plataforma: empresas, recarga de crédito pela tela, extrato de recargas e custo real das IAs contra o cobrado |
| 4 — Pagamento, só preparar | Comparação de gateways (Pix, boleto, cartão) com fontes oficiais; programar só depois da decisão do preço (F04) e do CNPJ; o pagamento confirmado vira uma recarga automática |
| 5 — Publicação | Site no ar na Vercel, com domínio, chaves de produção e a F54 resolvida |
| 6 — IAs de verdade | Primeiro teste com créditos, medição de custo e tempo e revisão dos modelos de cada papel (com a pesquisa de 12/10, `docs/pesquisas/`) |

Depois dos seis blocos:

- [ ] Conversar com 3 a 5 donos de empresa e testar com empresas reais
- [ ] Mapear players brasileiros de IA para empresas

**Decisões em aberto**

- Nome e marca (OCK é provisório)
- Formato do preço, margem e plano de teste (F04)
- Se e quando nichar (F02)
- Cronograma, considerando o ritmo de cerca de 1 h por dia útil e sessões mais longas no fim de semana

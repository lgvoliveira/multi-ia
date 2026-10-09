# Plataforma Multi-IA — Documento do Projeto

> **Versão oficial:** este arquivo, no repositório. Atualizado pelo Claude ao fim de cada etapa.
> Versão online (para leitura e compartilhamento, pode ficar defasada): https://claude.ai/code/artifact/2b5773d4-3ece-4278-9147-06cd89fda02d

Oct 8, 2026 · @Luis Gustavo Vilela Oliveira

## Visão e problema

Uma plataforma brasileira onde qualquer pessoa monta um **time de IAs** (Claude, GPT, Gemini e outras) que trabalham juntas numa tarefa, sem precisar saber o que é API, token ou agente.

**O problema:** ferramentas que conectam várias IAs já existem lá fora (LangGraph, CrewAI, n8n, Gumloop, OpenRouter), mas são técnicas, em inglês e cobradas em dólar. Para o usuário comum e para a pequena empresa brasileira, isso continua inacessível.

**A aposta:** quem resolver a acessibilidade (português, receitas prontas, preço em reais) captura um público que as ferramentas globais não priorizam.

## Público-alvo e proposta de valor

O público inicial é quem já usa IA no dia a dia, mas não é desenvolvedor: freelancers, criadores de conteúdo, pequenas empresas e estudantes.

| Diferencial | Por que importa no Brasil |
| --- | --- |
| Tudo em português | Interface, receitas e instruções das IAs pensadas para o brasileiro |
| Preço em reais, com Pix | Elimina cartão internacional e crédito pré-pago em dólar |
| Receitas prontas | O usuário escolhe o objetivo, e o time de IAs já vem montado |
| Sem chave de API | A plataforma fornece o acesso; quem quiser pode trazer a própria chave |
| WhatsApp (futuro) | Canal onde o brasileiro realmente trabalha |
| LGPD | Argumento de confiança para pequenas empresas |

## Como funciona: receitas e times de IA

O produto é geral, mas a porta de entrada é concreta: o usuário escolhe um objetivo e recebe um time de IAs pré-configurado, que pode editar.

1. **Escolhe a receita**: por exemplo, “Criar um site”.
2. **Vê o time recomendado**: cada papel já tem uma IA sugerida.
   - Chefe (planeja e divide o trabalho): Claude
   - Programador: GPT
   - Revisor (critica e aponta erros): Gemini
3. **Ajusta se quiser**: troca a IA de um papel, adiciona ou remove papéis.
4. **Descreve a tarefa** em português.
5. **Acompanha o trabalho**: cada IA aparece trabalhando em sequência, e o chefe consolida o resultado.
6. **Recebe o resultado** e pode pedir ajustes.

Quem preferir pode criar um **projeto próprio** do zero, definindo papéis e IAs.

Cada papel é um modelo de IA com uma instrução específica (o “prompt de sistema”). Ferramentas como Claude Code e Codex são produtos separados e ficam para integrações futuras.

## Receitas iniciais

O MVP começa com receitas cujo resultado é texto ou código, que só exigem as APIs. As que precisam de ambiente de execução ficam para depois.

| Receita | Time sugerido | Fase |
| --- | --- | --- |
| Criar um site simples | Chefe + programador + revisor | MVP |
| Escrever e revisar um texto | Redator + revisor crítico | MVP |
| Pesquisa com checagem cruzada | Pesquisador + verificador + síntese | MVP |
| Comitê de investimento | Analista da tese + advogado do diabo + consolidador | MVP |
| Analisar contrato ou documento | Leitor + revisor jurídico + resumo | Fase 2 |
| Revisão de modelo financeiro e valuation | Auditor + segundo auditor | Fase 2 (precisa ler planilhas) |
| Edição de vídeo | Roteirista + editor via código (ffmpeg) | Fase 3 (precisa de oficina na nuvem) |

## Arquitetura técnica

O coração é um único motor de orquestração. Ele recebe pedidos de qualquer canal, executa as etapas do time e chama cada IA pela API dela.

```
CANAIS (onde o usuário entra)      MOTOR DE ORQUESTRAÇÃO            IAs VIA API
- Plataforma web (principal)  -->  - Receitas e times          -->  - Claude (API Anthropic)
- Conector MCP (futuro)       -->  - Executor de etapas        -->  - GPT (API OpenAI)
- WhatsApp (futuro)           -->  - Créditos e cobrança       -->  - Gemini (API Google)
                                          |
                                          +--> Banco de dados (usuários, histórico, créditos)
                                          +--> Oficina na nuvem (vídeo e código, fase 3)
```

Como o motor é separado da interface, o conector MCP e o WhatsApp entram depois sem reconstruir nada. A oficina na nuvem (servidor com ffmpeg e afins) só entra quando houver receitas de vídeo ou de execução de código.

**Stack sugerida:** Next.js com TypeScript (interface e servidor), Supabase (login e banco de dados), Vercel (hospedagem) e os SDKs oficiais das IAs ou o OpenRouter.

## Modelo de negócio e precificação

O modelo é uma assinatura mensal em reais com créditos de uso incluídos, porque o custo da plataforma cresce com o uso de cada cliente.

| Plano | Para quem | Como funciona |
| --- | --- | --- |
| Grátis | Quem está conhecendo | Poucas execuções por mês, para experimentar |
| Padrão | Usuário comum | Mensalidade com créditos incluídos; a plataforma paga as APIs por trás |
| Traga sua chave | Quem já tem conta de API | Mais barato; o consumo das IAs vai para a conta do próprio usuário |
| Conector MCP (futuro) | Quem já vive no Claude ou no ChatGPT | Versão low cost: as receitas rodam dentro do chat que o usuário já assina |

**A conta central:** quantos créditos o plano inclui *versus* quanto cada execução custa em API. Créditos extras podem ser comprados avulsos.

**Assinaturas de consumo:** o “Sign in with ChatGPT”, lançado em 29/09/2026, permite usar o plano Plus/Pro em apps de terceiros, mas exige aprovação para produtos pagos. A Anthropic não permite o uso de assinaturas Claude em ferramentas de terceiros, então o Claude entra sempre via API.

## Concorrência e riscos

A versão genérica da ideia já existe; o diferencial precisa vir de acessibilidade e localização.

| Tipo | Exemplos | Por que não atende o público-alvo |
| --- | --- | --- |
| Acesso unificado a modelos | OpenRouter | É só infraestrutura, para desenvolvedores |
| Frameworks multiagente | LangGraph, CrewAI, AutoGen | Exigem programação |
| Automação no-code | n8n, Gumloop, Zapier Agents | Em inglês, em dólar, curva de aprendizado alta |
| Os próprios laboratórios | Anthropic, OpenAI, Google | Cada um empurra o próprio modelo, não a combinação |

**Riscos principais**

- **Plataforma:** OpenAI, Anthropic ou Google lançam algo parecido. Defesa: português, reais, receitas locais e WhatsApp.
- **Margem:** o custo de API varia com o uso. Defesa: limite de créditos por plano e escolha de modelos mais baratos para papéis simples.
- **Valor percebido:** o usuário pode não ver vantagem em várias IAs *versus* uma só. Defesa: validar com usuários reais antes de escalar.
- **Mercado brasileiro:** ainda não foi mapeado com cuidado. É preciso confirmar se há players nacionais fazendo isso.

## Escopo do MVP

O MVP prova uma coisa: um usuário leigo consegue rodar um time de IAs e acha o resultado melhor do que usar uma IA só.

**Entra**

- Cadastro e login
- Tela de receitas com 4 receitas prontas (as marcadas como MVP acima)
- Editor simples do time: trocar a IA de cada papel
- Execução em sequência (chefe → executores → revisor → consolidação), mostrando cada etapa na tela
- Histórico de execuções
- 3 modelos disponíveis: Claude, GPT e Gemini, via API
- Contador de créditos

**Fica de fora por enquanto**

- Pagamento real (no início, acesso por convite)
- “Traga sua chave”
- Upload de arquivos, vídeo e execução de código
- Conector MCP e WhatsApp
- Projeto próprio totalmente livre

## Regras de funcionamento

As regras abaixo valem para o MVP e entram no `AGENTS.md` como especificação para o código.

**Erro de uma IA no meio da execução**

1. Tenta de novo automaticamente, até 2 vezes, com uma pequena espera.
2. Se persistir, troca de IA naquele papel e avisa o usuário. Vem ligado por padrão nas receitas e pode ser desligado.
3. Se ainda falhar, pausa sem perder nada: as etapas concluídas ficam salvas, e o usuário escolhe tentar de novo, trocar a IA ou cancelar. Ao retomar, continua da etapa que falhou.
4. Etapa que falhou não é cobrada.
5. Erro na chave do próprio usuário: avisa e não passa a usar créditos da plataforma sem autorização.

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
- Privacidade (LGPD): o usuário pode apagar qualquer item ou a conta inteira. As chaves de API nunca aparecem no histórico e ficam guardadas à parte, criptografadas. O tempo de guarda pode variar por plano.

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
- [ ] Criar contas de API (Anthropic, OpenAI, Google) com limite baixo de gasto — adiado: o fluxo é construído primeiro com uma IA simulada (custo zero) e só é ligado às IAs reais quando já estiver funcionando visivelmente na tela
- [x] Escrever o `AGENTS.md` com a stack e as regras
- [ ] Construir o primeiro fluxo ponta a ponta: uma receita, três IAs, resultado na tela
- [ ] Testar com 5 a 10 pessoas (colegas do Insper, conhecidos) e anotar o que travou
- [ ] Mapear players brasileiros de IA e automação

**Decisões em aberto**

- Nome e marca da plataforma
- Preço dos planos e quantidade de créditos
- Usar o OpenRouter ou as APIs de cada empresa diretamente
- Cronograma do MVP, considerando o ritmo de cerca de 1 h por dia útil e sessões mais longas no fim de semana

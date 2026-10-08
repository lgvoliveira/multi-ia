# PROGRESSO — Plataforma Multi-IA

> Diário do projeto. Toda conversa nova (Cowork ou Claude Code) começa lendo este arquivo.
> Atualizado pelo Claude ao fim de cada etapa.
> **Versão oficial:** este arquivo, no repositório `C:\Users\Luis\projetos\multi-ia\docs\`.

**Última atualização:** 08/10/2026 (noite, início da etapa 4)
**Etapa atual:** 4 — Primeiro fluxo ponta a ponta (1 receita, 3 IAs, resultado na tela)

---

## Links importantes

- Repositório (privado): https://github.com/lgvoliveira/multi-ia
- Pasta local do código: `C:\Users\Luis\projetos\multi-ia` (fora do OneDrive)
- Documento do projeto (visão, receitas, arquitetura, negócio, MVP):
  https://claude.ai/code/artifact/2b5773d4-3ece-4278-9147-06cd89fda02d
- Protótipo das telas (canvas de design, 10 telas clicáveis):
  https://claude.ai/artifact/XWxF7wU57nRp5Yq7PTZY3n
- Documento no repositório: `docs/DOCUMENTO-PROJETO.md` (versão oficial; o online é para leitura e pode ficar defasado)

## Resumo da ideia

Plataforma brasileira onde qualquer pessoa monta um "time de IAs" (Claude, GPT, Gemini)
que trabalham juntas numa tarefa, sem precisar saber o que é API.
Produto geral, mas com "receitas" prontas: o usuário escolhe o objetivo
(ex.: criar um site) e o time de IAs já vem montado, com papéis (chefe, programador,
revisor) e a IA recomendada para cada um. Pode editar ou criar projeto próprio.

## Decisões tomadas

- Público: usuário comum e pequenas empresas no Brasil, não desenvolvedores.
- Diferenciais: português, preço em reais (Pix), receitas prontas, sem precisar de chave de API.
- Monetização: assinatura mensal em reais com créditos incluídos (a plataforma paga as APIs).
  Planos: Grátis, Padrão, "Traga sua chave" (mais barato) e, no futuro, Conector MCP (low cost).
- Claude entra sempre via API (assinaturas Claude não podem ser usadas em apps de terceiros).
  ChatGPT pode entrar via "Sign in with ChatGPT" no futuro (exige aprovação da OpenAI).
- Chave própria (BYOK): conectada uma vez na conta (Configurações > Minhas chaves de API).
  Em qualquer projeto (receita ou próprio) o usuário escolhe pagar com "Créditos da plataforma"
  ou "Minhas chaves". Página de chaves traz link direto + passo a passo para pegar a chave.
- MVP só com receitas de texto/código. Vídeo fica para a fase 3 (precisa de "oficina na nuvem").
- Receitas do MVP: Criar site simples; Escrever e revisar texto; Pesquisa com checagem cruzada;
  Comitê de investimento.
- Stack sugerida: Next.js + TypeScript, Supabase (login e banco), Vercel (hospedagem),
  SDKs oficiais das IAs ou OpenRouter.
- Desenvolvimento: Claude como programador principal. Codex entra depois como revisor
  de pull requests. Comunicação entre as IAs pelo GitHub (AGENTS.md, issues, PRs).

- Regras de funcionamento definidas (detalhes no DOCUMENTO-PROJETO.md, seção "Regras de funcionamento"):
  erro de IA = 2 tentativas -> troca de IA -> pausa sem perder nada; etapa com falha não cobra.
  Créditos = estimativa + reserva, cobra consumo real, devolve diferença; se for passar da estimativa, pausa e pergunta.
  Histórico com camada do usuário + camada interna (custo em dólar); LGPD; chaves criptografadas à parte.
  Limites: pedido ~4.000 caracteres, teto por resposta, 1 execução simultânea no grátis.
  Visual centralizado em tokens (fácil trocar cores/fontes depois).
- Ideia guardada: "preço máximo garantido" — descartada por enquanto (risco de absorver diferenças).

## Sobre o Luis (forma de trabalhar)

- Disponibilidade: ~1 h por dia útil + sessões mais longas no sábado e domingo.
- Está aprendendo; prefere explicações claras quando o tema é novo.
- Modelo: Opus 5.5 em esforço Alto como padrão; Extra alto para sessões longas de código.
- Regra de troca de conversa: o Claude avisa quando for hora de abrir uma conversa nova e diz
  onde abrir (Cowork ou Claude Code), qual mensagem colar e qual nível de esforço usar.
  Antes de trocar, atualiza este arquivo.

## Etapas

| # | Etapa | Status | Onde |
|---|-------|--------|------|
| 1 | Ideia, discussão e documento do projeto | Concluída | Cowork |
| 2 | Desenho das telas + regras de funcionamento | Concluída | Cowork |
| 3 | Preparar ambiente: GitHub, repositório, AGENTS.md, Claude Code | Concluída (08/10) | Cowork |
| 4 | Primeiro fluxo ponta a ponta (1 receita, 3 IAs, resultado na tela) | Em andamento | Claude Code |
| 5 | Demais receitas do MVP, login, histórico, créditos | A fazer | Claude Code |
| 6 | Teste com 5 a 10 usuários e ajustes | A fazer | — |

## Etapa 3 — o que ficou pronto (08/10/2026)

- Node.js v24 e npm 11 (já existiam); política de execução do PowerShell liberada para o usuário.
- Git 2.55 instalado e configurado (nome, e-mail lgvoliveira1304@gmail.com, branch padrão `main`).
- Repositório privado `lgvoliveira/multi-ia` no GitHub, clonado em `C:\Users\Luis\projetos\multi-ia`.
- `AGENTS.md` (regras para as IAs), `CLAUDE.md` (aponta para o AGENTS.md), `.gitattributes`, `README.md`, `docs/`.
- Claude Code 2.1.295 instalado, logado com a assinatura e testado: leu o AGENTS.md corretamente.
- Decisões: código com nomes em inglês e telas em português; commits e PRs em português;
  o repositório é a casa oficial do PROGRESSO e do documento.
- **Contas de API adiadas:** a etapa 4 começa com uma "IA simulada" (respostas falsas, custo zero).
  Só depois que o fluxo estiver funcionando visivelmente na tela é que se compram os créditos
  (mínimo, ~US$5 cada, recarga automática DESLIGADA), se criam as chaves e se conectam as IAs reais.
  Gemini: plano grátis basta para testes (não enviar dados reais). Chaves nunca no chat; só no `.env.local`.

## Etapa 4 — plano aprovado (08/10/2026)

Receita escolhida: **Criar um site** (única do MVP com 3 IAs). Quatro etapas em sequência:
Chefe/Claude planeja → Programador/GPT escreve o site → Revisor/Gemini aponta erros →
Consolidação/Claude entrega o site final (um arquivo HTML). Construção "de dentro para fora":
peças invisíveis com testes primeiro, telas depois. Cada tarefa = 1 issue + 1 branch + 1 PR.

**Parte A — fluxo completo com a IA simulada (custo zero)**

| # | Tarefa | Status |
|---|--------|--------|
| T0 | Preparar o terreno: GitHub CLI (`gh`) + issues no GitHub | Concluída (issues #1 a #8, marco "Etapa 4") |
| T1 | Esqueleto do site: Next.js, tokens visuais, topo, CI | Em revisão (branch `feat/esqueleto-nextjs`) |
| T2 | IA simulada: contrato do "provedor", respostas em pedaços, testes (Vitest) | A fazer |
| T3 | Receita "Criar um site" como dados (papéis, prompts, etapas) + 3 receitas "em breve" | A fazer |
| T4 | Motor de orquestração: executa as etapas e narra eventos | A fazer |
| T5 | Telas: Receitas e Montar o time (trocar IA, pedido com contador de 4.000) | A fazer |
| T6 | Execução ao vivo: rota `/api/runs` com streaming + tela "Seu time está trabalhando" | A fazer |
| T7 | Resultado: prévia do site (iframe isolado), código, baixar arquivo, resumo do time | A fazer |
| T8 | Quando uma IA falha: 2 tentativas, troca de IA, aviso na tela (pausar/retomar fica para a etapa 5) | A fazer |

**Parte B — IAs de verdade (só depois da Parte A funcionando na tela):** decidir OpenRouter x APIs
diretas; comprar créditos mínimos (~US$ 5, recarga automática desligada) e criar chaves no `.env.local`;
**T9** adaptadores reais (a IA simulada continua para testes); medir o custo real em dólar.

**Fora da etapa 4:** login, créditos, histórico, banco e publicação na Vercel (publicar com IAs reais
sem login deixaria qualquer um gastar nossos créditos; a publicação entra junto com o login).

**Decisões desta etapa**
- Estilos com **CSS Modules** + tokens (sem Tailwind).
- **Vitest** aprovado para testes automáticos (entra na T2; só desenvolvimento).
- **GitHub CLI** instalado na máquina do Luis para o Claude criar issues e PRs.
- Next.js **16.4** (gerado com `create-next-app`, sem pasta `src/`). Esta versão traz a própria documentação
  em `node_modules/next/dist/docs/` e mantém um bloco automático no fim do AGENTS.md.
- Endereços das páginas com nomes em inglês (regra de nomes de arquivo do AGENTS.md).
- **Codex como revisor:** ainda não confirmado se está conectado ao GitHub. Enquanto não estiver,
  o Luis revisa e faz o merge sozinho.

## Próximo passo

Luis testa e faz o merge do PR da T1. Depois, T2 (IA simulada, issue #2).
As issues de cada tarefa têm o número igual ao da tarefa (T1 = #1 … T8 = #8).

## Decisões em aberto

- Nome e marca da plataforma
- Preço dos planos e quantidade de créditos
- OpenRouter ou APIs diretas de cada empresa
- Cronograma do MVP

## Como retomar em uma conversa nova

**No Claude Code (etapas de código):**
1. Abra o VS Code na pasta `C:\Users\Luis\projetos\multi-ia` e abra o terminal (Ctrl + ').
2. Rode `git pull` (traz a versão mais nova do GitHub) e depois `claude`.
3. Cole: "Estamos no projeto Multi-IA. Leia o AGENTS.md e o docs/PROGRESSO.md e continue de onde paramos."

**No Cowork (discussões, documentos, planejamento):**
1. Conecte a pasta `C:\Users\Luis\projetos\multi-ia`.
2. Cole: "Estamos no projeto da plataforma multi-IA. Leia o docs/PROGRESSO.md e continue de onde paramos."

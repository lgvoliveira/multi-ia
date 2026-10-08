# PROGRESSO — Plataforma Multi-IA

> Diário do projeto. Toda conversa nova (Cowork ou Claude Code) começa lendo este arquivo.
> Atualizado pelo Claude ao fim de cada etapa.

**Última atualização:** 08/10/2026 (noite)
**Etapa atual:** 3 — Preparar ambiente (GitHub, pasta fora do OneDrive, Node.js, Git, AGENTS.md)

---

## Links importantes

- Documento do projeto (visão, receitas, arquitetura, negócio, MVP):
  https://claude.ai/code/artifact/2b5773d4-3ece-4278-9147-06cd89fda02d
- Protótipo das telas (canvas de design, 10 telas clicáveis):
  https://claude.ai/artifact/XWxF7wU57nRp5Yq7PTZY3n
- Cópia local do documento: `DOCUMENTO-PROJETO.md` (nesta pasta; o online é a versão viva)

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

## Etapas

| # | Etapa | Status | Onde |
|---|-------|--------|------|
| 1 | Ideia, discussão e documento do projeto | Concluída | Cowork |
| 2 | Desenho das telas + regras de funcionamento | Concluída | Cowork |
| 3 | Preparar ambiente: GitHub, repositório, AGENTS.md, contas de API | A fazer | Cowork / Claude Code |
| 4 | Primeiro fluxo ponta a ponta (1 receita, 3 IAs, resultado na tela) | A fazer | Claude Code |
| 5 | Demais receitas do MVP, login, histórico, créditos | A fazer | Claude Code |
| 6 | Teste com 5 a 10 usuários e ajustes | A fazer | — |

## Próximo passo

Protótipo com 10 telas clicáveis: receitas, montar o time, time trabalhando, resultado,
entrar, criar conta, meus projetos, histórico, novo projeto próprio, minhas chaves de API.
Nome provisório na tela: "Multi-IA". Visual: fundo cinza claro, botões azuis (#2A3BD1),
cor por IA (Claude laranja, GPT verde, Gemini azul), fontes Bricolage Grotesque + IBM Plex Sans.
Telas aprovadas como referência (não serão detalhadas mais). Regras de funcionamento definidas.
Próximo: etapa 3 (preparar ambiente) em uma conversa nova.

## Decisões em aberto

- Nome e marca da plataforma
- Preço dos planos e quantidade de créditos
- OpenRouter ou APIs diretas de cada empresa
- Cronograma do MVP

## Como retomar em uma conversa nova

1. Conecte a pasta `plataforma-multi-ia`.
2. Cole: "Estamos no projeto da plataforma multi-IA. Leia o PROGRESSO.md da pasta e continue de onde paramos."

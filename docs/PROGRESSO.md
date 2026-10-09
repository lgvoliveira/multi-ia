# PROGRESSO — Plataforma Multi-IA

> Diário do projeto. Toda conversa nova (Cowork ou Claude Code) começa lendo este arquivo.
> Atualizado pelo Claude ao fim de cada etapa.
> **Versão oficial:** este arquivo, no repositório `C:\Users\Luis\projetos\multi-ia\docs\`.

**Última atualização:** 08/10/2026 (noite, T6 pronta para revisão)
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
| T1 | Esqueleto do site: Next.js, tokens visuais, topo, CI | Concluída (PR #9) |
| T2 | IA simulada: contrato do "provedor", respostas em pedaços, testes (Vitest) | Concluída (PR #10) |
| T3 | Receita "Criar um site" como dados (papéis, prompts, etapas) + 3 receitas "em breve" | Concluída (PR #11; JavaScript "de enfeite" no PR #12) |
| T4 | Motor de orquestração: executa as etapas e narra eventos | Concluída (PR #13) |
| T5 | Telas: Receitas e Montar o time (trocar IA, pedido com contador de 4.000) | Concluída (PR #14) |
| T6 | Execução ao vivo: rota `/api/runs` com streaming + tela "Seu time está trabalhando" | Concluída (PR #15) |
| T7 | Resultado: prévia do site em moldura isolada (o JS roda, mas sem acesso a nada), código, baixar arquivo, resumo do time | A fazer |
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
- **Sites gerados com JavaScript "de enfeite"** (decidido pelo Luis em 08/10, no PR #11): o site pode ter JS leve
  (menu, fotos que passam, animações), mas precisa funcionar completo sem ele, e o visual deve ser caprichado.
  A prévia roda o site num "quarto trancado" (moldura isolada, sem acesso à conta, aos créditos, à nossa página
  nem à internet). Motivos: proteger contra código plantado via "injeção de prompt" (texto colado com instruções
  escondidas) e contra erros, já que o revisor lê o código mas não roda o site.
- **Codex como revisor:** ainda não confirmado se está conectado ao GitHub. Enquanto não estiver,
  o Luis revisa e faz o merge sozinho.
- **Motor como "narrador"** (T4): o motor (`lib/engine/`) roda as etapas em ordem e devolve eventos
  (execução começou, etapa começou, pedaço de texto, etapa terminou, execução terminou, falhou, cancelada).
  Ele recebe as IAs prontas e não escolhe nenhuma. Uma regra no ESLint barra importar telas, Next.js ou React
  no motor, nas IAs e nas receitas.
- **O que cada IA recebe** (T4): prompt de sistema = papel + tarefa da etapa; entrada = o pedido e as respostas
  anteriores que a receita indica, cada parte marcada com `<parte nome="...">`.
- **Pedido** (T4): conferido no motor (vazio ou acima de 4.000 caracteres não começa; espaços nas pontas não contam).
  O limite fica em `MAX_REQUEST_CHARS`, que a tela da T5 usa no contador.

- **Telas da T5:** a página inicial separa "Receitas prontas" de "Em breve" (as 3 receitas do MVP que faltam
  aparecem apagadas, sem botão). Cada receita pronta tem seu endereço (`/recipes/create-site`); endereço
  inexistente ou de receita "Em breve" mostra uma página "não encontrada" em português. Na lista de IAs, a
  sugerida aparece como "(recomendada)". Para o navegador vai só o que a tela mostra: os prompts ficam no servidor.
- **Deixado de fora na T5** (estava no protótipo): busca de receitas, "+ Adicionar papel", forma de pagamento,
  custo estimado, receitas das fases 2 e 3 e "Criar projeto próprio". Entram quando chegar a vez delas.
- **Como as telas foram conferidas:** um roteiro temporário comanda o Chrome do computador (sem instalar nada no
  projeto), clica, digita e tira prints em tamanho de computador e de celular (390 e 320 px).

- **Rota `POST /api/runs`** (T6): responde uma linha de JSON por evento (formato "NDJSON") enquanto as IAs trabalham.
  Pedido inválido volta na hora, sem chamar IA, com os problemas em português. Só aceita JSON (isso também
  impede outro site de disparar execuções pelo navegador de alguém) e corpo de até 64 KB.
- **O que sai para o navegador** (T6): só o que o usuário pode ver, numa lista do que PODE sair
  (`lib/runs/public-events.ts`); campo interno novo no motor fica de fora sozinho. Modelo, tokens e mensagem
  técnica ficam no servidor (a falha vai para o registro do servidor).
- **Conexão caiu, IAs param** (T6): se a pessoa cancela, fecha a página ou perde a internet, o servidor manda a
  IA parar na hora (conferido: cancelou aos 2 s, o servidor parou junto).
- **Narração sem compactação** (T6): senão os pedaços chegam todos juntos no fim. Conferido também na versão de
  produção (`npm run build` + `next start`), que compacta as páginas comuns.
- **Tela "Seu time está trabalhando"** (T6): a própria página da receita troca do formulário para os cartões, sem
  endereço novo (a execução ainda não fica salva; com o banco, na etapa 5, cada execução ganha seu endereço).
  No lugar do "Pausar" do protótipo há "Cancelar" (pausar e retomar entram na etapa 5). No fim, "Começar de novo"
  volta ao formulário com o mesmo time e pedido. Uma execução inteira com a IA simulada leva uns 26 segundos.
- **Formato por etapa** (T6): cada etapa da receita diz se escreve texto ou HTML. Texto aparece em caixa clara;
  código, em caixa escura, como no protótipo. O formato do resultado final passou a ser o da última etapa
  (saiu o campo `resultFormat` da receita).
- **Caixa de cada etapa** (T6): tem altura máxima e rola por dentro, acompanhando o fim do texto enquanto a IA
  escreve (se a pessoa sobe para ler, ela para de acompanhar). Para leitor de tela: o foco vai para o título ao
  trocar de tela, e um aviso invisível conta cada troca de etapa e o fim, sem ler o texto das IAs.
- **Nova pasta `lib/runs/`** (T6): a execução vista de fora (o que pode chegar ao usuário, a conferência do pedido que
  chega pela internet e o envio em linhas). Está na "cerca" do ESLint, como o motor. AGENTS.md atualizado.
- **Deixado de fora na T6** (estava no protótipo): "Ver resposta completa" (a caixa rola por dentro) e "Pausar".

**Anotado para as próximas tarefas**
- Falta o ícone da aba do navegador (favicon). Pequeno; entra quando definirmos nome e marca.
- T7: o resultado final chega no evento `run-finished` e já fica guardado no estado da tela (`run.result`, em
  `components/run-state.ts`). O recado provisório "Pronto! A tela de resultado..." (`components/RunProgress.tsx`)
  sai na T7. A caixa de código mostra o HTML só como texto; a prévia de verdade precisa da moldura isolada.
- T8: as novas tentativas e a troca de IA entram em volta de cada etapa do motor. A tela já aguenta uma etapa
  começar de novo com outra IA (zera o texto e troca a cor); falta o aviso "trocamos a IA".
- T9: IAs reais às vezes cercam o HTML com marcas de código (` ```html `); limpar antes da prévia.
- Antes de ligar IAs reais fora do computador do Luis: a rota `/api/runs` está aberta (sem login). Com a IA simulada
  não custa nada, mas com IAs reais qualquer um gastaria nossos créditos. Entra junto com o login
  (e o limite de 1 execução simultânea no plano grátis).
- Ideia para depois: marcar os arquivos "só do servidor" com `import "server-only"` (o Next.js barra se forem parar
  no navegador). Exige instalar o pacote `server-only` para os testes; propor antes.

## Próximo passo

Luis revisa e faz o merge do PR #15 (execução ao vivo). Depois, T7 (tela de resultado, issue #7): a prévia do site
numa moldura isolada, o código, o botão de baixar e o resumo do time.
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

# AGENTS.md — Regras do projeto Multi-IA

> Este arquivo é lido automaticamente pelo Codex e, via `CLAUDE.md`, pelo Claude Code.
> É a fonte única de regras para qualquer IA que trabalhe neste repositório.
> Mudou uma decisão? Atualize aqui no mesmo pull request.

## 1. O projeto em poucas linhas

Plataforma brasileira de IA **para empresas pequenas e médias** (nome provisório no código: **OCK**).
A empresa assina e cadastra os funcionários. Cada funcionário usa as IAs (Claude, GPT, Gemini) no trabalho do dia a dia,
de três jeitos: **receita pronta** (um time de IAs já montado para um serviço, ex.: "Criar um site"), **receita própria**
(ele monta a dele) ou **tarefa rápida** (só pede, como num chat). A plataforma recomenda a IA, o nível do modelo e o
esforço, mas o funcionário pode escolher outra coisa. O **dono** vê o que cada funcionário entregou, o que fez e quanto
gastou, e define um teto de gasto para cada um.

- Público: empresas pequenas e médias no Brasil e seus funcionários, **não** desenvolvedores. Amplo por enquanto, de propósito.
- Diferenciais: várias IAs num lugar, receitas prontas, controle do dono, tudo em português, preço em reais, sem chave de API.
- Até 19/10/2026 o produto era para a pessoa comum; o motor, as receitas e as regras de segurança daquela fase continuam valendo.
- Visão completa, regras de negócio e telas: `docs/DOCUMENTO-PROJETO.md`.
- Estado atual e próximos passos: `docs/PROGRESSO.md`.
- Desenho do banco de dados (tabelas, carteira, quem vê o quê): `docs/BANCO-DE-DADOS.md`.
- **Falhas e riscos conhecidos: `docs/FALHAS.md`.** Percebeu uma falha nova (negócio, produto, código, segurança ou
  processo)? Anote lá, no mesmo PR, com o próximo número livre. Resolveu uma? Mude o status e escreva como.

## 2. Quem é quem

| Quem | Papel |
|------|-------|
| **Luis** (dono do produto) | Decide o que construir, aprova issues, testa e faz o merge. Está aprendendo a programar. |
| **Claude** | Arquiteto e programador principal: escreve especificações, quebra em tarefas, programa. |
| **Codex** | Revisor independente dos pull requests; depois, implementa tarefas isoladas. |

### Como trabalhar com o Luis

- Escreva para ele em **português simples**. Ao introduzir um conceito novo, explique em uma ou duas frases o que é e por que importa.
- Prefira mudanças **pequenas e revisáveis** a mudanças grandes.
- Antes de decisões difíceis de desfazer (nova biblioteca, mudança de banco, mudança de arquitetura), **pergunte**.
- Diga sempre **como testar** o que foi feito (comando a rodar, tela a abrir, o que deve aparecer).
- Quem é dono do merge na `main` é o **Leandro** (assumiu o produto). O Claude **pode mergear na `main` por conta própria**, sem precisar de ordem a cada vez — **desde que o merge esteja certo**: CI verde, sem conflito, e a mudança já revisada/aprovada. Na dúvida sobre se está certo, **não mergeia — pergunta**. (O merge deixou de ser do Luis.) Isso vale só pro merge na `main`; **deploy em produção continua exigindo ordem explícita** do Leandro na mesma conversa.

## 3. Stack

| Camada | Escolha |
|--------|---------|
| Interface e servidor | Next.js 16 (App Router) + TypeScript |
| Estilos | CSS Modules (um `.module.css` por componente) usando só os tokens de `styles/tokens.css`. Sem Tailwind |
| Login e banco de dados | Supabase |
| Hospedagem | Vercel |
| IAs | SDKs oficiais de cada empresa (Anthropic, OpenAI, Google), ligação direta, sem intermediário (decidido em 09/10/2026; motivos no `docs/PROGRESSO.md`) |
| Testes automáticos | Vitest (arquivos `*.test.ts` ao lado do código que testam) |
| Gerenciador de pacotes | npm |
| Node.js | 24 LTS |

Bibliotecas além dessas: proponha e explique antes de instalar.

## 4. Arquitetura

O coração é um **motor de orquestração** separado da interface. A interface só chama o motor;
o motor nunca depende de componentes de tela. Assim, conector MCP e WhatsApp entram no futuro
sem reconstruir nada.

```
CANAIS (web agora; MCP e WhatsApp no futuro)
        |
        v
MOTOR DE ORQUESTRAÇÃO  -- receitas e times, executor de etapas, créditos
        |
        +--> IAs via API (Claude, GPT, Gemini), atrás de uma interface comum de "provedor"
        +--> Banco de dados (usuários, histórico, créditos)
```

Estrutura de pastas (criada na etapa 4, pode ser ajustada com aprovação):

```
app/                 telas e rotas do Next.js. app/api/runs/ são as rotas das receitas: começar, ver, buscar as
                     novidades, cancelar, continuar depois de uma pausa ([id]/resume) e baixar em Word o resultado em
                     texto ([id]/document), com o login de quem pede, e a rota interna [id]/continue, que roda uma fase de cada vez no servidor e cobra cada etapa;
                     app/api/ock/ são as rotas do chat (mandar mensagem, anexar, ditar, baixar, conversas, entregas
                     e gastos) e, para o painel do dono, o mês de uma pessoa da equipe (team/[id]), todas com o login
                     de quem pede; app/trabalho/ é o espaço de trabalho, onde as receitas
                     também abrem (app/recipes/ só leva o endereço antigo para lá); app/dono/actions.ts
                     e app/convite/ são o convite do funcionário (lado do dono e lado de quem recebe o link)
components/          pedaços de tela reutilizáveis (cada um com seu .module.css). SitePreview.tsx e
                     generated-site.ts são a prévia isolada do site feito pelas IAs (seção 6). OckWorkspace.tsx é o
                     espaço de trabalho (abas Chat, Receitas, Entregas e Meus gastos; a aba e a receita aberta ficam
                     no endereço, workspace-view.ts). RunResult.tsx é a tela do resultado de uma receita (o
                     site, ou o texto com RichText.tsx, que mostra títulos, listas e destaques sem rodar nada da
                     IA). OwnerHome.tsx é o painel do dono: o crédito da empresa
                     (CompanyCredit.tsx), o mês de cada pessoa (MemberMonth.tsx) e o extrato (StatementList.tsx, que
                     também mostra o Meus gastos)
lib/engine/          motor: executa as etapas de um time e narra cada passo em eventos (types.ts).
                     Recebe as IAs prontas (getProvider), não as escolhe. O ESLint barra importar
                     telas, Next.js ou React aqui, em lib/providers/, lib/recipes/ e lib/runs/
lib/providers/       um adaptador por IA, todos com a mesma interface (types.ts): real.ts (as IAs de verdade) e
                     mock.ts (a simulada); images.ts cria as imagens e transcribe.ts transcreve a voz (as de verdade e
                     as simuladas). catalog.ts e models.ts (o modelo e o preço oficial de cada nível, o
                     único lugar a mudar quando uma empresa trocar nome ou preço) são só dados e podem ir para a
                     tela; registry.ts entrega as IAs e é SÓ do servidor, escolhendo a simulada ou a de verdade pelo
                     interruptor OCK_AI_MODE (mode.ts); limits.ts é o teto de saída de cada IA (resposta +
                     pensamento), usado pelos conectores e pela estimativa
lib/recipes/         definição das receitas (papéis, IA sugerida, prompt de sistema, etapas), uma por arquivo
                     (create-site.ts, commercial-proposal.ts, social-posts.ts), com as respostas de exemplo da
                     IA simulada em *.samples.ts; text-format.ts é como as receitas que terminam em texto escrevem;
                     validate.ts confere toda receita nos testes; screen.ts é o que a tela de uma receita recebe
                     (nunca as instruções das IAs)
lib/auth/            o login (Supabase Auth): quem está vendo a página (viewer.ts, com requireMember para
                     páginas protegidas), o cliente com a sessão de quem está logado (session.ts), a renovação
                     do login a cada página (refresh-session.ts, chamado pelo proxy.ts da raiz), o cadastro
                     da empresa no primeiro acesso do dono (company-signup.ts) e o convite do funcionário por
                     link (invites.ts; o código do link em invite-token.ts). Tudo SÓ do servidor, menos
                     member.ts, forms.ts e page-member.ts (confere que o login não mudou desde que a página
                     abriu, F34), que são dados e conferências puras
lib/ock/             o workspace para empresas: a parte "Equipe" do painel do dono (team.ts e team-forms.ts), o
                     Chefe que recomenda a IA (chief.ts), preços (pricing.ts), os arquivos gerados (document.ts, spreadsheet.ts,
                     chart.ts, project.ts) e o chat da tarefa rápida: quem executa uma mensagem (run-task.ts), o que
                     cada tipo de resposta pede à IA e quanto pode custar (quick-task.ts), a chamada às IAs com novas
                     tentativas (ai-call.ts), conversas e mensagens (task-store.ts), arquivos na pasta fechada
                     (files.ts e attachments.ts), a voz ditada (voice.ts) e os gastos do mês, da pessoa e da empresa, lidos das contas feitas no
                     banco (spending.ts), tudo SÓ do servidor; chat.ts (limites e o formato do que a tela recebe),
                     statement.ts (o formato das contas do mês), site-file.ts (o nome do arquivo do site),
                     rich-text.ts (o texto final de uma receita lido em partes, para a tela e o Word) e
                     chat-client.ts (os pedidos do navegador) vão para a tela
lib/runs/            a execução vista de fora: o que dos eventos pode chegar ao usuário
                     (public-events.ts), a conferência do pedido que chega pela internet (parse-request.ts),
                     o banco das execuções (store.ts), a narração gravada aos poucos (event-buffer.ts), a
                     retomada de execução parada (resume.ts), a chamada interna (trigger.ts e
                     internal-secret.ts), a carteira vista por uma execução e por uma mensagem do chat (wallet.ts),
                     o que cobrar de cada etapa (billing.ts) e o resultado pronto (o site ou o Word) guardado como
                     entrega (delivery.ts), tudo SÓ do servidor; no navegador, começar, cancelar e continuar
                     (client.ts) e buscar as novidades (live-client.ts). A estimativa (estimate.ts) roda nos dois
                     lados: o servidor calcula o máximo de cada etapa com cada IA, e a tela só soma
styles/tokens.css    TODAS as cores, fontes, espaçamentos e arredondamentos
supabase/            banco de dados: migrations/ (a versão oficial das tabelas), seed.sql (empresa de exemplo, só
                     local) e tests/ (testes do banco, rodam nas checagens). Explicação em docs/BANCO-DE-DADOS.md
docs/                documento do projeto, diário de progresso, registro de falhas (FALHAS.md), guias
                     de tarefas feitas à mão pelo Luis (GUIA-*.md, seguidos com o chat do Claude) e pesquisas
                     feitas no Cowork (pesquisas/, guardadas para consulta)
.github/workflows/   checagens automáticas (CI) que rodam em todo pull request
```

## 5. Regras de funcionamento (especificação do MVP)

### Erro de uma IA no meio da execução
1. Tenta de novo automaticamente, até **2 vezes**, com uma pequena espera (1 s e depois 2 s). Erro que não adianta
   repetir (ex.: a IA recusou o pedido) pula direto para a troca; defeito no nosso código para na hora.
2. Se persistir, **troca de IA** naquele papel e avisa o usuário (ligado por padrão nas receitas; pode ser desligado).
   Quem assume é a IA recomendada pela receita; se foi ela que falhou, a **IA reserva** do papel (`backupProvider`).
   A IA que assumiu segue no papel nas próximas etapas dele.
3. Se ainda falhar, **pausa sem perder nada**: etapas concluídas ficam salvas; o usuário escolhe tentar de novo, trocar a IA ou cancelar. Ao retomar, continua da etapa que falhou.
4. Etapa que falhou **não é cobrada**.
5. Erro na chave do próprio usuário: avisa e **não** passa a usar créditos da plataforma sem autorização.

### Créditos e estimativa
1. Antes de começar, mostra uma **estimativa** de custo e **reserva** esse valor do saldo. Sem saldo, não começa e oferece recarga.
   Por enquanto, a estimativa é o **máximo** que o time pode gastar ("até R$ X"), calculado de novo no servidor ao
   começar (`lib/runs/estimate.ts`, decisão do Luis de 25/10/2026).
2. Cobra cada etapa concluída pelo **consumo real**. No fim, devolve a diferença entre o reservado e o gasto.
3. Se o custo for passar da estimativa, **pausa e pergunta** antes de continuar. A plataforma não absorve diferenças.
4. Cancelou no meio: paga só as etapas concluídas; a que estava rodando não é cobrada (decisão do Luis, 25/10/2026).
   **Na tarefa rápida (chat)** não há estimativa antes de cada mensagem (decisão do Luis, 25/10/2026, issue #39):
   antes de qualquer IA o servidor confere saldo e teto, reserva o máximo da resposta depois que o Chefe decide, cobra o
   consumo real numa linha só ("Tarefa rápida · Documento") e a tela mostra "Custou R$ X" em cada resposta.
5. Estimativas honestas, calculadas a partir do histórico real de cada receita. A estimativa mostrada precisa ser confiável — gastar muito além dela é um bug.
6. Internamente, registrar o custo real em **dólar** de cada execução.

### Histórico
- **Para o usuário:** pedido, resultado final, time usado (papéis, IAs e instruções), cada etapa com entrada, saída, status e tempo, créditos cobrados, forma de pagamento e botão "rodar de novo".
- **Só interno:** modelo exato, tokens e custo em dólar por etapa, erros técnicos, trocas de IA, uso por receita.
- **LGPD:** o usuário pode apagar qualquer item ou a conta inteira.

### Limites
- Pedido de até ~**4.000 caracteres** no MVP, com contador visível.
- Limite interno de tamanho da resposta de cada papel, para controlar custo.
- **1 execução simultânea** no plano grátis.

### Visual
- Tudo centralizado em tokens (`styles/tokens.css`). **Nunca** escreva cor, fonte ou espaçamento solto num componente.
- Referência atual: fundo cinza claro, botões azuis `#2A3BD1`; cor por IA (Claude laranja, GPT verde, Gemini azul); fontes Bricolage Grotesque (títulos) + IBM Plex Sans (texto).

## 6. Segurança (inegociável)

- **Nunca** coloque chaves de API, senhas ou tokens no código ou em commits. Eles ficam em `.env.local` (já ignorado pelo Git). Mantenha um `.env.example` só com os nomes das variáveis.
- Chaves de API são usadas **apenas no servidor**. Nada de chave em código que roda no navegador.
- Chaves nunca aparecem em logs nem no histórico. Chaves de usuários (BYOK, fase futura) ficam guardadas à parte, criptografadas.
- Toda entrada do usuário é validada no servidor (tamanho, formato).
- **Conteúdo gerado por IA nunca roda solto dentro da nossa página.** Site gerado (HTML/CSS/JS) só é exibido
  numa moldura isolada: `<iframe sandbox="allow-scripts">` **sem** `allow-same-origin` (não enxerga nossa página,
  login, cookies nem créditos) e com uma política que bloqueia qualquer acesso à internet de dentro da moldura.
  Motivo: um texto colado no pedido pode trazer instruções escondidas que levam a IA a escrever código malicioso
  ("injeção de prompt"). Vale para qualquer pessoa que abrir o resultado, inclusive administradores.
  A política tem duas partes: regras no começo do próprio site (`components/generated-site.ts`) e o cabeçalho
  `frame-src 'none'` das nossas páginas (`next.config.ts`), que não deixa a moldura ir para outro endereço.
  **Nunca** abra o site gerado como página do nosso endereço (ex.: um link `blob:` aberto numa aba): ali ele
  enxergaria tudo. Para baixar, o arquivo sai como `application/octet-stream`, que o navegador só salva.

## 7. Padrões de código

- TypeScript em modo `strict`. Evite `any`.
- **Nomes no código em inglês** (variáveis, funções, arquivos). **Textos da interface em português do Brasil.**
- Comentários em português, só onde a lógica não é óbvia.
- Funções pequenas, com um propósito claro. Prefira código simples e legível a código "esperto".
- Antes de abrir um PR, rode as checagens abaixo. Elas também rodam sozinhas no GitHub (`.github/workflows/ci.yml`),
  e um PR com checagem vermelha não está pronto.

  | Comando | O que faz |
  |---------|-----------|
  | `npm run lint` | Procura erros comuns e código desleixado (ESLint) |
  | `npm run typecheck` | Confere os tipos do TypeScript |
  | `npm test` | Roda os testes automáticos uma vez (`npm run test:watch` fica rodando a cada mudança) |
  | `npm run build` | Monta a versão de produção do site |
  | `npm run dev` | Roda o site na máquina, em http://localhost:3000 |

- Esta versão do Next.js é mais nova que o conhecimento de muitas IAs: antes de usar uma API do Next.js,
  confira o guia correspondente em `node_modules/next/dist/docs/` (veja o bloco no fim deste arquivo).

## 8. Fluxo de trabalho no Git

1. Cada tarefa nasce como uma **issue** com descrição e **critério de pronto**, aprovada pelo Luis.
2. Trabalhe num **branch** próprio: `feat/descricao-curta`, `fix/descricao-curta` ou `docs/descricao-curta`.
3. **Commits** pequenos, com mensagem em português no imperativo (ex.: `adiciona tela de receitas`).
4. Abra um **pull request** dizendo: o que mudou, por quê, e como testar. Referencie a issue (`Closes #12`).
5. A outra IA revisa e comenta no PR. Divergências ficam registradas lá.
6. O **Leandro** é dono do produto; o Claude **pode fazer o merge na `main` por conta própria** quando o PR estiver certo (CI verde, sem conflito, revisado). Na dúvida, pergunta. Deploy em produção é à parte: só com ordem explícita.

**Banco de dados:** toda mudança de tabela entra por **migração** (arquivo SQL em `supabase/migrations/`), num PR como
qualquer outra mudança. Nunca pelo painel do Supabase (editor de tabelas ou de SQL): senão o banco deixa de bater com o
repositório. No merge na `main`, o Supabase aplica as migrações novas sozinho (ligação com o GitHub, ver
`docs/BANCO-DE-DADOS.md`). Migração já aplicada não se edita: a correção vem numa migração nova.
O computador de desenvolvimento usa o **projeto de testes** do Supabase, nunca o de verdade; as migrações chegam nele
pelo workflow "Banco de testes" (`.github/workflows/test-db.yml`), que também roda por botão num branch de PR.
Toda tabela nova liga o RLS e recebe `grant` explícito só para quem precisa (nunca para `anon`); toda função nova tem o
acesso de todos tirado (`revoke`) antes do `grant`. Dinheiro só se mexe pelas funções da carteira. Os testes em
`supabase/tests/` conferem isso, e cada mudança de acesso vem com teste.

## 9. Escopo do MVP

Revisado em 22/10/2026, com o produto para empresas (detalhes em `docs/DOCUMENTO-PROJETO.md`).

**Entra:** cadastro da empresa e login de verdade (dono e funcionários); painel do dono (funcionários, teto de gasto,
crédito da empresa, entregas e gastos por funcionário e por IA); workspace com receitas prontas, receita própria e
tarefa rápida; as 4 receitas do MVP (Criar um site, Proposta comercial, Posts para redes sociais e Relatório mensal
para cliente; as três últimas escolhidas pelo Luis em 26/10, issue #54); recomendação de IA com escolha livre do funcionário; histórico; Claude, GPT e Gemini via API,
com medição de custo; geração de arquivos (PDF, Word, Excel, gráficos).

**Fica de fora por enquanto:** pagamento real (empresas convidadas, crédito carregado à mão), vídeo, execução de código
no servidor ("oficina na nuvem"), conector MCP, WhatsApp, nichar para um tipo de empresa.
(O JavaScript "de enfeite" dos sites gerados não conta como execução de código: ele só roda na prévia isolada, no navegador.)
Não implemente nada desta lista sem pedido explícito.

## 10. Bloco automático do Next.js

O bloco abaixo é escrito e mantido pelo próprio Next.js (o `npm run dev` o recoloca se ele sumir).
Não edite. Em resumo: antes de mexer em algo do Next.js, leia o guia da versão instalada em `node_modules/next/dist/docs/`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

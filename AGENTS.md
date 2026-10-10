# AGENTS.md — Regras do projeto Multi-IA

> Este arquivo é lido automaticamente pelo Codex e, via `CLAUDE.md`, pelo Claude Code.
> É a fonte única de regras para qualquer IA que trabalhe neste repositório.
> Mudou uma decisão? Atualize aqui no mesmo pull request.

## 1. O projeto em poucas linhas

Plataforma brasileira onde qualquer pessoa monta um **time de IAs** (Claude, GPT, Gemini)
que trabalham juntas numa tarefa, sem precisar saber o que é API.
O usuário escolhe uma **receita** (ex.: "Criar um site simples"), recebe um time com papéis
(chefe, programador, revisor) e a IA recomendada para cada um, ajusta se quiser e acompanha
cada IA trabalhando na tela até o resultado final.

- Público: usuário comum e pequenas empresas no Brasil, **não** desenvolvedores.
- Diferenciais: tudo em português, preço em reais (Pix), receitas prontas, sem chave de API.
- Nome provisório na interface: **Multi-IA**.
- Visão completa, regras de negócio e telas: `docs/DOCUMENTO-PROJETO.md`.
- Estado atual e próximos passos: `docs/PROGRESSO.md`.

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
- Nunca faça merge na `main` por conta própria. Quem decide é o Luis.

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
app/                 telas e rotas do Next.js. app/api/runs/ é a rota que roda o time e narra ao vivo
components/          pedaços de tela reutilizáveis (cada um com seu .module.css). SitePreview.tsx e
                     generated-site.ts são a prévia isolada do site feito pelas IAs (seção 6)
lib/engine/          motor: executa as etapas de um time e narra cada passo em eventos (types.ts).
                     Recebe as IAs prontas (getProvider), não as escolhe. O ESLint barra importar
                     telas, Next.js ou React aqui, em lib/providers/, lib/recipes/ e lib/runs/
lib/providers/       um adaptador por IA, todos com a mesma interface (types.ts). catalog.ts é só
                     dados e pode ir para a tela; registry.ts entrega as IAs e é SÓ do servidor
lib/recipes/         definição das receitas (papéis, IA sugerida, prompt de sistema, etapas);
                     validate.ts confere toda receita nos testes
lib/runs/            a execução vista de fora: o que dos eventos pode chegar ao usuário
                     (public-events.ts), a conferência do pedido que chega pela internet
                     (parse-request.ts, SÓ do servidor) e o envio dos eventos em linhas (ndjson.ts)
styles/tokens.css    TODAS as cores, fontes, espaçamentos e arredondamentos
docs/                documento do projeto e diário de progresso
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
2. Cobra cada etapa concluída pelo **consumo real**. No fim, devolve a diferença entre o reservado e o gasto.
3. Se o custo for passar da estimativa, **pausa e pergunta** antes de continuar. A plataforma não absorve diferenças.
4. Cancelou no meio: paga só o que já foi consumido.
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
6. O **Luis** decide e faz o merge.

## 9. Escopo do MVP

**Entra:** cadastro e login; 4 receitas (Criar site simples, Escrever e revisar texto, Pesquisa com
checagem cruzada, Comitê de investimento); trocar a IA de cada papel; execução em sequência
(chefe → executores → revisor → consolidação) mostrando cada etapa; histórico; Claude, GPT e Gemini via API;
contador de créditos.

**Fica de fora por enquanto:** pagamento real (acesso por convite), "Traga sua chave", upload de arquivos,
vídeo, execução de código no servidor ("oficina na nuvem"), conector MCP, WhatsApp, projeto próprio totalmente livre.
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

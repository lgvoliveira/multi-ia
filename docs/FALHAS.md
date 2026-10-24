# FALHAS — registro de falhas e riscos

> Lista viva de tudo o que pode dar errado no projeto: negócio, produto, código, segurança e processo.
> **Toda falha percebida entra aqui**, mesmo que pareça pequena. Ninguém apaga uma falha: quando ela for resolvida,
> muda o status e se escreve como foi resolvida. Assim dá para ver, até o fim, o que já foi resolvido e o que não foi.
> Quem anota: qualquer um (Luis, o parceiro, Claude, Codex). O Claude anota sempre que perceber uma falha nova numa conversa.
> Criado em 22/10/2026.

**Status:** Aberta (ainda sem solução) · Decidida (já se sabe o que fazer, falta fazer) ·
Aceita (risco conhecido que escolhemos correr por enquanto) · Resolvida

**Gravidade:** Alta (pode matar o negócio ou expor dados) · Média · Baixa

**Como anotar uma falha nova:** use o próximo número livre (F23, F24…), coloque na tabela-resumo e na seção da
categoria, com a data. Ao mudar o status, escreva a data e o que aconteceu.

## Resumo

| # | Falha | Categoria | Gravidade | Status |
|---|-------|-----------|-----------|--------|
| F01 | Sem as receitas, o produto vira mais um chat com várias IAs | Negócio | Alta | Decidida |
| F02 | Público "empresas pequenas e médias" é amplo demais | Negócio | Média | Aceita |
| F03 | O Chefe escolher a IA mais barata pode entregar um resultado ruim | Produto | Alta | Decidida |
| F04 | Preço e margem não definidos | Negócio | Alta | Aberta |
| F05 | LGPD: o que o dono vê e para onde vão os dados dos clientes | Negócio / Segurança | Alta | Aberta |
| F06 | Vender para empresa é mais lento e trabalhoso | Negócio | Média | Aberta |
| F07 | O resultado precisa ser claramente melhor que "abrir o ChatGPT e pedir" | Negócio | Média | Aberta |
| F08 | As receitas não existem dentro do workspace do funcionário | Produto | Alta | Aberta |
| F09 | Resultado que um leigo não sabe usar (ex.: arquivo .html) | Produto | Média | Aberta |
| F10 | Login de mentira: o código na URL é o "estar logado" | Segurança | Alta | Aberta |
| F11 | Painel do dono sem login e senhas temporárias expostas | Segurança | Alta | Aberta |
| F12 | Senha temporária guardada sem criptografia | Segurança | Média | Aberta |
| F13 | Só existe uma empresa, fixa no código ("demo") | Código | Alta | Aberta |
| F14 | As tabelas do banco (Supabase) não estão no repositório | Código | Alta | Aberta |
| F15 | Pacote `xlsx` com falhas de segurança conhecidas | Segurança | Média | Aberta |
| F16 | Rotas que gastam IA de verdade abertas para qualquer um | Segurança | Alta | Aberta |
| F17 | Preços das IAs e câmbio fixos no código | Código | Média | Aberta |
| F18 | Prévia de site: o Chrome "aquece" uma conexão antes de bloquear | Segurança | Baixa | Aceita |
| F19 | Testado só no Chrome | Código | Baixa | Aberta |
| F20 | Mudança grande de produto entrou num PR só, sem registro nos documentos | Processo | Média | Decidida |
| F21 | O parceiro usa a conta do GitHub do Luis | Processo / Segurança | Média | Aberta |
| F22 | O OCK nunca rodou no computador do Luis | Processo | Média | Aberta |

## Negócio

### F01 — Sem as receitas, o produto vira mais um chat com várias IAs
- **Gravidade:** Alta · **Status:** Decidida · **Anotada:** 22/10/2026
- **O problema:** um chat com várias IAs e um painel de gastos é fácil de copiar, e os grandes já vendem algo
  parecido para empresas (ChatGPT e Claude têm planos para equipes, o Google inclui o Gemini em muitos planos do
  Workspace, a Microsoft tem o Copilot). Muitas PMEs já pagam algum deles.
- **Decisão (Luis, 22/10):** as receitas ficam no centro do workspace do funcionário, em três modos: receita pronta,
  receita própria e tarefa rápida. Falta construir (ver F08).

### F02 — Público "empresas pequenas e médias" é amplo demais
- **Gravidade:** Média · **Status:** Aceita · **Anotada:** 22/10/2026
- **O problema:** uma agência de marketing, um escritório de contabilidade e uma clínica precisam de receitas
  diferentes. Público amplo dificulta a mensagem de venda e a escolha das receitas.
- **Decisão (Luis, 22/10):** seguir amplo por enquanto, para testar com tipos diferentes de empresa. Se mais adiante
  fizer sentido nichar (ex.: agências), o produto já estará pronto e muda pouco. Revisar depois dos primeiros testes com
  empresas.

### F04 — Preço e margem não definidos
- **Gravidade:** Alta · **Status:** Aberta · **Anotada:** 22/10/2026
- **O problema:** a plataforma paga as IAs em dólar e revende o uso em reais. Funcionário que usa muito, ou o dólar
  subindo, come a margem. Ainda não está decidido se a cobrança é por empresa, por funcionário ou pelo consumo, nem
  quanto de margem entra sobre o custo das IAs.
- **O que fazer:** discutir no Cowork depois de medir o custo real de uso com as IAs de verdade.

### F05 — LGPD: o que o dono vê e para onde vão os dados dos clientes
- **Gravidade:** Alta · **Status:** Aberta · **Anotada:** 22/10/2026
- **O problema:** (1) se o dono pode ler as conversas, os funcionários precisam saber disso; (2) os funcionários vão
  colar dados dos clientes da empresa, que vão para servidores das IAs nos EUA; (3) no plano grátis, o Gemini usa o
  conteúdo para melhorar os produtos do Google, então nunca pode receber dados de empresas reais.
- **O que fazer:** decidir o que o dono vê (só entregas e gastos, ou as conversas inteiras); termos de uso e política de
  privacidade antes da primeira empresa real; Gemini no plano pago antes de qualquer cliente.

### F06 — Vender para empresa é mais lento e trabalhoso
- **Gravidade:** Média · **Status:** Aberta · **Anotada:** 22/10/2026
- **O problema:** cada empresa exige conversa, demonstração e confiança, e o tempo dos dois sócios é curto.
- **O que fazer:** conversar com 3 a 5 donos de empresa antes de construir muito mais; poucas empresas pagando já
  validam a ideia.

### F07 — O resultado precisa ser claramente melhor que "abrir o ChatGPT e pedir"
- **Gravidade:** Média · **Status:** Aberta · **Anotada:** 09/10/2026 (no PROGRESSO), trazida para cá em 22/10/2026
- **O problema:** muita gente já usa uma IA sozinha, às vezes de graça. O time de IAs das receitas precisa entregar um
  resultado claramente melhor ou dar muito menos trabalho.
- **O que fazer:** o teste planejado na etapa 4 continua valendo: o mesmo pedido feito a uma IA sozinha e a uma
  receita, com os resultados mostrados a algumas pessoas sem dizer qual é qual.

## Produto

### F03 — O Chefe escolher a IA mais barata pode entregar um resultado ruim
- **Gravidade:** Alta · **Status:** Decidida · **Anotada:** 22/10/2026
- **O problema:** no PR #19 o Chefe decide sozinho a IA, o nível do modelo e o esforço, buscando o mais barato que
  resolve. Se ele errar numa tarefa importante, o funcionário recebe algo fraco e culpa a plataforma.
- **Decisão (Luis, 22/10):** a plataforma recomenda (IA, nível e esforço), mas o funcionário escolhe livremente
  ("quero o melhor", "quero o Claude nesta tarefa"). Falta construir.

### F08 — As receitas não existem dentro do workspace do funcionário
- **Gravidade:** Alta · **Status:** Aberta · **Anotada:** 22/10/2026
- **O problema:** o workspace (`/trabalho`) só tem o chat. A receita "Criar um site" ficou no código
  (`/recipes/create-site`), mas fora da página inicial e sem ligação com a empresa, o funcionário ou os gastos.
- **O que fazer:** trazer os três modos (receita pronta, receita própria, tarefa rápida) para o workspace, com o gasto
  de cada receita contando no teto do funcionário.

### F09 — Resultado que um leigo não sabe usar
- **Gravidade:** Média · **Status:** Aberta · **Anotada:** 09/10/2026 (no PROGRESSO), trazida para cá em 22/10/2026
- **O problema:** um arquivo `.html` baixado não serve para quem não sabe o que fazer com ele.
- **O que fazer:** pensar em entregas prontas para uso (ex.: "publicar o site com um clique", num endereço separado do
  nosso por segurança).

## Código e segurança

### F10 — Login de mentira
- **Gravidade:** Alta · **Status:** Aberta · **Anotada:** 22/10/2026
- **O problema:** depois do login, o funcionário é reconhecido só pelo código dele na URL (`/trabalho?member=...`).
  Quem tiver o link entra como ele, sem senha. O próprio código avisa que é provisório.
- **O que fazer:** sessão de verdade (cookie seguro, com o login do Supabase ou equivalente) antes de qualquer empresa real.

### F11 — Painel do dono sem login e senhas temporárias expostas
- **Gravidade:** Alta · **Status:** Aberta · **Anotada:** 22/10/2026
- **O problema:** `/dono` e a rota `/api/ock/company` não pedem login. Qualquer pessoa pode ver os funcionários,
  criar e apagar funcionários, mudar tetos e o crédito da empresa. A rota devolve as senhas temporárias de quem ainda
  não trocou a senha.
- **O que fazer:** login do dono e conferência, em toda rota, de que quem pede é o dono daquela empresa.

### F12 — Senha temporária guardada sem criptografia
- **Gravidade:** Média · **Status:** Aberta · **Anotada:** 22/10/2026
- **O problema:** a senha temporária que o dono entrega fica em texto puro no banco até o funcionário trocar.
  A senha definitiva já é guardada com hash (scrypt).
- **O que fazer:** trocar por um convite por e-mail (link de uso único) ou guardar também a temporária com hash.

### F13 — Só existe uma empresa, fixa no código
- **Gravidade:** Alta · **Status:** Aberta · **Anotada:** 22/10/2026
- **O problema:** as rotas usam sempre a empresa "demo". Não há como cadastrar uma segunda empresa.
- **O que fazer:** cadastro de empresa e todas as rotas olhando a empresa de quem está logado (junto com F10 e F11).

### F14 — As tabelas do banco não estão no repositório
- **Gravidade:** Alta · **Status:** Aberta · **Anotada:** 22/10/2026
- **O problema:** o código depende de tabelas no Supabase que o parceiro criou, mas não há nenhum arquivo descrevendo
  essas tabelas. Ninguém além dele consegue montar o banco, e uma mudança nele não fica registrada.
- **O que fazer:** pedir ao parceiro o esquema e salvá-lo no repositório como "migrações" (arquivos SQL em ordem).

### F15 — Pacote `xlsx` com falhas de segurança conhecidas
- **Gravidade:** Média · **Status:** Aberta · **Anotada:** 22/10/2026
- **O problema:** o PR #19 instalou o `xlsx` 0.18.5, a última versão publicada no npm, que tem falhas de segurança
  conhecidas. As versões corrigidas só são distribuídas pelo site do próprio projeto (SheetJS).
- **O que fazer:** trocar por uma versão corrigida ou por outra biblioteca de Excel, antes de produção.

### F16 — Rotas que gastam IA de verdade abertas para qualquer um
- **Gravidade:** Alta · **Status:** Aberta · **Anotada:** 09/10/2026 (no PROGRESSO), ampliada em 22/10/2026
- **O problema:** `/api/runs` (receitas) não tem login, e `/api/ock` (chat) só pede o código do funcionário. Com IAs
  reais, qualquer um gastaria os créditos da plataforma.
- **O que fazer:** nada no ar com chaves reais antes de F10, F11 e F13.

### F17 — Preços das IAs e câmbio fixos no código
- **Gravidade:** Média · **Status:** Aberta · **Anotada:** 22/10/2026
- **O problema:** `lib/ock/pricing.ts` tem preços aproximados por modelo e o dólar fixo em R$ 5,50. O custo mostrado
  ao dono pode ficar longe do que a plataforma paga de verdade.
- **O que fazer:** conferir os preços com as tabelas oficiais, registrar o custo real em dólar de cada tarefa e usar uma
  cotação atualizada.

### F18 — Prévia de site: o Chrome "aquece" uma conexão antes de bloquear
- **Gravidade:** Baixa · **Status:** Aceita · **Anotada:** etapa 4 (T7), trazida para cá em 22/10/2026
- **O problema:** quando o site gerado tenta trocar o endereço da moldura, o Chrome consulta o nome do site de destino
  antes de a regra bloquear. Nenhum dado do site vai junto, mas um atacante poderia esconder poucos caracteres no nome.
- **O que fazer:** reavaliar antes do lançamento público.

### F19 — Testado só no Chrome
- **Gravidade:** Baixa · **Status:** Aberta · **Anotada:** etapa 4 (T7), trazida para cá em 22/10/2026
- **O que fazer:** testar no Firefox e no Safari na rodada de testes com empresas.

## Processo

### F20 — Mudança grande de produto entrou num PR só, sem registro nos documentos
- **Gravidade:** Média · **Status:** Decidida · **Anotada:** 22/10/2026
- **O problema:** o PR #19 mudou o produto inteiro (público, telas, cobrança) num único commit de ~100 arquivos, sem
  atualizar o `DOCUMENTO-PROJETO.md` nem o `PROGRESSO.md`. Fica difícil revisar, e qualquer conversa nova com uma IA
  começava pelo produto antigo.
- **O que foi feito (22/10):** documentos atualizados com a visão nova. **Falta combinar com o parceiro:** uma tarefa =
  um PR pequeno, e o PROGRESSO atualizado em todo PR.

### F21 — O parceiro usa a conta do GitHub do Luis
- **Gravidade:** Média · **Status:** Aberta · **Anotada:** 22/10/2026
- **O problema:** os commits dele saem no nome do Luis (não dá para saber quem fez o quê), e senha compartilhada é
  risco de segurança.
- **O que fazer:** adicionar o parceiro como colaborador do repositório (Settings → Collaborators), cada um com a
  própria conta. Depois, o Luis pode trocar a senha.

### F22 — O OCK nunca rodou no computador do Luis
- **Gravidade:** Média · **Status:** Aberta · **Anotada:** 22/10/2026
- **O problema:** falta o Supabase e as chaves no `.env.local`. As checagens (lint, testes, build) do PR #19 também não
  foram conferidas pelo Luis.
- **O que fazer:** primeira tarefa da etapa 5.

# Multi-IA

Plataforma brasileira de IA para empresas pequenas e médias: os funcionários usam várias IAs (Claude, GPT, Gemini),
sozinhas ou em times prontos ("receitas"), e o dono acompanha entregas e gastos.

- Registro de falhas e riscos: [`docs/FALHAS.md`](docs/FALHAS.md)

- Regras do projeto para as IAs: [`AGENTS.md`](AGENTS.md)
- Documento do projeto: [`docs/DOCUMENTO-PROJETO.md`](docs/DOCUMENTO-PROJETO.md)
- Diário de progresso: [`docs/PROGRESSO.md`](docs/PROGRESSO.md)

## Como rodar na sua máquina

Precisa do Node.js 24. Na pasta do projeto, no terminal:

```bash
npm install     # baixa as bibliotecas (na primeira vez e sempre que o package.json mudar)
npm run dev     # liga o site em http://localhost:3000 (Ctrl + C para desligar)
```

Checagens (as mesmas que o GitHub roda em todo pull request):

```bash
npm run lint        # procura erros comuns no código
npm run typecheck   # confere os tipos do TypeScript
npm test            # roda os testes automáticos
npm run build       # monta a versão de produção
```

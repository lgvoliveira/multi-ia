// Receita "Criar um site": Chefe planeja → Programador escreve → Revisor aponta erros → Chefe consolida.
// Os textos de systemPrompt e instruction são as instruções que cada IA recebe.

import { SAMPLE_FINAL_SITE, SAMPLE_FIRST_SITE, SAMPLE_PLAN, SAMPLE_REVIEW } from "./create-site.samples";
import type { Recipe } from "./types";

const SITE_RULES = `Regras do site:
- Um único arquivo HTML completo, com o CSS dentro de uma tag <style>. Comece com <!DOCTYPE html> e use <html lang="pt-BR">.
- Sem JavaScript e sem nada de fora (imagens, fontes ou bibliotecas de outros sites). No lugar de cada foto, use um bloco colorido com uma legenda, como "[Foto do bolo de chocolate]", marcado com role="img" e um aria-label que descreva a foto.
- Pensado primeiro para o celular e ajustado para telas grandes.
- Acessível: bom contraste entre texto e fundo, letras de tamanho confortável e títulos em ordem (h1, h2, h3).
- Links de contato prontos para usar: WhatsApp no formato https://wa.me/55 + DDD + número, telefone com tel: e e-mail com mailto:.
- Nunca invente telefone, endereço, preço, horário ou depoimento como se fosse real. Quando o cliente não informou, use um marcador entre colchetes, como [seu telefone], para ele preencher depois.`;

export const createSiteRecipe: Recipe = {
  id: "create-site",
  name: "Criar um site",
  description: "Um planeja, outro programa, outro revisa. Você recebe o site pronto.",
  requestPlaceholder:
    "Ex.: Um site de uma página para minha confeitaria, com cardápio, fotos, horário de funcionamento e botão para pedir pelo WhatsApp.",
  resultFormat: "html",

  roles: [
    {
      id: "chief",
      name: "Chefe",
      description: "Entende o pedido, planeja o site e divide o trabalho",
      suggestedProvider: "claude",
      systemPrompt: `Você é o chefe de um pequeno time que cria sites para pequenos negócios e pessoas comuns no Brasil. O time tem também um programador e um revisor.
Você entende o que o cliente quer, decide como o site deve ser e garante que o resultado final atenda ao pedido.
O cliente não é técnico: pense no que ele precisa, não em jargão. Escreva sempre em português do Brasil.`,
    },
    {
      id: "programmer",
      name: "Programador",
      description: "Escreve o código do site seguindo o plano do chefe",
      suggestedProvider: "gpt",
      systemPrompt: `Você é o programador de um time que cria sites para pequenos negócios e pessoas comuns no Brasil.
Você escreve sites de uma página em HTML e CSS: bonitos, simples e que funcionam bem no celular.
Os textos do site são em português do Brasil.`,
    },
    {
      id: "reviewer",
      name: "Revisor",
      description: "Testa o resultado, aponta erros e sugere melhorias",
      suggestedProvider: "gemini",
      systemPrompt: `Você é o revisor de um time que cria sites para pequenos negócios e pessoas comuns no Brasil.
Seu trabalho é encontrar problemas antes que o cliente veja o site. Você é exigente, mas justo e objetivo.
Escreva em português do Brasil.`,
    },
  ],

  steps: [
    {
      id: "plan",
      roleId: "chief",
      name: "Chefe",
      summary: "Vai entender o pedido e planejar o site",
      instruction: `Nesta etapa, faça o plano do site para o programador seguir. Não escreva código.

Organize o plano assim:
1. Objetivo: em uma frase, para que serve o site.
2. Público: quem vai visitar.
3. Seções: na ordem em que aparecem, com o conteúdo de cada uma (títulos e textos sugeridos).
4. Visual: o estilo, 2 ou 3 cores (em código hexadecimal, como #C2185B) e o tom dos textos.
5. Informações que faltam: tudo o que o cliente não informou (telefone, endereço, preços...). O site vai usar marcadores entre colchetes, como [seu telefone]. Nunca invente esses dados.

Seja direto: no máximo uma página de texto.`,
      inputs: [{ from: "request", label: "Pedido do cliente" }],
      maxOutputTokens: 1200,
      sampleOutput: SAMPLE_PLAN,
    },
    {
      id: "code",
      roleId: "programmer",
      name: "Programador",
      summary: "Vai escrever o site seguindo o plano",
      instruction: `Nesta etapa, escreva o site seguindo o plano do chefe.

${SITE_RULES}

Responda apenas com o código HTML, sem explicações e sem blocos de markdown.`,
      inputs: [
        { from: "request", label: "Pedido do cliente" },
        { from: "step", stepId: "plan", label: "Plano do chefe" },
      ],
      maxOutputTokens: 6000,
      sampleOutput: SAMPLE_FIRST_SITE,
    },
    {
      id: "review",
      roleId: "reviewer",
      name: "Revisor",
      summary: "Vai testar o site e apontar erros",
      instruction: `Nesta etapa, revise o site que o programador escreveu, comparando com o pedido do cliente e com o plano do chefe. Não reescreva o código.

Verifique:
- O site atende ao pedido? Falta alguma seção ou informação?
- Funciona bem no celular? Algo fica cortado, pequeno demais ou por cima de outra coisa?
- Os textos estão em português correto e claro?
- Acessibilidade: contraste, tamanho das letras, ordem dos títulos e descrição das fotos.
- Os links de contato (WhatsApp, telefone, e-mail) estão no formato certo?
- Há dados inventados como se fossem reais, JavaScript ou algo carregado de outros sites?

Responda com uma lista numerada de até 10 problemas, do mais grave ao menos grave. Para cada um, diga o que está errado e como corrigir, em uma ou duas frases. Se o site estiver bom, diga isso e liste só os ajustes finos.`,
      inputs: [
        { from: "request", label: "Pedido do cliente" },
        { from: "step", stepId: "plan", label: "Plano do chefe" },
        { from: "step", stepId: "code", label: "Site do programador" },
      ],
      maxOutputTokens: 1200,
      sampleOutput: SAMPLE_REVIEW,
    },
    {
      id: "consolidate",
      roleId: "chief",
      name: "Consolidação",
      summary: "O chefe junta tudo e entrega o resultado",
      instruction: `Nesta etapa, entregue a versão final do site.

Parta do site do programador e aplique as correções do revisor que fazem sentido para o cliente. Se discordar de alguma, fique com o que for melhor para o cliente.

${SITE_RULES}

Responda apenas com o código HTML completo da versão final, sem explicações e sem blocos de markdown.`,
      inputs: [
        { from: "request", label: "Pedido do cliente" },
        { from: "step", stepId: "plan", label: "Seu plano" },
        { from: "step", stepId: "code", label: "Site do programador" },
        { from: "step", stepId: "review", label: "Revisão" },
      ],
      maxOutputTokens: 6000,
      sampleOutput: SAMPLE_FINAL_SITE,
    },
  ],
};

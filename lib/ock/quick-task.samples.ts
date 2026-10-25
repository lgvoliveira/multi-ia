// Respostas de exemplo da tarefa rápida, só para a IA simulada: com elas, o gráfico, o projeto e os documentos saem
// de verdade na tela antes das IAs de verdade. As IAs reais ignoram estes textos (campo sampleResponse).

/** Um gráfico no formato combinado com a IA (CHART_SYSTEM). */
export const CHART_SAMPLE = JSON.stringify({
  tipo: "barra",
  titulo: "Vendas por mês (exemplo)",
  rotulos: ["Janeiro", "Fevereiro", "Março", "Abril"],
  series: [{ nome: "Vendas", valores: [120, 150, 90, 180] }],
});

/** Um projeto pequeno, no formato combinado com a IA (PROJECT_SYSTEM). */
export const PROJECT_SAMPLE = JSON.stringify({
  arquivos: [
    {
      caminho: "index.html",
      conteudo:
        '<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<title>Exemplo</title>\n' +
        '<link rel="stylesheet" href="estilo.css">\n</head>\n<body>\n<h1>Projeto de exemplo</h1>\n' +
        "<p>Feito pela IA simulada.</p>\n</body>\n</html>\n",
    },
    { caminho: "estilo.css", conteudo: "body { font-family: sans-serif; margin: 2rem; }\n" },
  ],
});

/** O conteúdo de um documento (vira PDF, Word ou texto). */
export const DOCUMENT_SAMPLE = [
  "Resumo",
  "Este é um documento de exemplo, escrito pela IA simulada.",
  "",
  "Pontos principais",
  "- Primeiro ponto do documento.",
  "- Segundo ponto do documento.",
  "",
  "Quando a IA de verdade estiver ligada, o conteúdo pedido aparece aqui.",
].join("\n");

/** O conteúdo de uma planilha, em CSV (vira Excel ou CSV). */
export const SHEET_SAMPLE = ["Mês,Vendas,Clientes", "Janeiro,120,30", "Fevereiro,150,34", "Março,90,25"].join("\n");

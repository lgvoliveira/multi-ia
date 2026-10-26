// O site feito pelas IAs: como ele roda na prévia. O nome do arquivo que a pessoa baixa fica em lib/ock/site-file.ts.
//
// A prévia é um "quarto trancado" em três camadas (regra do AGENTS.md, seção 6):
// 1. A moldura (SitePreview.tsx) usa sandbox="allow-scripts" SEM allow-same-origin: o site não enxerga
//    a nossa página, o login, os cookies nem o armazenamento do navegador.
// 2. As regras abaixo vão no começo do próprio site e barram tudo o que viria da internet.
// 3. O cabeçalho "frame-src 'none'" da nossa página (next.config.ts) impede que o site leve a moldura
//    para outro endereço, que seria um jeito de mandar dados para fora.

/** O que o site pode usar na prévia: só o que vem escrito dentro do próprio arquivo. Nada da internet. */
export const PREVIEW_POLICY = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src data:",
  "media-src data: blob:",
  "form-action 'none'",
].join("; ");

// Na prévia, só os links para partes do próprio site (#cardapio) funcionam. Os outros (WhatsApp,
// telefone, outros sites) não abrem: a moldura não pode sair para a internet. Isto é só para o clique
// num link não "quebrar" a prévia; quem barra de verdade um código que tente sair é a camada 3.
const LINK_GUARD = `document.addEventListener("click", function (event) {
  var link = event.target instanceof Element ? event.target.closest("a[href], area[href]") : null;
  if (link && link.getAttribute("href").trim().charAt(0) !== "#") event.preventDefault();
}, true);`;

const PREVIEW_HEAD = [
  `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_POLICY}">`,
  `<meta http-equiv="x-dns-prefetch-control" content="off">`,
  // Sem isto, "#cardapio" apontaria para o endereço da nossa página, e a moldura tentaria carregá-la.
  `<base href="about:srcdoc">`,
  `<script>${LINK_GUARD}</script>`,
].join("\n");

const DOCTYPE = /^\s*<!doctype[^>]*>/i;

/** O site pronto para a prévia: as regras entram antes de qualquer coisa escrita pelas IAs. */
export function buildPreviewDocument(html: string): string {
  // O <!DOCTYPE> continua na frente: sem ele na primeira linha, o navegador desenha a página no modo antigo.
  const doctype = html.match(DOCTYPE)?.[0] ?? "";
  return `${doctype}\n${PREVIEW_HEAD}\n${html.slice(doctype.length)}`;
}

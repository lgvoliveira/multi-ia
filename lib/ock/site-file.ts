// O nome do arquivo do site feito pela receita "Criar um site": o mesmo no botão "Baixar arquivo" da tela e na entrega
// guardada na pasta da pessoa (F47). Só texto: vai para a tela e para o servidor.

const MAX_FILE_NAME_LENGTH = 60;
const DEFAULT_FILE_NAME = "meu-site";

/** Nome do arquivo para baixar, tirado do título do site: "Doce Encanto Confeitaria" vira "doce-encanto-confeitaria.html". */
export function siteFileName(html: string): string {
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "";
  const name = title
    .replace(/&[#\w]+;/g, " ") // códigos como &amp;
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tira os acentos: "Café" vira "Cafe"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, MAX_FILE_NAME_LENGTH)
    .replace(/^-+|-+$/g, "");
  return `${name || DEFAULT_FILE_NAME}.html`;
}

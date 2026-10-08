// Respostas de exemplo da receita "Criar um site", devolvidas pela IA simulada.
// A IA simulada sempre devolve este exemplo (uma confeitaria), qualquer que seja o pedido.
// O site final corrige o que a revisão aponta no primeiro site.

export const SAMPLE_PLAN = `Plano do site — Doce Encanto Confeitaria

1. Objetivo: apresentar a confeitaria e levar o visitante a fazer o pedido pelo WhatsApp.

2. Público: moradores da região procurando bolos e doces para festas, presentes e o dia a dia, quase sempre pelo celular.

3. Seções:
- Topo: nome da confeitaria, a frase "Bolos e doces caseiros, feitos com carinho para o seu dia" e o botão "Pedir pelo WhatsApp".
- Cardápio: 4 produtos em cartões, cada um com foto, nome, descrição curta e preço.
- Horário e endereço: dias e horários de funcionamento, endereço e telefone.
- Rodapé: nome da confeitaria e um lembrete de que os pedidos são feitos pelo WhatsApp.
- Um botão de WhatsApp fixo no canto da tela, sempre visível.

4. Visual: aconchegante e caseiro. Cores: rosa #C2185B (botões), creme #FFF8F0 (fundo) e marrom #4E342E (textos). Tom dos textos: próximo e simpático.

5. Informações que faltam (o site usa marcadores):
- [seu WhatsApp com DDD]
- [dias e horários de funcionamento]
- [seu endereço]
- [seu telefone]
- [preço] de cada produto
`;

export const SAMPLE_REVIEW = `Revisão do site

1. O botão fixo do WhatsApp fica por cima do texto do rodapé no celular. Correção: dar ao rodapé um espaço extra embaixo (cerca de 96px), para o botão não cobrir nada.
2. Os blocos que representam as fotos não têm descrição para quem usa leitor de tela. Correção: marcar cada bloco com role="img" e um aria-label, como pedem as regras do time.
3. Ajuste fino: o horário de funcionamento só aparece no fim da página. Vale repetir o marcador de horário no topo, logo abaixo da frase de apresentação.

O resto está bom: o cardápio atende ao pedido, o contraste das cores é adequado e os dados que faltam estão como marcadores.
`;

const MENU = [
  {
    name: "Bolo de chocolate",
    description: "Massa fofinha com recheio e cobertura de brigadeiro.",
    photo: "Foto do bolo de chocolate",
  },
  {
    name: "Brigadeiros gourmet (cento)",
    description: "Tradicional, ninho, pistache e maracujá.",
    photo: "Foto de uma bandeja de brigadeiros",
  },
  {
    name: "Torta de limão",
    description: "Base crocante, creme de limão e merengue tostado.",
    photo: "Foto da torta de limão",
  },
  {
    name: "Bolo de pote",
    description: "Ninho com morango, prestígio ou chocolate. Ótimo para presentear.",
    photo: "Foto de bolos de pote",
  },
];

function buildSampleSite(final: boolean): string {
  const menuItems = MENU.map((item) => {
    const photoAttributes = final ? ` role="img" aria-label="${item.photo}"` : "";
    return `      <article class="item">
        <div class="foto"${photoAttributes}>[${item.photo}]</div>
        <h3>${item.name}</h3>
        <p>${item.description}</p>
        <p class="preco">[preço]</p>
      </article>`;
  }).join("\n");

  const footerSpace = final
    ? "\n    footer { padding-bottom: 96px; } /* espaço para o botão fixo não cobrir o rodapé */"
    : "";
  const headerHours = final ? '\n    <p class="horario">Aberto [dias e horários]</p>' : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Doce Encanto Confeitaria</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Georgia, "Times New Roman", serif; background: #FFF8F0; color: #4E342E; line-height: 1.6; }
    header { padding: 48px 20px; text-align: center; background: #FCE4EC; }
    h1 { margin: 0 0 8px; font-size: 2rem; color: #880E4F; }
    .lema { margin: 0 0 16px; font-size: 1.125rem; }
    .horario { margin: 0 0 24px; font-family: Arial, sans-serif; font-weight: bold; }
    .botao { display: inline-block; margin-top: 8px; padding: 14px 24px; border-radius: 999px; background: #C2185B; color: #FFFFFF; font-family: Arial, sans-serif; font-weight: bold; text-decoration: none; }
    section { max-width: 960px; margin: 0 auto; padding: 40px 20px; }
    h2 { margin: 0 0 20px; font-size: 1.5rem; color: #880E4F; }
    .cardapio { display: grid; gap: 20px; }
    .item { background: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(78, 52, 46, 0.12); }
    .foto { display: flex; align-items: center; justify-content: center; height: 160px; padding: 12px; background: #F8BBD0; color: #880E4F; font-family: Arial, sans-serif; font-size: 0.95rem; text-align: center; }
    .item h3 { margin: 16px 16px 4px; font-size: 1.125rem; }
    .item p { margin: 0 16px 12px; }
    .preco { font-weight: bold; color: #C2185B; }
    .whatsapp-fixo { position: fixed; right: 16px; bottom: 16px; padding: 14px 20px; border-radius: 999px; background: #1B5E20; color: #FFFFFF; font-family: Arial, sans-serif; font-weight: bold; text-decoration: none; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25); }
    footer { padding: 24px 20px; text-align: center; background: #4E342E; color: #FFF8F0; font-size: 0.95rem; }${footerSpace}
    @media (min-width: 700px) {
      h1 { font-size: 2.75rem; }
      .cardapio { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <header>
    <h1>Doce Encanto Confeitaria</h1>
    <p class="lema">Bolos e doces caseiros, feitos com carinho para o seu dia.</p>${headerHours}
    <a class="botao" href="https://wa.me/55[DDD][número]">Pedir pelo WhatsApp</a>
  </header>
  <main>
    <section id="cardapio">
      <h2>Cardápio</h2>
      <div class="cardapio">
${menuItems}
      </div>
    </section>
    <section id="horario-e-endereco">
      <h2>Horário e endereço</h2>
      <p><strong>Horário:</strong> [dias e horários de funcionamento]</p>
      <p><strong>Endereço:</strong> [seu endereço]</p>
      <p><strong>Telefone:</strong> <a href="tel:+55[DDD][número]">[seu telefone]</a></p>
    </section>
  </main>
  <footer>
    <p>Doce Encanto Confeitaria · Pedidos pelo WhatsApp</p>
  </footer>
  <a class="whatsapp-fixo" href="https://wa.me/55[DDD][número]">WhatsApp</a>
</body>
</html>
`;
}

export const SAMPLE_FIRST_SITE = buildSampleSite(false);
export const SAMPLE_FINAL_SITE = buildSampleSite(true);

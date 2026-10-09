import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Nenhuma moldura das nossas páginas pode carregar outro endereço. A prévia do site feito pelas IAs
          // vai escrita direto na moldura (components/SitePreview.tsx) e continua funcionando; se o código
          // dela tentar levar a moldura para outro site (e mandar dados junto), o navegador bloqueia.
          { key: "Content-Security-Policy", value: "frame-src 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;

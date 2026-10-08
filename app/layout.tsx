import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import "@/styles/tokens.css";
import "./globals.css";

// As fontes são baixadas na hora do build e servidas pelo nosso próprio site:
// o navegador do usuário não faz nenhum pedido ao Google.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-family-bricolage",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-family-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-family-plex-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Multi-IA",
    template: "%s · Multi-IA",
  },
  description: "Monte um time de IAs que trabalham juntas na sua tarefa.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const fontVariables = `${bricolage.variable} ${plexSans.variable} ${plexMono.variable}`;

  return (
    <html lang="pt-BR" className={fontVariables}>
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}

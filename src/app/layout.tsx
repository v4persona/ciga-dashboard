import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const ciga = localFont({
  variable: "--font-ciga",
  display: "swap",
  src: [
    { path: "../../public/fonts/HelveticaNeueLTPro-Lt.otf", weight: "300", style: "normal" },
    { path: "../../public/fonts/HelveticaNeueLTPro-Md.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/HelveticaNeueLTPro-Bd.otf", weight: "700", style: "normal" },
  ],
});

const cigaCondensed = localFont({
  variable: "--font-ciga-condensed",
  display: "swap",
  src: [{ path: "../../public/fonts/HelveticaNeueLTPro-BdCn.otf", weight: "700", style: "normal" }],
});

export const metadata: Metadata = {
  title: "CIGA design · Painel",
  description: "Vendas, estoque e tráfego pago da CIGA design Brasil em uma página.",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${ciga.variable} ${cigaCondensed.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

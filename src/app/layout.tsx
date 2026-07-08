import type { Metadata } from "next";
import { Italiana, Jost } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const italiana = Italiana({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-italiana",
});

const jost = Jost({
  weight: ["300", "400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-jost",
});

export const metadata: Metadata = {
  title: "Le Bar de Noa",
  description: "Stock d'alcool, cocktails et organisation des soirées",
};

const NAV = [
  { href: "/stock", label: "Stock" },
  { href: "/cocktails", label: "Cocktails" },
  { href: "/soirees", label: "Soirées" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`h-full ${italiana.variable} ${jost.variable}`}>
      <body className="min-h-full flex flex-col bg-ink text-cream selection:bg-orange/35 selection:text-white">
        <header className="border-b border-orange/20 bg-ink/90 backdrop-blur-md sticky top-0 z-50 transition-all duration-300">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
            <Link href="/" className="font-display text-2xl tracking-wider text-orange hover:text-orange-hover transition-colors flex items-center gap-2">
              <span className="text-xl">🍸</span> Le Bar de Noa
            </Link>
            <nav className="flex gap-6 text-xs uppercase tracking-caps text-muted font-medium">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-orange hover:orange-glow py-1 transition-colors duration-200">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-10">{children}</main>
        <footer className="border-t border-brick/40 text-center text-[10px] uppercase tracking-caps text-muted/65 py-6 bg-ink-2/30">
          Fait maison avec passion · Le Bar de Noa © {new Date().getFullYear()}
        </footer>
      </body>
    </html>
  );
}

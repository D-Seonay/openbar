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
      <body className="min-h-full flex flex-col bg-ink text-cream">
        <header className="border-b border-brick/40 bg-ink/95 backdrop-blur sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
            <Link href="/" className="font-display text-xl tracking-wide text-gold">
              Le Bar de Noa
            </Link>
            <nav className="flex gap-8 text-xs uppercase tracking-caps text-muted">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-gold transition-colors">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-10">{children}</main>
        <footer className="border-t border-brick/40 text-center text-[11px] uppercase tracking-caps text-muted py-5">
          Fait maison, comme les cocktails
        </footer>
      </body>
    </html>
  );
}

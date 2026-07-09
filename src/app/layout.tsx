import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { isAdminLoggedIn } from "@/lib/auth";
import AdminBadge from "@/components/AdminBadge";

const outfit = Outfit({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-outfit",
});

const jakarta = Plus_Jakarta_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "Le Bar de Noa — Mixologie & Cave Privée",
  description: "Stock d'exception, recettes de cocktails et organisation de soirées",
};

const NAV = [
  { href: "/stock", label: "Cave & Stock" },
  { href: "/cocktails", label: "Cocktails" },
  { href: "/soirees", label: "Soirées" },
];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isAdmin = await isAdminLoggedIn();

  return (
    <html lang="fr" className={`h-full ${outfit.variable} ${jakarta.variable}`}>
      <body className="min-h-full flex flex-col bg-ink text-cream selection:bg-orange/30 selection:text-white font-sans antialiased">
        <header className="border-b border-white/[0.07] bg-ink/80 backdrop-blur-xl sticky top-0 z-50 transition-all duration-300">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
            <Link 
              href="/" 
              className="font-display text-xl sm:text-2xl font-bold tracking-tight text-cream hover:text-orange transition-colors flex items-center gap-2.5"
            >
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange to-copper flex items-center justify-center text-ink text-base font-bold shadow-sm">
                N
              </span>
              <span>Le Bar <span className="text-orange font-semibold">de Noa</span></span>
            </Link>
            <nav className="flex items-center gap-1.5 sm:gap-4 flex-wrap">
              {NAV.map((item) => (
                <Link 
                  key={item.href} 
                  href={item.href} 
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider text-muted hover:text-cream hover:bg-white/[0.04] transition-all duration-200"
                >
                  {item.label}
                </Link>
              ))}
              <div className="pl-1 sm:pl-2 border-l border-white/[0.08]">
                <AdminBadge isAdmin={isAdmin} />
              </div>
            </nav>
          </div>
        </header>
        <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-10">{children}</main>
        <footer className="border-t border-white/[0.05] text-center text-xs text-muted/60 py-8 bg-ink-2/40">
          Le Bar de Noa · Espace privé de mixologie © {new Date().getFullYear()}
        </footer>
      </body>
    </html>
  );
}

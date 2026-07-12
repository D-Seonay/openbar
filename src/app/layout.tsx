import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { isAdminLoggedIn } from "@/lib/session";
import Navigation from "@/components/Navigation";

const outfit = Outfit({
  weight: ["500", "600", "700", "800"],
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isAdmin = await isAdminLoggedIn();

  return (
    <html lang="fr" className={`h-full ${outfit.variable} ${jakarta.variable}`}>
      <body className="min-h-full flex flex-col bg-[#050505] text-zinc-100 selection:bg-amber-500/20 selection:text-amber-300 font-sans antialiased relative overflow-x-hidden">
        {/* Architectural Ambient Lighting */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-[600px] h-[300px] rounded-full bg-amber-500/[0.025] blur-[140px]" />
          <div className="absolute bottom-1/3 right-10 w-[400px] h-[400px] rounded-full bg-zinc-800/[0.08] blur-[160px]" />
        </div>

        <header className="border-b border-zinc-800/70 bg-[#050505]/90 backdrop-blur-2xl sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
            <Link
              href="/"
              className="group flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700/80 flex items-center justify-center font-mono text-xs font-black text-amber-400 group-hover:border-amber-400/50 transition-colors">
                BN
              </div>
              <div>
                <span className="font-display text-base font-bold tracking-tight text-zinc-100 block leading-none">
                  Le Bar de Noa
                </span>
                <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mt-0.5 block">
                  STUDIO ARCHITECTURE // v2.4
                </span>
              </div>
            </Link>

            <Navigation isAdmin={isAdmin} />
          </div>
        </header>

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-8 relative z-10">
          {children}
        </main>

        <footer className="border-t border-zinc-900 text-center text-[11px] font-mono text-zinc-600 py-8 bg-[#050505] relative z-10">
          BARDENOA SYSTEM // MIXOLOGY & INVENTORY CORE · {new Date().getFullYear()}
        </footer>
      </body>
    </html>
  );
}

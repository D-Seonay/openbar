import type { Metadata, Viewport } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { getSession } from "@/lib/session";
import { listMyBars, getMyProfile } from "@/lib/api-client";
import { resolveActiveBar } from "@/lib/active-bar";
import Navigation from "@/components/Navigation";
import AccountMenu from "@/components/AccountMenu";
import BarSwitcher from "@/components/BarSwitcher";

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
  title: "OpenBar — Mixologie & Cave Privée",
  description: "Stock d'exception, recettes de cocktails et organisation de soirées",
  appleWebApp: {
    capable: true,
    title: "OpenBar",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Never block pinch-zoom — users must be able to zoom the cocktail sheets.
  maximumScale: 5,
  // Let the ambient background bleed into the notch / home-indicator areas.
  viewportFit: "cover",
  themeColor: "#110d0c",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const isAdmin = session?.role === "ADMIN";
  const bars = session ? await listMyBars() : [];
  const activeBar = session ? await resolveActiveBar(bars) : null;
  const profile = session ? await getMyProfile() : null;

  return (
    <html lang="fr" className={`h-full ${outfit.variable} ${jakarta.variable}`}>
      <body className="min-h-full flex flex-col bg-ink text-cream selection:bg-orange/30 selection:text-white font-sans antialiased relative overflow-x-hidden">
        {/* Subtle Warm Lounge Ambient Lighting — smaller blur radii on phones,
            where a 500px/140px-blur layer is expensive to composite. */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute -top-32 -left-32 w-[280px] h-[280px] sm:w-[500px] sm:h-[500px] rounded-full bg-orange/[0.045] blur-[80px] sm:blur-[140px]" />
          <div className="absolute top-1/3 -right-32 w-[260px] h-[260px] sm:w-[450px] sm:h-[450px] rounded-full bg-gold/[0.04] blur-[80px] sm:blur-[150px]" />
        </div>

        <header className="border-b border-white/[0.08] bg-ink/85 backdrop-blur-2xl sticky top-0 z-50 transition-all duration-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4">
            <Link
              href="/"
              className="group font-display text-lg sm:text-2xl font-bold tracking-tight text-cream hover:text-orange transition-colors flex items-center gap-2 sm:gap-2.5 shrink-0"
            >
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange via-orange-dim to-brick-dark border border-orange/40 flex items-center justify-center text-ink text-lg font-black shadow-[0_0_15px_rgba(255,107,53,0.3)] group-hover:scale-105 transition-transform duration-200 shrink-0">
                O
              </span>
              <span>
                Open<span className="text-transparent bg-clip-text bg-gradient-to-r from-orange to-gold">Bar</span>
              </span>
            </Link>

            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {session && !activeBar && (
                <Link
                  href="/creer"
                  className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-orange hover:text-orange-hover transition-colors text-right leading-tight"
                >
                  Crée ton bar
                </Link>
              )}
              {/* On mobile the switcher lives inside the nav drawer instead. */}
              {activeBar && bars.length > 1 && (
                <div className="hidden md:block">
                  <BarSwitcher bars={bars} activeBarId={activeBar.id} />
                </div>
              )}
              <Navigation
                isBarOwner={activeBar?.myRole === "OWNER"}
                isLoggedIn={!!session}
                hasActiveBar={!!activeBar}
                bars={bars}
                activeBarId={activeBar?.id}
              />
              <div className="pl-2 border-l border-white/[0.1] flex items-center shrink-0">
                <AccountMenu session={session} avatarUrl={profile?.avatarUrl ?? null} />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-8 relative z-10">
          {children}
        </main>

        <footer className="border-t border-white/[0.06] text-center text-xs text-muted/70 py-6 sm:py-8 px-4 bg-ink-2/50 backdrop-blur-sm relative z-10 pb-safe">
          OpenBar · Salon privé de mixologie © {new Date().getFullYear()}
        </footer>
      </body>
    </html>
  );
}

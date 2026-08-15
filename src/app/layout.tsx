import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import "./globals.css";
import { getSession } from "@/lib/session";
import { listMyBars, getMyProfile } from "@/lib/api-client";
import { resolveActiveBar } from "@/lib/active-bar";
import AccountMenu from "@/components/AccountMenu";
import BarSwitcher from "@/components/BarSwitcher";
import { TabBar } from "@/components/ui";

/**
 * Fonts are served from the repo, not fetched from Google at build time.
 *
 * `next/font/google` downloads the files during `next build`, which made every
 * deploy depend on fonts.gstatic.com answering consistently. It stopped doing
 * so: Google rotated the file hashes behind an unchanged version, the build
 * asked for URLs that had become 404s, and the image failed to build for a
 * reason that had nothing to do with this repository.
 *
 * Only the latin subset is kept — the app is in French, and the other subsets
 * were roughly ten times the bytes for nothing. Both families are OFL-licensed,
 * so redistributing them here is fine.
 */
const lora = localFont({
  src: [{ path: "./fonts/Lora-latin.woff2", weight: "400 700", style: "normal" }],
  variable: "--font-lora",
  display: "swap",
  // `adjustFontFallback` n'accepte que 'Arial' | 'Times New Roman' | false.
  // On prend la seule sérif de la liste : les métriques de repli se calent
  // ainsi sur une sérif, ce qui limite le saut de gabarit à la substitution.
  adjustFontFallback: "Times New Roman",
});

const jakarta = localFont({
  src: [
    { path: "./fonts/PlusJakartaSans-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/PlusJakartaSans-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/PlusJakartaSans-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-jakarta",
  display: "swap",
  adjustFontFallback: "Arial",
});

export const metadata: Metadata = {
  title: "OpenBar — Mixologie & Cave Privée",
  description: "Stock d'exception, recettes de cocktails et organisation de soirées",
  appleWebApp: {
    capable: true,
    title: "OpenBar",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Never block pinch-zoom — users must be able to zoom the cocktail sheets.
  maximumScale: 5,
  // Nécessaire pour que env(safe-area-inset-bottom) soit renseigné : la barre
  // d'onglets s'en sert pour ne pas passer sous l'indicateur d'accueil iOS.
  viewportFit: "cover",
  themeColor: "#F3EFE7",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const bars = session ? await listMyBars() : [];
  const activeBar = session ? await resolveActiveBar(bars) : null;
  const profile = session ? await getMyProfile() : null;

  return (
    <html lang="fr" className={`h-full ${lora.variable} ${jakarta.variable}`}>
      <body className="min-h-full flex flex-col bg-paper text-ink font-sans antialiased overflow-x-hidden">
        <header className="border-b border-rule bg-paper sticky top-0 z-40">
          <div className="max-w-3xl mx-auto px-4 h-[52px] flex items-center justify-between gap-3">
            <Link
              href="/"
              className="min-h-[44px] flex items-center font-display text-[17px] text-ink truncate"
            >
              {activeBar?.name ?? "OpenBar"}
            </Link>
            <div className="flex items-center gap-2 shrink-0">
              {session && !activeBar && (
                <Link
                  href="/creer"
                  className="min-h-[44px] flex items-center text-[13px] font-semibold text-terracotta"
                >
                  Crée ton bar
                </Link>
              )}
              {activeBar && bars.length > 1 && (
                <BarSwitcher bars={bars} activeBarId={activeBar.id} />
              )}
              <AccountMenu session={session} avatarUrl={profile?.avatarUrl ?? null} />
            </div>
          </div>
        </header>

        {/* pb-24 réserve la hauteur de la TabBar : sans cela le dernier élément
            de chaque page passe dessous et devient intouchable. */}
        <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-5 pb-24">
          {children}
        </main>

        {session ? <TabBar /> : null}
      </body>
    </html>
  );
}

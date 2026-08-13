"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { Bar } from "@/lib/types";
import BarSwitcher from "./BarSwitcher";

const NAV = [
  { href: "/stock", label: "Cave & Stock", icon: "🥃" },
  { href: "/cocktails", label: "Cocktails", icon: "🍸" },
  { href: "/soirees", label: "Soirées", icon: "🎉" },
  { href: "/annuaire", label: "Annuaire", icon: "👥" },
];

const OWNER_NAV = [
  { href: "/membres", label: "Membres", icon: "🔑" },
  { href: "/journal", label: "Journal", icon: "📖" },
];

type NavItem = { href: string; label: string; icon: string; exact?: boolean };

function isActiveItem(item: NavItem, pathname: string) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

function DesktopLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = isActiveItem(item, pathname);
  return (
    <Link
      href={item.href}
      className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
        isActive
          ? "bg-gradient-to-r from-orange/20 to-gold/15 text-cream border border-orange/40 shadow-[0_0_15px_rgba(255,107,53,0.18)]"
          : "text-muted hover:text-cream hover:bg-white/[0.04] border border-transparent"
      }`}
    >
      <span>{item.label}</span>
    </Link>
  );
}

function DrawerLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate: () => void;
}) {
  const isActive = isActiveItem(item, pathname);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-colors ${
        isActive
          ? "bg-gradient-to-r from-orange/20 to-gold/15 text-cream border border-orange/40"
          : "text-muted hover:text-cream hover:bg-white/[0.05] border border-white/[0.06]"
      }`}
    >
      <span className="text-lg leading-none">{item.icon}</span>
      <span className="flex-1">{item.label}</span>
      <span className={isActive ? "text-orange" : "text-muted/50"}>→</span>
    </Link>
  );
}

export default function Navigation({
  isBarOwner = false,
  isLoggedIn,
  hasActiveBar = false,
  bars = [],
  activeBarId,
}: {
  isBarOwner?: boolean;
  isLoggedIn: boolean;
  hasActiveBar?: boolean;
  bars?: Bar[];
  activeBarId?: string;
}) {
  const pathname = usePathname();

  // The drawer is open only while we're still on the route it was opened from,
  // so any navigation (link tap, browser back) closes it without an effect.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const setOpen = (next: boolean) => setOpenedOn(next ? pathname : null);

  // Freeze the page behind the drawer so scrolling the menu doesn't scroll the
  // content underneath on iOS.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenedOn(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const items: NavItem[] = [
    ...(isLoggedIn && hasActiveBar ? NAV : []),
    ...(isBarOwner && hasActiveBar ? OWNER_NAV : []),
  ];

  if (items.length === 0) return null;

  return (
    <>
      {/* Desktop: inline pills. Below md the row can't hold five of them next to
          the logo, the bar switcher and the avatar, so it becomes a drawer. */}
      <nav className="hidden md:flex items-center gap-1.5 lg:gap-2">
        {items.map((item) => (
          <DesktopLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le menu"
        aria-expanded={open}
        className="md:hidden flex flex-col items-center justify-center gap-[5px] w-10 h-10 rounded-xl border border-white/[0.08] bg-white/[0.03] active:bg-white/[0.08] transition-colors cursor-pointer"
      >
        <span className="block w-4 h-[1.5px] rounded-full bg-cream" />
        <span className="block w-4 h-[1.5px] rounded-full bg-cream" />
        <span className="block w-4 h-[1.5px] rounded-full bg-cream" />
      </button>

      {/* The header sets `backdrop-blur`, which makes it the containing block for
          fixed-position descendants — the drawer has to be portaled to <body> to
          size against the real viewport. The drawer is closed during SSR and on
          the hydration render alike, so guarding on `document` is safe. */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  onClick={() => setOpen(false)}
                  className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] md:hidden"
                />

                <motion.nav
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="fixed top-0 right-0 h-dvh w-[85vw] max-w-xs bg-ink-2 border-l border-white/[0.1] z-[71] md:hidden flex flex-col shadow-2xl"
                >
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] shrink-0">
                    <span className="text-[10px] uppercase tracking-caps text-gold font-bold">
                      Navigation
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label="Fermer le menu"
                      className="w-10 h-10 rounded-xl bg-ink border border-white/[0.1] text-muted text-lg flex items-center justify-center cursor-pointer"
                    >
                      ×
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-4 py-5 space-y-2.5">
                    {bars.length > 1 && activeBarId && (
                      <div className="pb-3 mb-2 border-b border-white/[0.08] space-y-1.5">
                        <span className="text-[10px] uppercase tracking-caps text-muted font-semibold block">
                          Bar actif
                        </span>
                        <BarSwitcher bars={bars} activeBarId={activeBarId} className="w-full" />
                      </div>
                    )}

                    {items.map((item) => (
                      <DrawerLink
                        key={item.href}
                        item={item}
                        pathname={pathname}
                        onNavigate={() => setOpen(false)}
                      />
                    ))}
                  </div>

                  <div className="px-5 py-4 border-t border-white/[0.08] text-[10px] text-muted/70 shrink-0 pb-safe">
                    OpenBar · Salon privé de mixologie
                  </div>
                </motion.nav>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

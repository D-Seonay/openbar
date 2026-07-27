"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/stock", label: "Cave & Stock" },
  { href: "/cocktails", label: "Cocktails" },
  { href: "/soirees", label: "Soirées" },
];

const ADMIN_NAV = [
  { href: "/comptes", label: "Comptes" },
  { href: "/admin/bars", label: "Tous les bars" },
];
const OWNER_NAV = [{ href: "/membres", label: "Membres" }];

function navLink(item: { href: string; label: string }, pathname: string) {
  const isActive = pathname.startsWith(item.href);
  return (
    <Link
      key={item.href}
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

export default function Navigation({
  isAdmin,
  isBarOwner = false,
  isLoggedIn,
}: {
  isAdmin: boolean;
  isBarOwner?: boolean;
  isLoggedIn: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
      {isLoggedIn && NAV.map((item) => navLink(item, pathname))}
      {isBarOwner && OWNER_NAV.map((item) => navLink(item, pathname))}
      {isAdmin && ADMIN_NAV.map((item) => navLink(item, pathname))}
    </nav>
  );
}

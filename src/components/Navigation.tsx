"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminBadge from "./AdminBadge";

const NAV = [
  { href: "/stock", label: "Cave & Stock", tag: "INVENTORY" },
  { href: "/cocktails", label: "Mixologie", tag: "RECIPES" },
  { href: "/soirees", label: "Soirées", tag: "EVENTS" },
];

const ADMIN_NAV = [{ href: "/comptes", label: "Comptes", tag: "ADMIN" }];

export default function Navigation({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 sm:gap-2 flex-wrap">
      {NAV.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 ${
              isActive
                ? "bg-zinc-800/90 text-zinc-100 border border-zinc-700/80 shadow-sm"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60 border border-transparent"
            }`}
          >
            <span className="font-mono text-[9px] tracking-widest text-zinc-500 group-hover:text-amber-400 transition-colors">
              //
            </span>
            <span className="font-semibold tracking-wide uppercase">{item.label}</span>
          </Link>
        );
      })}

      {isAdmin &&
        ADMIN_NAV.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 ${
                isActive
                  ? "bg-zinc-800/90 text-zinc-100 border border-zinc-700/80 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60 border border-transparent"
              }`}
            >
              <span className="font-mono text-[9px] tracking-widest text-amber-500/70">
                SYS
              </span>
              <span className="font-semibold tracking-wide uppercase">{item.label}</span>
            </Link>
          );
        })}

      <div className="pl-2 border-l border-zinc-800/80 ml-1 flex items-center">
        <AdminBadge isAdmin={isAdmin} />
      </div>
    </nav>
  );
}

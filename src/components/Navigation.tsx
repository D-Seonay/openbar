"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminBadge from "./AdminBadge";

const NAV = [
  { href: "/stock", label: "Cave & Stock", icon: "🥃" },
  { href: "/cocktails", label: "Cocktails", icon: "🍸" },
  { href: "/soirees", label: "Soirées", icon: "🎉" },
];

const ADMIN_NAV = [{ href: "/comptes", label: "Comptes", icon: "⚙️" }];

export default function Navigation({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1.5 sm:gap-3 flex-wrap">
      {NAV.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
              isActive
                ? "bg-gradient-to-r from-orange/20 to-gold/15 text-cream border border-orange/40 shadow-[0_0_15px_rgba(255,107,53,0.18)]"
                : "text-muted hover:text-cream hover:bg-white/[0.04] border border-transparent"
            }`}
          >
            <span className="text-sm">{item.icon}</span>
            <span>{item.label}</span>
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
              className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                isActive
                  ? "bg-gradient-to-r from-orange/20 to-gold/15 text-cream border border-orange/40 shadow-[0_0_15px_rgba(255,107,53,0.18)]"
                  : "text-muted hover:text-cream hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <span className="text-sm">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}

      <div className="pl-1 sm:pl-2.5 border-l border-white/[0.1] ml-1">
        <AdminBadge isAdmin={isAdmin} />
      </div>
    </nav>
  );
}

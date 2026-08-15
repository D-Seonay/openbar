import type { ReactNode } from "react";

type Ton = "neutre" | "complet" | "alerte";

const TONS: Record<Ton, string> = {
  neutre: "text-ink-soft border-rule",
  complet: "text-done border-done/35",
  alerte: "text-warn border-warn/35",
};

interface BadgeProps {
  ton?: Ton;
  children: ReactNode;
}

export default function Badge({ ton = "neutre", children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5
        text-[13px] font-medium whitespace-nowrap ${TONS[ton]}`}
    >
      {children}
    </span>
  );
}

import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Sans filet, la carte n'est qu'une zone de fond — utile en liste dense. */
  filet?: boolean;
  children: ReactNode;
}

export default function Card({
  filet = true,
  className = "",
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={`rounded-xl bg-paper p-4 ${filet ? "border border-rule" : ""} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

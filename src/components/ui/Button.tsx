import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "principal" | "discret" | "danger";

const VARIANTS: Record<Variant, string> = {
  principal: "bg-terracotta text-paper hover:bg-terracotta/90 border-transparent",
  discret: "bg-transparent text-ink border-rule hover:bg-paper-sunk",
  danger: "bg-transparent text-terracotta border-terracotta/40 hover:bg-terracotta/10",
};

// Base commune à <Button> et à `lienBoutonClasses` : un seul endroit où le
// gabarit (taille, anneau de focus) peut dériver, quel que soit l'élément
// qui le porte.
const BASE_CLASSES =
  "min-h-[44px] px-4 rounded-lg border text-[15px] font-semibold " +
  "inline-flex items-center justify-center gap-2 transition-colors " +
  "disabled:opacity-45 disabled:pointer-events-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

/** Classes à poser sur un <Link> qui doit ressembler à un Button.
    Extraites pour que les liens d'action ne dérivent pas du composant,
    et surtout pour qu'ils héritent du même anneau de focus clavier. */
export const lienBoutonClasses = (variant: Variant = "principal", pleineLargeur = false) =>
  `${BASE_CLASSES} ${VARIANTS[variant]} ${pleineLargeur ? "w-full" : ""}`;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  pleineLargeur?: boolean;
  children: ReactNode;
}

export default function Button({
  variant = "principal",
  pleineLargeur = false,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      // 44px est impose ici plutot que laisse a chaque appelant : c'est la
      // seule facon que la regle tienne sur une quarantaine d'ecrans.
      className={`${BASE_CLASSES} ${VARIANTS[variant]} ${pleineLargeur ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

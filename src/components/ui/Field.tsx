import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  /** Doit correspondre à l'`id` du contrôle enfant, sinon le label ne le cible pas. */
  htmlFor: string;
  aide?: string;
  erreur?: string;
  children: ReactNode;
}

export default function Field({ label, htmlFor, aide, erreur, children }: FieldProps) {
  return (
    <div className="mb-4">
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-ink mb-1.5">
        {label}
      </label>
      {children}
      {aide && !erreur ? <p className="mt-1 text-[13px] text-ink-soft">{aide}</p> : null}
      {erreur ? (
        <p className="mt-1 text-[13px] text-terracotta" role="alert">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}

/** Classes à poser sur le contrôle enfant, pour que tous les champs concordent. */
export const champClasses =
  "w-full min-h-[44px] px-3 rounded-lg bg-paper-sunk border border-rule text-ink " +
  "text-[15px] placeholder:text-ink-soft " +
  "focus:outline-2 focus:outline-offset-0 focus:outline-terracotta focus:border-terracotta";

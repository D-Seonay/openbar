import type { ReactNode } from "react";

interface EmptyStateProps {
  titre: string;
  message: string;
  /** L'action qui sort de l'état vide. Omise quand il n'y en a pas. */
  action?: ReactNode;
}

export default function EmptyState({ titre, message, action }: EmptyStateProps) {
  return (
    <div className="py-12 px-4 text-center">
      <p className="font-display text-[17px] text-ink">{titre}</p>
      <p className="mt-2 text-[13px] text-ink-soft max-w-xs mx-auto">{message}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

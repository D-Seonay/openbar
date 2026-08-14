import Link from "next/link";
import type { ReactNode } from "react";

interface RowProps {
  titre: ReactNode;
  sousTitre?: ReactNode;
  /** Contenu aligné à droite : un Badge, un compteur, un prix. */
  droite?: ReactNode;
  href?: string;
  onClick?: () => void;
  chevron?: boolean;
}

export default function Row({ titre, sousTitre, droite, href, onClick, chevron }: RowProps) {
  const contenu = (
    <>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold text-ink truncate">{titre}</div>
        {sousTitre ? (
          <div className="text-[13px] text-ink-soft truncate mt-0.5">{sousTitre}</div>
        ) : null}
      </div>
      {droite ? <div className="shrink-0">{droite}</div> : null}
      {chevron ? (
        <span aria-hidden className="shrink-0 text-ink-soft text-[15px]">
          ›
        </span>
      ) : null}
    </>
  );

  // 44px de haut, un filet en bas : c'est la liste de la maquette. Le filet
  // remplace la carte, c'est ce qui allège la densité perçue.
  const classes =
    "w-full min-h-[44px] py-3 flex items-center gap-3 text-left " +
    "border-b border-rule last:border-b-0";

  if (href) {
    return (
      <Link href={href} className={`${classes} active:bg-paper-sunk`}>
        {contenu}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${classes} active:bg-paper-sunk`}>
        {contenu}
      </button>
    );
  }
  return <div className={classes}>{contenu}</div>;
}

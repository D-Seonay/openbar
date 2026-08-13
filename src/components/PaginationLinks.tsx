import Link from "next/link";

interface PaginationLinksProps {
  currentPage: number;
  totalPages: number;
  /** Path to link back to, without the query string. */
  basePath: string;
  /**
   * Query parameter carrying the page. Distinct names let one screen paginate
   * two lists independently (the soirées page has a current list and a
   * history one).
   */
  param?: string;
  /** Anchor to scroll to, so paging does not jump back to the top of the page. */
  anchor?: string;
  /**
   * The query parameters currently on the page. Carried over so that paging one
   * list does not reset another on the same screen — the soirées page has two.
   */
  currentParams?: Record<string, string | undefined>;
}

/**
 * Pagination for server-rendered lists.
 *
 * Deliberately links rather than using the client-side `Pagination`: these
 * pages are server components, so a page change is a normal navigation. That
 * keeps the whole list off the client bundle, makes a page shareable and
 * bookmarkable, and lets the browser Back button work.
 */
export default function PaginationLinks({
  currentPage,
  totalPages,
  basePath,
  param = "page",
  anchor,
  currentParams,
}: PaginationLinksProps) {
  if (totalPages <= 1) return null;

  const hrefFor = (page: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(currentParams ?? {})) {
      if (value !== undefined && key !== param) query.set(key, value);
    }
    query.set(param, String(page));
    return `${basePath}?${query.toString()}${anchor ? `#${anchor}` : ""}`;
  };

  const buttonClass =
    "tap-target px-3 py-1.5 rounded-xl bg-ink-2 border border-white/[0.08] text-cream hover:bg-white/[0.04] hover:text-orange transition-colors text-xs font-bold tracking-wider uppercase flex items-center";
  const disabledClass =
    "tap-target px-3 py-1.5 rounded-xl bg-ink-2 border border-white/[0.08] text-cream opacity-50 cursor-not-allowed text-xs font-bold tracking-wider uppercase flex items-center";

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-white/[0.06]"
    >
      {currentPage === 1 ? (
        <span className={disabledClass} aria-disabled="true">
          Précédent
        </span>
      ) : (
        <Link href={hrefFor(currentPage - 1)} className={buttonClass} rel="prev">
          Précédent
        </Link>
      )}

      <span className="text-xs text-muted font-bold px-3 uppercase tracking-wider">
        Page <span className="text-cream">{currentPage}</span> sur{" "}
        <span className="text-cream">{totalPages}</span>
      </span>

      {currentPage === totalPages ? (
        <span className={disabledClass} aria-disabled="true">
          Suivant
        </span>
      ) : (
        <Link href={hrefFor(currentPage + 1)} className={buttonClass} rel="next">
          Suivant
        </Link>
      )}
    </nav>
  );
}

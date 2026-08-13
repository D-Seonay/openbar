/** Rows per page for the list screens. */
export const PAGE_SIZE = 20;

export interface Paginated<T> {
  items: T[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

/**
 * Slice a list for a `?page=` query parameter.
 *
 * The parameter is whatever was in the URL, so it is validated rather than
 * trusted: junk, zero, negatives and out-of-range values all resolve to a real
 * page instead of rendering an empty screen. `totalPages` is at least 1 so an
 * empty list still reports "page 1 sur 1" rather than "sur 0".
 */
export function paginate<T>(
  items: T[],
  rawPage: string | string[] | undefined,
  pageSize: number = PAGE_SIZE,
): Paginated<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  const parsed = Number(Array.isArray(rawPage) ? rawPage[0] : rawPage);
  const currentPage = Number.isFinite(parsed)
    ? Math.min(Math.max(Math.trunc(parsed), 1), totalPages)
    : 1;

  const start = (currentPage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    currentPage,
    totalPages,
    totalItems: items.length,
  };
}

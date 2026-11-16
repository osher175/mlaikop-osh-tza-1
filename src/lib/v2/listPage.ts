export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export function pageCount(total: number, size: number): number {
  if (total <= 0 || size <= 0) return 1;
  return Math.ceil(total / size);
}

/** Keeps a shortened result on a page that still has rows. */
export function clampPage(page: number, total: number, size: number): number {
  const pages = pageCount(total, size);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(Math.floor(page), pages);
}

export function pageSlice<T>(items: T[], page: number, size: number) {
  const current = clampPage(page, items.length, size);
  const start = items.length === 0 ? 0 : (current - 1) * size;
  const slice = items.slice(start, start + size);
  return {
    page: current,
    pages: pageCount(items.length, size),
    items: slice,
    from: items.length === 0 ? 0 : start + 1,
    to: start + slice.length,
    total: items.length,
  };
}

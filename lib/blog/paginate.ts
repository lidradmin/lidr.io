/** Page 1 shows 1 featured post + 9 cards; later pages show 9 cards. */
export const FIRST_PAGE_SIZE = 10;
export const PAGE_SIZE = 9;

export function pageCount(total: number): number {
  return total <= FIRST_PAGE_SIZE ? 1 : 1 + Math.ceil((total - FIRST_PAGE_SIZE) / PAGE_SIZE);
}

export function pageSlice<T>(items: T[], page: number): { featured?: T; items: T[] } {
  if (!Number.isInteger(page) || page < 1) return { items: [] };
  if (page === 1) return { featured: items[0], items: items.slice(1, FIRST_PAGE_SIZE) };
  const start = FIRST_PAGE_SIZE + (page - 2) * PAGE_SIZE;
  return { items: items.slice(start, start + PAGE_SIZE) };
}

import type { SectionId } from "./collapse";

/**
 * Sort order of the dated one-time lists, remembered per browser in a cookie
 * the server reads (so a list renders in the chosen order from the first byte).
 *
 * Newest first is the default; the cookie only lists the lists switched to
 * oldest first. Format matches the collapse cookie: ids joined by ".".
 */

export const SORT_COOKIE = "vlot_oldest_first";

export const SORTABLE_LISTS = [
  "eenmalige-kosten",
  "eenmalige-inkomsten",
] as const satisfies readonly SectionId[];

export type SortableList = (typeof SORTABLE_LISTS)[number];
export type ListSort = "newest" | "oldest";

export function isSortableList(value: unknown): value is SortableList {
  return SORTABLE_LISTS.some((l) => l === value);
}

/** Lists switched to oldest first; anything unknown in the cookie is ignored. */
export function parseOldestFirst(raw: string | undefined): Set<SortableList> {
  const out = new Set<SortableList>();
  for (const part of (raw ?? "").split(".")) {
    if (isSortableList(part)) out.add(part);
  }
  return out;
}

export function serializeOldestFirst(lists: Iterable<SortableList>): string {
  return [...lists].join(".");
}

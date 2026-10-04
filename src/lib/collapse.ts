/**
 * Which planner sections are collapsed, remembered in a cookie.
 *
 * A cookie rather than localStorage because the server can read it: a section
 * you collapsed renders collapsed from the first byte, instead of flashing
 * open and snapping shut after hydration (very visible on a 30-row list).
 *
 * Format: section ids joined by "." — every character is cookie-safe, so the
 * value never needs URL-encoding.
 */

export const COLLAPSE_COOKIE = "vlot_collapsed";

export const SECTION_IDS = [
  "eenmalige-kosten",
  "eenmalige-inkomsten",
  "terugkerende-kosten",
  "inkomen",
  "reservering",
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

const KNOWN = new Set<string>(SECTION_IDS);

/** Parse the cookie value, ignoring anything that isn't a known section id. */
export function parseCollapsed(raw: string | undefined): Set<SectionId> {
  const out = new Set<SectionId>();
  for (const part of (raw ?? "").split(".")) {
    if (KNOWN.has(part)) out.add(part as SectionId);
  }
  return out;
}

export function serializeCollapsed(ids: Iterable<SectionId>): string {
  return [...ids].join(".");
}

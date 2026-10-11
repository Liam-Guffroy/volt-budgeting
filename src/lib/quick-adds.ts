import type { Frequency } from "./budget";

/**
 * Quick-add buttons: one click fills an entry form's name (and, for recurring
 * costs, its frequency) so you only type the amount.
 *
 * Every category ships with built-ins; each account can add its own on top
 * (stored in the `quick_adds` table) and hide built-ins it never uses (stored
 * in `hidden_quick_adds`, so they can be brought back). Built-ins live here
 * rather than in the forms so the server can refuse a custom one that
 * duplicates them, and only accept hiding a name that really is a built-in.
 */

export const QUICK_ADD_KINDS = [
  "one_time_cost",
  "one_time_income",
  "recurring",
] as const;

export type QuickAddKind = (typeof QUICK_ADD_KINDS)[number];

export interface QuickAdd {
  name: string;
  /** Only for recurring costs. */
  frequency?: Frequency;
  /** Set for an account's own quick-adds (removed for good, not hidden). */
  customId?: number;
}

/** One category's buttons as an account sees them. */
export interface QuickAddSet {
  kind: QuickAddKind;
  /** Visible buttons: un-hidden built-ins, then the account's own. */
  items: QuickAdd[];
  /** Names of built-ins this account has hidden, in built-in order. */
  hidden: string[];
}

const names = (...list: string[]): QuickAdd[] => list.map((name) => ({ name }));

export const BUILT_IN_QUICK_ADDS: Record<QuickAddKind, QuickAdd[]> = {
  // The everyday one-offs: logged several times a month.
  one_time_cost: names(
    "Boodschappen",
    "Drank",
    "Tanken",
    "Uit eten",
    "Kleding",
    "Cadeau",
    "Apotheek",
    "Herstelling",
  ),
  // One-off income that commonly lands in a Belgian household's year.
  one_time_income: names(
    "Vakantiegeld",
    "Eindejaarspremie",
    "Bonus",
    "Terugbetaling",
    "Verkoop",
    "Cadeau",
  ),
  // Common household bills, each with a sensible default frequency that can
  // still be changed in the form before adding.
  recurring: [
    { name: "Huur / Lening", frequency: "monthly" },
    { name: "Elektriciteit", frequency: "monthly" },
    { name: "Water", frequency: "quarterly" },
    { name: "Gas / Verwarming", frequency: "monthly" },
    { name: "Internet / TV", frequency: "monthly" },
    { name: "Telefoon", frequency: "monthly" },
    { name: "Verzekering", frequency: "yearly" },
    { name: "Boodschappen", frequency: "weekly" },
  ],
};

/** Case-insensitive key used for duplicate checks ("boodschappen" = "Boodschappen"). */
export function quickAddKey(name: string): string {
  return name.trim().toLocaleLowerCase("nl-BE");
}

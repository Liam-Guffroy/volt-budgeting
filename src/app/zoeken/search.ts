import "server-only";
import { and, desc, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { oneTimeExpenses, oneTimeIncomes } from "@/db/schema";

/** Which one-time entries to look in. */
export const ENTRY_KINDS = ["alle", "kosten", "inkomsten"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export function toEntryKind(value: unknown): EntryKind {
  return ENTRY_KINDS.find((k) => k === value) ?? "alle";
}

export interface FoundEntry {
  id: number;
  kind: "kosten" | "inkomsten";
  /** "YYYY-MM-DD" */
  date: string;
  name: string;
  amount: number;
}

/**
 * This account's one-time entries across all months, newest first, optionally
 * narrowed to names containing `query` (case-insensitive). Shared by the search
 * page and the CSV export so both always agree.
 */
export async function searchEntries(
  userId: number,
  query: string,
  kind: EntryKind,
): Promise<FoundEntry[]> {
  // % and _ are wildcards in LIKE; escape them so they match literally.
  const q = query.trim();
  const pattern = q ? `%${q.replace(/[\\%_]/g, "\\$&")}%` : null;

  const find = async (
    table: typeof oneTimeExpenses | typeof oneTimeIncomes,
    as: FoundEntry["kind"],
  ): Promise<FoundEntry[]> => {
    const rows = await db
      .select({
        id: table.id,
        date: table.entryDate,
        name: table.name,
        amount: table.amount,
      })
      .from(table)
      .where(
        and(eq(table.userId, userId), pattern ? ilike(table.name, pattern) : undefined),
      )
      .orderBy(desc(table.entryDate), desc(table.id));
    return rows.map((r) => ({ ...r, kind: as, amount: Number(r.amount) }));
  };

  const [costs, incomes] = await Promise.all([
    kind === "inkomsten" ? [] : find(oneTimeExpenses, "kosten"),
    kind === "kosten" ? [] : find(oneTimeIncomes, "inkomsten"),
  ]);

  return [...costs, ...incomes].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id - a.id,
  );
}

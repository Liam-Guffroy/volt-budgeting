import "server-only";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  expenses,
  monthSnapshots,
  settings,
  users,
  type SnapshotExpense,
} from "@/db/schema";
import type { BudgetExpense } from "./budget";
import { currentMonth, shiftMonth, type MonthKey } from "./month";

/**
 * History for income and recurring costs.
 *
 * Those two have a single current value, so without this a raise or a rent
 * increase would silently rewrite every past month. Instead, each finished
 * month is frozen: its income and recurring costs are copied into
 * `month_snapshots` the first time the app is used after the month ends, and
 * from then on that month is calculated from the copy.
 *
 * Freezing is lazy — `ensureSnapshots` runs at the top of each page and before
 * anything that changes income or recurring costs, so the copy is always taken
 * before a change can land. A month frozen with the wrong amounts (say the
 * raise was entered a month late) can be re-frozen from the current ones.
 */

/** The account's first month, in Belgian time (created_at holds UTC clock time). */
async function firstMonthOf(userId: number): Promise<MonthKey | null> {
  const [row] = await db
    .select({
      month: sql<string>`to_char((${users.createdAt} at time zone current_setting('TimeZone')) at time zone 'Europe/Brussels', 'YYYY-MM')`,
    })
    .from(users)
    .where(eq(users.id, userId));
  return row?.month ?? null;
}

/** The current income and recurring costs, in the shape a snapshot stores. */
async function currentBasis(
  userId: number,
): Promise<{ income: string; expenses: SnapshotExpense[] }> {
  const [settingRow, expenseRows] = await Promise.all([
    db.select().from(settings).where(eq(settings.userId, userId)),
    db
      .select()
      .from(expenses)
      .where(eq(expenses.userId, userId))
      .orderBy(asc(expenses.position), asc(expenses.id)),
  ]);
  return {
    income: settingRow[0]?.monthlyIncome ?? "0",
    expenses: expenseRows.map((e) => ({
      name: e.name,
      amount: Number(e.amount),
      frequency: e.frequency,
    })),
  };
}

/**
 * Freeze every finished month that isn't frozen yet, from the account's first
 * month up to last month, with the current income and recurring costs.
 * Cheap when there's nothing to do (two small queries).
 */
export async function ensureSnapshots(userId: number): Promise<void> {
  const lastMonth = shiftMonth(currentMonth(), -1);
  const first = await firstMonthOf(userId);
  if (!first || first > lastMonth) return; // nothing has finished yet

  const existing = await db
    .select({ month: monthSnapshots.month })
    .from(monthSnapshots)
    .where(eq(monthSnapshots.userId, userId));
  const have = new Set(existing.map((s) => s.month));

  const missing: MonthKey[] = [];
  for (let m = first; m <= lastMonth; m = shiftMonth(m, 1)) {
    if (!have.has(m)) missing.push(m);
  }
  if (missing.length === 0) return;

  const basis = await currentBasis(userId);
  await db
    .insert(monthSnapshots)
    .values(missing.map((month) => ({ userId, month, ...basis })))
    // Two tabs loading at once must not fight over the same month.
    .onConflictDoNothing();
}

/** Re-freeze one finished month from the current income and recurring costs. */
export async function refreeze(userId: number, month: MonthKey): Promise<void> {
  if (month >= currentMonth()) return; // only finished months are frozen
  const basis = await currentBasis(userId);
  await db
    .insert(monthSnapshots)
    .values({ userId, month, ...basis })
    .onConflictDoUpdate({
      target: [monthSnapshots.userId, monthSnapshots.month],
      set: basis,
    });
}

export interface MonthBasis {
  income: number;
  expenses: BudgetExpense[];
  /** True when these come from a frozen month rather than the current values. */
  frozen: boolean;
}

/**
 * What a month is calculated from: its frozen copy when it has one, otherwise
 * the current values passed in (the current month, future months, and months
 * from before the account existed).
 */
export async function monthBasis(
  userId: number,
  month: MonthKey,
  current: { income: number; expenses: BudgetExpense[] },
): Promise<MonthBasis> {
  if (month < currentMonth()) {
    const [snapshot] = await db
      .select()
      .from(monthSnapshots)
      .where(and(eq(monthSnapshots.userId, userId), eq(monthSnapshots.month, month)));
    if (snapshot) {
      return {
        income: Number(snapshot.income),
        // Frozen costs have no row of their own any more; index ids keep the
        // budget math's shape.
        expenses: snapshot.expenses.map((e, id) => ({ id, ...e })),
        frozen: true,
      };
    }
  }
  return { ...current, frozen: false };
}

/**
 * `monthBasis` for a run of months in one query — the year overview needs
 * twelve at once. `months` must be sorted, oldest first.
 */
export async function monthBases(
  userId: number,
  months: MonthKey[],
  current: { income: number; expenses: BudgetExpense[] },
): Promise<Map<MonthKey, MonthBasis>> {
  const bases = new Map<MonthKey, MonthBasis>();
  if (months.length === 0) return bases;

  const snapshots = await db
    .select()
    .from(monthSnapshots)
    .where(
      and(
        eq(monthSnapshots.userId, userId),
        gte(monthSnapshots.month, months[0]),
        lte(monthSnapshots.month, months[months.length - 1]),
      ),
    );
  const frozen = new Map(snapshots.map((s) => [s.month, s]));
  const now = currentMonth();

  for (const month of months) {
    const snapshot = month < now ? frozen.get(month) : undefined;
    bases.set(
      month,
      snapshot
        ? {
            income: Number(snapshot.income),
            expenses: snapshot.expenses.map((e, id) => ({ id, ...e })),
            frozen: true,
          }
        : { ...current, frozen: false },
    );
  }
  return bases;
}

/**
 * Statistics math — pure, no I/O, like budget.ts.
 *
 * The statistics page looks at one month at a time and compares it with the
 * month before. Monthly income and recurring costs have no history, so every
 * month uses their current values; one-time entries are per day.
 */

import { monthlyEquivalent, type BudgetExpense } from "./budget";
import { shiftMonth, type DayKey, type MonthKey } from "./month";
import { quickAddKey } from "./quick-adds";

/** A one-time entry as the statistics care about it. */
export interface DatedEntry {
  date: DayKey;
  name: string;
  amount: number;
}

export function totalOf(entries: { amount: number }[]): number {
  return entries.reduce((t, e) => t + e.amount, 0);
}

export function inMonth(entries: DatedEntry[], month: MonthKey): DatedEntry[] {
  return entries.filter((e) => e.date.slice(0, 7) === month);
}

/** Day of the month (1-31) of a day key. */
export function dayOf(day: DayKey): number {
  return Number(day.slice(8, 10));
}

/**
 * Running total per day of a month: index 0 is day 1. Days after `upTo` are
 * null — the month hasn't got there yet, which is different from "nothing
 * spent".
 */
export function cumulativeByDay(
  entries: DatedEntry[],
  days: number,
  upTo: number = days,
): (number | null)[] {
  const perDay = new Array<number>(days).fill(0);
  for (const e of entries) {
    const d = dayOf(e.date);
    if (d >= 1 && d <= days) perDay[d - 1] += e.amount;
  }
  let running = 0;
  return perDay.map((amount, i) => {
    running += amount;
    // Cents, so float drift never shows up as € 12,300000001.
    return i < upTo ? Math.round(running * 100) / 100 : null;
  });
}

/** The `n` largest single entries, biggest first. */
export function largest(entries: DatedEntry[], n: number): DatedEntry[] {
  return [...entries].sort((a, b) => b.amount - a.amount).slice(0, n);
}

/**
 * The months for the trend, oldest first: up to `count` months ending at
 * `month`, but never earlier than `firstActive` (account creation or the
 * earliest entry) — no bars for months before the app was in use.
 */
export function trendMonths(
  month: MonthKey,
  firstActive: MonthKey,
  count = 6,
): MonthKey[] {
  const earliest = shiftMonth(month, -(count - 1));
  let m = firstActive > earliest ? firstActive : earliest;
  if (m > month) m = month;
  const months: MonthKey[] = [];
  while (m <= month) {
    months.push(m);
    m = shiftMonth(m, 1);
  }
  return months;
}

export interface CategoryStat {
  label: string;
  total: number;
  count: number;
  /** Fraction of the grand total, 0..1. */
  share: number;
  /** The folded tail ("Overige"). */
  other: boolean;
  /**
   * The same category's total in the comparison entries (the month before):
   * 0 when it didn't occur there, null when there's nothing to compare with.
   */
  previous: number | null;
}

/**
 * Group entries by name (case-insensitive, like quick-adds), largest first.
 * Past `limit` groups the tail folds into one "Overige" row rather than
 * growing the list.
 */
export function topCategories(
  entries: { name: string; amount: number }[],
  limit = 6,
  compareWith?: { name: string; amount: number }[],
): CategoryStat[] {
  const groups = new Map<
    string,
    { key: string; total: number; count: number; spellings: Map<string, number> }
  >();
  for (const e of entries) {
    const key = quickAddKey(e.name);
    const g = groups.get(key) ?? { key, total: 0, count: 0, spellings: new Map() };
    g.total += e.amount;
    g.count += 1;
    const spelling = e.name.trim();
    g.spellings.set(spelling, (g.spellings.get(spelling) ?? 0) + 1);
    groups.set(key, g);
  }

  const before = new Map<string, number>();
  for (const e of compareWith ?? []) {
    const key = quickAddKey(e.name);
    before.set(key, (before.get(key) ?? 0) + e.amount);
  }
  const previousOf = (keys: string[]) =>
    compareWith ? keys.reduce((t, k) => t + (before.get(k) ?? 0), 0) : null;

  const grand = totalOf(entries);
  const share = (n: number) => (grand > 0 ? n / grand : 0);

  const ranked = [...groups.values()]
    .map((g) => ({
      key: g.key,
      // Show the spelling used most often for this group.
      label: [...g.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0],
      total: g.total,
      count: g.count,
    }))
    .sort((a, b) => b.total - a.total);

  // Folding a single leftover row into "Overige (1)" hides it for nothing.
  const fold = ranked.length > limit + 1;
  const head = fold ? ranked.slice(0, limit) : ranked;
  const tail = fold ? ranked.slice(limit) : [];

  const rows: CategoryStat[] = head.map((r) => ({
    label: r.label,
    total: r.total,
    count: r.count,
    share: share(r.total),
    other: false,
    previous: previousOf([r.key]),
  }));
  if (tail.length > 0) {
    const total = tail.reduce((t, r) => t + r.total, 0);
    rows.push({
      label: `Overige (${tail.length})`,
      total,
      count: tail.reduce((t, r) => t + r.count, 0),
      share: share(total),
      other: true,
      previous: previousOf(tail.map((r) => r.key)),
    });
  }
  return rows;
}

/** Recurring costs as monthly equivalents, grouped and ranked the same way. */
export function recurringBreakdown(expenses: BudgetExpense[], limit = 6): CategoryStat[] {
  return topCategories(
    expenses.map((e) => ({ name: e.name, amount: monthlyEquivalent(e) })),
    limit,
  );
}

/**
 * Clean axis bounds and ticks covering [min, max], always including 0, with
 * steps of 1/2/2.5/5 × 10ⁿ.
 */
export function niceScale(
  values: number[],
  targetTicks = 4,
): { lo: number; hi: number; ticks: number[] } {
  let min = Math.min(0, ...values);
  let max = Math.max(0, ...values);
  if (min === max) max = min + 100;

  const raw = (max - min) / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const n = raw / magnitude;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * magnitude;

  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  // Rounding guards against float drift (0.1 + 0.2 style) in the tick values.
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Math.round(t * 100) / 100);
  return { lo, hi, ticks };
}

/**
 * Statistics math — pure, no I/O, like budget.ts.
 *
 * Past months use the *current* monthly income and recurring costs (there is
 * no history of those), plus each month's own one-time costs and income. The
 * page says so; keep it that way if this changes.
 */

import { monthlyEquivalent, summarize, type BudgetExpense } from "./budget";
import { shiftMonth, type MonthKey } from "./month";
import { quickAddKey } from "./quick-adds";

export const PERIODS = [
  { key: "6", label: "6 maanden" },
  { key: "12", label: "12 maanden" },
  { key: "jaar", label: "Dit jaar" },
] as const;

export type Period = (typeof PERIODS)[number]["key"];

export function toPeriod(value: unknown): Period {
  return PERIODS.some((p) => p.key === value) ? (value as Period) : "12";
}

/** First month of a period ending at `current`, before any activity clamp. */
export function periodStart(period: Period, current: MonthKey): MonthKey {
  return period === "jaar"
    ? `${current.slice(0, 4)}-01`
    : shiftMonth(current, -(Number(period) - 1));
}

/**
 * The months to show, oldest first: the period, but never earlier than
 * `firstActive` (account creation or the earliest entry) — otherwise months
 * before you used the app would show a made-up "income minus fixed costs".
 */
export function periodMonths(
  period: Period,
  current: MonthKey,
  firstActive: MonthKey,
): MonthKey[] {
  const start = periodStart(period, current);
  let month = firstActive > start ? firstActive : start;
  if (month > current) month = current;
  const months: MonthKey[] = [];
  while (month <= current) {
    months.push(month);
    month = shiftMonth(month, 1);
  }
  return months;
}

export interface MonthEntry {
  month: MonthKey;
  name: string;
  amount: number;
}

export interface MonthStat {
  month: MonthKey;
  oneTimeCosts: number;
  oneTimeIncome: number;
  /** income + one-time income − regular − reserve − one-time costs */
  remaining: number;
}

export function monthSeries(
  months: MonthKey[],
  income: number,
  expenses: BudgetExpense[],
  costs: MonthEntry[],
  incomes: MonthEntry[],
): MonthStat[] {
  // income − regular − reserve: the same every month, so compute it once.
  const base = summarize(income, expenses).remaining;
  const sumFor = (entries: MonthEntry[], month: MonthKey) =>
    entries.filter((e) => e.month === month).reduce((t, e) => t + e.amount, 0);

  return months.map((month) => {
    const oneTimeCosts = sumFor(costs, month);
    const oneTimeIncome = sumFor(incomes, month);
    return {
      month,
      oneTimeCosts,
      oneTimeIncome,
      remaining: base + oneTimeIncome - oneTimeCosts,
    };
  });
}

export interface CategoryStat {
  label: string;
  total: number;
  count: number;
  /** Fraction of the grand total, 0..1. */
  share: number;
  /** The folded tail ("Overige"). */
  other: boolean;
}

/**
 * Group entries by name (case-insensitive, like quick-adds), largest first.
 * Past `limit` groups the tail folds into one "Overige" row rather than
 * growing the list.
 */
export function topCategories(
  entries: { name: string; amount: number }[],
  limit = 7,
): CategoryStat[] {
  const groups = new Map<
    string,
    { total: number; count: number; spellings: Map<string, number> }
  >();
  for (const e of entries) {
    const key = quickAddKey(e.name);
    const g = groups.get(key) ?? { total: 0, count: 0, spellings: new Map() };
    g.total += e.amount;
    g.count += 1;
    const spelling = e.name.trim();
    g.spellings.set(spelling, (g.spellings.get(spelling) ?? 0) + 1);
    groups.set(key, g);
  }

  const grand = entries.reduce((t, e) => t + e.amount, 0);
  const share = (n: number) => (grand > 0 ? n / grand : 0);

  const ranked = [...groups.values()]
    .map((g) => ({
      // Show the spelling used most often for this group.
      label: [...g.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0],
      total: g.total,
      count: g.count,
    }))
    .sort((a, b) => b.total - a.total);

  // Folding a single leftover row into "Overige (1)" hides it for nothing.
  const head = ranked.length > limit + 1 ? ranked.slice(0, limit) : ranked;
  const tail = ranked.length > limit + 1 ? ranked.slice(limit) : [];

  const rows: CategoryStat[] = head.map((r) => ({
    ...r,
    share: share(r.total),
    other: false,
  }));
  if (tail.length > 0) {
    const total = tail.reduce((t, r) => t + r.total, 0);
    rows.push({
      label: `Overige (${tail.length})`,
      total,
      count: tail.reduce((t, r) => t + r.count, 0),
      share: share(total),
      other: true,
    });
  }
  return rows;
}

/** Recurring costs as monthly equivalents, grouped and ranked the same way. */
export function recurringBreakdown(expenses: BudgetExpense[], limit = 7): CategoryStat[] {
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

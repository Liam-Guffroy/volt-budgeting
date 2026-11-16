/**
 * Year overview math — pure, no I/O, like budget.ts and stats.ts.
 *
 * A year is the months the account was actually in use: from its first active
 * month up to the current one. Months still to come are left out rather than
 * projected, so the totals only ever describe money that has really moved.
 */

import { summarize, type BudgetExpense } from "./budget";
import type { MonthKey } from "./month";
import { inMonth, totalOf, type DatedEntry } from "./stats";

/** Coerce untrusted input (a URL param) to a year, falling back to `fallback`. */
export function toYear(value: unknown, fallback: number): number {
  return typeof value === "string" && /^\d{4}$/.test(value) ? Number(value) : fallback;
}

/** All twelve month keys of a year, January first. */
export function monthsOfYear(year: number): MonthKey[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}

/**
 * The months of `year` that count: not before `firstActive` (account creation
 * or the earliest entry) and not after `now` (the current month).
 */
export function countedMonths(year: number, firstActive: MonthKey, now: MonthKey): MonthKey[] {
  return monthsOfYear(year).filter((m) => m >= firstActive && m <= now);
}

/** One month of the year, reduced to the figures the overview shows. */
export interface YearMonth {
  month: MonthKey;
  /** Monthly income plus that month's one-time income. */
  income: number;
  /** Bills paid roughly every month. */
  regular: number;
  /** Set-asides for less frequent bills. */
  reserve: number;
  /** One-time costs. */
  oneTime: number;
  /** regular + reserve + oneTime. */
  costs: number;
  /** income − costs (can be negative). */
  remaining: number;
  /** Still running, so its figures will keep moving. */
  inProgress: boolean;
}

export function summarizeMonth(
  month: MonthKey,
  basis: { income: number; expenses: BudgetExpense[] },
  costs: DatedEntry[],
  incomes: DatedEntry[],
  now: MonthKey,
): YearMonth {
  const asEntries = (entries: DatedEntry[]) =>
    inMonth(entries, month).map((e, id) => ({ id, name: e.name, amount: e.amount }));
  const s = summarize(basis.income, basis.expenses, asEntries(costs), asEntries(incomes));
  return {
    month,
    income: s.income + s.oneTimeIncomeTotal,
    regular: s.regularTotal,
    reserve: s.reserveTotal,
    oneTime: s.oneTimeTotal,
    costs: s.regularTotal + s.reserveTotal + s.oneTimeTotal,
    remaining: s.remaining,
    inProgress: month === now,
  };
}

export interface YearTotals {
  income: number;
  regular: number;
  reserve: number;
  oneTime: number;
  costs: number;
  remaining: number;
  /** remaining ÷ number of months; 0 for an empty year. */
  averageRemaining: number;
  /**
   * The finished months with the most and the least left over. Null until two
   * months have finished — one month is both, which says nothing.
   */
  best: YearMonth | null;
  worst: YearMonth | null;
}

export function yearTotals(months: YearMonth[]): YearTotals {
  const sum = (pick: (m: YearMonth) => number) => totalOf(months.map((m) => ({ amount: pick(m) })));
  const remaining = sum((m) => m.remaining);

  // A month in progress still has spending to come, so it can't be ranked.
  const finished = months.filter((m) => !m.inProgress);
  const ranked = [...finished].sort((a, b) => b.remaining - a.remaining);
  const comparable = ranked.length >= 2;

  return {
    income: sum((m) => m.income),
    regular: sum((m) => m.regular),
    reserve: sum((m) => m.reserve),
    oneTime: sum((m) => m.oneTime),
    costs: sum((m) => m.costs),
    remaining,
    averageRemaining: months.length > 0 ? remaining / months.length : 0,
    best: comparable ? ranked[0] : null,
    worst: comparable ? ranked[ranked.length - 1] : null,
  };
}

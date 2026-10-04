/**
 * Budget math — pure, server-safe, no I/O.
 *
 * Every expense is normalized to a *monthly equivalent*:
 *   - "regular" bills (weekly / biweekly / monthly) hit roughly every month, so
 *     their monthly equivalent is what you actually pay.
 *   - "reserve" bills (anything less frequent than monthly) are spread out: a
 *     yearly €1.200 bill becomes a €100/month set-aside so the money is there
 *     when it lands.
 *
 * One-time costs and one-time income are not normalized at all — they hit the
 * single month they're filed under, and only that month's figures.
 *
 * remaining = income + oneTimeIncomeTotal − regularTotal − reserveTotal − oneTimeTotal
 */

export type FrequencyGroup = "regular" | "reserve";

interface FrequencyDef {
  /** Human label (nl-BE). */
  label: string;
  /** Multiply an amount by this to get its monthly equivalent. */
  perMonth: number;
  group: FrequencyGroup;
}

export const FREQUENCIES = {
  weekly: { label: "Wekelijks", perMonth: 52 / 12, group: "regular" },
  biweekly: { label: "Tweewekelijks", perMonth: 26 / 12, group: "regular" },
  monthly: { label: "Maandelijks", perMonth: 1, group: "regular" },
  every_2_months: { label: "Om de 2 maanden", perMonth: 1 / 2, group: "reserve" },
  quarterly: { label: "Per kwartaal", perMonth: 1 / 3, group: "reserve" },
  every_4_months: { label: "Om de 4 maanden", perMonth: 1 / 4, group: "reserve" },
  every_6_months: { label: "Om de 6 maanden", perMonth: 1 / 6, group: "reserve" },
  yearly: { label: "Jaarlijks", perMonth: 1 / 12, group: "reserve" },
} as const satisfies Record<string, FrequencyDef>;

export type Frequency = keyof typeof FREQUENCIES;

/** Non-empty tuple of keys — handy for Zod's z.enum and Drizzle's pgEnum. */
export const FREQUENCY_KEYS = Object.keys(FREQUENCIES) as [
  Frequency,
  ...Frequency[],
];

export function frequencyLabel(f: Frequency): string {
  return FREQUENCIES[f].label;
}

/** A single expense as the math cares about it. */
export interface BudgetExpense {
  id: number;
  name: string;
  amount: number;
  frequency: Frequency;
}

/** The monthly-equivalent cost of one expense. */
export function monthlyEquivalent(expense: {
  amount: number;
  frequency: Frequency;
}): number {
  return expense.amount * FREQUENCIES[expense.frequency].perMonth;
}

/** One expense, normalized, ready to render. */
export interface NormalizedExpense extends BudgetExpense {
  group: FrequencyGroup;
  /** Monthly equivalent (what to budget per month for this bill). */
  monthly: number;
}

/** A one-off cost or one-off income filed against a single month. */
export interface OneTimeEntry {
  id: number;
  name: string;
  amount: number;
}

export interface BudgetSummary {
  income: number;
  /** Sum of monthly equivalents for weekly/biweekly/monthly bills. */
  regularTotal: number;
  /** Sum of monthly set-asides for less-than-monthly bills. */
  reserveTotal: number;
  /** Sum of the one-off costs in the month being viewed. */
  oneTimeTotal: number;
  /** The one-off costs themselves, in the order passed in. */
  oneTime: OneTimeEntry[];
  /** Sum of the one-off income in the month being viewed. */
  oneTimeIncomeTotal: number;
  /** The one-off income entries themselves, in the order passed in. */
  oneTimeIncome: OneTimeEntry[];
  /**
   * income + oneTimeIncomeTotal − regularTotal − reserveTotal − oneTimeTotal
   * (can be negative).
   */
  remaining: number;
  /** Per-bill breakdown of the regular bills. */
  regular: NormalizedExpense[];
  /** Per-bill breakdown of the reserve (set-aside) bills. */
  reserve: NormalizedExpense[];
  /** All expenses, normalized, in the order they were passed in. */
  all: NormalizedExpense[];
}

/**
 * Crunch income + expenses into the four headline figures plus breakdowns.
 * Pure: same input → same output, no rounding applied here (format at the edge).
 */
export function summarize(
  income: number,
  expenses: BudgetExpense[],
  oneTime: OneTimeEntry[] = [],
  oneTimeIncome: OneTimeEntry[] = [],
): BudgetSummary {
  const normalized: NormalizedExpense[] = expenses.map((e) => ({
    ...e,
    group: FREQUENCIES[e.frequency].group,
    monthly: monthlyEquivalent(e),
  }));

  const regular = normalized.filter((e) => e.group === "regular");
  const reserve = normalized.filter((e) => e.group === "reserve");

  const sum = (items: NormalizedExpense[]) =>
    items.reduce((total, e) => total + e.monthly, 0);

  const regularTotal = sum(regular);
  const reserveTotal = sum(reserve);
  const sumEntries = (items: OneTimeEntry[]) =>
    items.reduce((total, e) => total + e.amount, 0);

  const oneTimeTotal = sumEntries(oneTime);
  const oneTimeIncomeTotal = sumEntries(oneTimeIncome);

  return {
    income,
    regularTotal,
    reserveTotal,
    oneTimeTotal,
    oneTime,
    oneTimeIncomeTotal,
    oneTimeIncome,
    remaining:
      income + oneTimeIncomeTotal - regularTotal - reserveTotal - oneTimeTotal,
    regular,
    reserve,
    all: normalized,
  };
}

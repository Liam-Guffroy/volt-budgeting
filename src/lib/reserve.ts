import { FREQUENCIES, type Frequency } from "./budget";
import type { DayKey } from "./month";

/**
 * Due dates for set-asides — pure math.
 *
 * A non-monthly bill of amount A that comes every P months is saved for at
 * A / P per month. Given when it's next due, we know how much should be set
 * aside by now: with n monthly set-asides still to come before the due month,
 * A × (P − n) / P.
 */

/** How many months one cycle of a frequency spans (yearly = 12). */
export function periodMonths(frequency: Frequency): number {
  return Math.round(1 / FREQUENCIES[frequency].perMonth);
}

/** Add whole months to a day, clamping to the month's last day (31 Jan + 1 = 28 Feb). */
export function addMonths(day: DayKey, months: number): DayKey {
  const [y, m, d] = day.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = total - year * 12 + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(Math.min(d, lastDay))}`;
}

/**
 * The next time a bill falls due on or after `today`. A stored due date in the
 * past means that one was paid; the following ones come every `period` months.
 * Each candidate is computed from the original date, so a clamped day (31 →
 * 28) doesn't stick for later cycles.
 */
export function upcomingDue(due: DayKey, period: number, today: DayKey): DayKey {
  let next = due;
  for (let k = 1; next < today; k++) next = addMonths(due, k * period);
  return next;
}

/** Whole calendar months from `from`'s month to `to`'s month (0 = same month). */
export function monthsBetween(from: DayKey, to: DayKey): number {
  const index = (day: DayKey) => Number(day.slice(0, 4)) * 12 + Number(day.slice(5, 7));
  return index(to) - index(from);
}

export interface ReserveStatus {
  /** The upcoming due date. */
  due: DayKey;
  /** Calendar months until the due month; 0 = due this month. */
  monthsLeft: number;
  /** What should be set aside for this bill by now. */
  shouldHave: number;
}

/** Null when the bill has no due date — there's nothing to measure against. */
export function reserveStatus(
  expense: { amount: number; frequency: Frequency; nextDue?: DayKey | null },
  today: DayKey,
): ReserveStatus | null {
  if (!expense.nextDue) return null;
  const period = periodMonths(expense.frequency);
  const due = upcomingDue(expense.nextDue, period, today);
  const monthsLeft = monthsBetween(today, due);
  const saved = (expense.amount * (period - Math.min(monthsLeft, period))) / period;
  return { due, monthsLeft, shouldHave: Math.round(saved * 100) / 100 };
}

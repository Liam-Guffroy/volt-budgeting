/**
 * Month keys ("YYYY-MM") and calendar days ("YYYY-MM-DD") — used to file
 * one-time entries and to drive the ?month= URL param.
 *
 * Deliberately plain strings rather than Dates: the arithmetic here is integer
 * math, so nothing can drift across a timezone boundary into the wrong day or
 * month. "Today" is always Belgian today, wherever the server runs.
 */

export type MonthKey = string;
/** A calendar day, "YYYY-MM-DD". */
export type DayKey = string;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isMonthKey(value: unknown): value is MonthKey {
  return typeof value === "string" && MONTH_RE.test(value);
}

/** True for a well-formed day that exists on the calendar (no 30 February). */
export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== "string" || !DAY_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

const brusselsDay = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Brussels",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today in Belgium, as "YYYY-MM-DD". */
export function todayKey(now: Date = new Date()): DayKey {
  const parts = Object.fromEntries(
    brusselsDay.formatToParts(now).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function currentMonth(now: Date = new Date()): MonthKey {
  return todayKey(now).slice(0, 7);
}

/** First and last day of a month, e.g. 2026-02 -> 2026-02-01 .. 2026-02-28. */
export function monthBounds(month: MonthKey): { first: DayKey; last: DayKey } {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { first: `${month}-01`, last: `${month}-${String(lastDay).padStart(2, "0")}` };
}

/**
 * The default date for a new entry in `month`: today when today is in that
 * month, otherwise the nearest day of it (last day of a past month, first day
 * of a future one). Day keys compare correctly as plain strings.
 */
export function defaultDayFor(month: MonthKey, today: DayKey = todayKey()): DayKey {
  const { first, last } = monthBounds(month);
  if (today < first) return first;
  if (today > last) return last;
  return today;
}

/** Coerce untrusted input (a URL param) to a valid month, falling back to now. */
export function toMonth(value: unknown): MonthKey {
  return isMonthKey(value) ? value : currentMonth();
}

/** Shift by whole months, rolling the year over as needed. */
export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [year, mon] = month.split("-").map(Number);
  const total = year * 12 + (mon - 1) + delta;
  const y = Math.floor(total / 12);
  const m = total - y * 12 + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

// timeZone: "UTC" pairs with the Date.UTC below — without it a negative local
// offset would render the previous month.
const monthFormat = new Intl.DateTimeFormat("nl-BE", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-07" -> "Juli 2026" */
export function formatMonth(month: MonthKey): string {
  const [year, mon] = month.split("-").map(Number);
  const label = monthFormat.format(new Date(Date.UTC(year, mon - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

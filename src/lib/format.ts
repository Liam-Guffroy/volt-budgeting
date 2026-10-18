import { todayKey, type DayKey } from "./month";

// Belgian euro formatting — "€ 1.234,56".
const eur = new Intl.NumberFormat("nl-BE", {
  style: "currency",
  currency: "EUR",
});

export function formatEUR(amount: number): string {
  return eur.format(amount);
}

// Short days — "19 okt", or "19 okt 2025" outside the current year. A day key
// is a calendar day, not an instant, so it's rendered at UTC midnight with a
// UTC formatter: nothing can shift it to a neighbouring day.
const shortDay = new Intl.DateTimeFormat("nl-BE", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const shortDayWithYear = new Intl.DateTimeFormat("nl-BE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDay(day: DayKey, today: DayKey = todayKey()): string {
  const date = new Date(`${day}T00:00:00Z`);
  return day.slice(0, 4) === today.slice(0, 4)
    ? shortDay.format(date)
    : shortDayWithYear.format(date);
}

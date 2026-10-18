// Belgian euro formatting — "€ 1.234,56".
const eur = new Intl.NumberFormat("nl-BE", {
  style: "currency",
  currency: "EUR",
});

export function formatEUR(amount: number): string {
  return eur.format(amount);
}

// Short dates — "19 okt", or "19 okt 2025" outside the current year. Pinned to
// Belgian time so the day is right wherever the server runs; the caller must
// pass a real instant (see the created_at conversion in page.tsx).
const TIME_ZONE = "Europe/Brussels";
const shortDate = new Intl.DateTimeFormat("nl-BE", {
  day: "numeric",
  month: "short",
  timeZone: TIME_ZONE,
});
const shortDateWithYear = new Intl.DateTimeFormat("nl-BE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: TIME_ZONE,
});
const yearOnly = new Intl.DateTimeFormat("nl-BE", {
  year: "numeric",
  timeZone: TIME_ZONE,
});

export function formatShortDate(date: Date, now: Date = new Date()): string {
  return yearOnly.format(date) === yearOnly.format(now)
    ? shortDate.format(date)
    : shortDateWithYear.format(date);
}

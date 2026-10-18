import { cn } from "@/lib/utils";
import { niceScale } from "@/lib/stats";

export interface Column {
  /** Stable key, e.g. "2026-10". */
  key: string;
  /** Short axis label, e.g. "okt". */
  label: string;
  /** Second axis line, e.g. the year under January; optional. */
  sublabel?: string;
  /** Full label for tooltip and table, e.g. "Oktober 2026". */
  fullLabel: string;
  value: number;
}

const tick = new Intl.NumberFormat("nl-BE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/**
 * Vertical columns from one baseline, server-rendered.
 *
 * - "single": one series, every column in the up colour (no legend — the card
 *   title names the series).
 * - "diverging": positive columns rise from zero in the up colour, negative
 *   ones drop below it in the down colour; direction carries the sign, not
 *   colour alone.
 *
 * Marks follow the dataviz spec: ≤24px columns, 4px rounded data end and a
 * square baseline end, solid hairline gridlines. Each month's whole slot is
 * the hover/focus target and shows a tooltip (value first); every value is also
 * in the table view, so the tooltip never gates anything.
 */
export function ColumnChart({
  columns,
  variant,
  format,
  caption,
}: {
  columns: Column[];
  variant: "single" | "diverging";
  format: (n: number) => string;
  caption: string;
}) {
  const { lo, hi, ticks } = niceScale(columns.map((c) => c.value));
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const zero = pct(0);
  const last = columns.length - 1;

  return (
    <figure className="space-y-3">
      <div className="flex">
        {/* Y axis labels */}
        <div className="relative h-48 w-16 shrink-0" aria-hidden>
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-2 translate-y-1/2 text-xs tabular-nums text-muted-foreground"
              style={{ bottom: `${pct(t)}%` }}
            >
              {tick.format(t)}
            </span>
          ))}
        </div>

        {/* Plot */}
        <div className="relative h-48 flex-1">
          {ticks.map((t) => (
            <div
              key={t}
              aria-hidden
              className={cn(
                "absolute inset-x-0 border-t",
                t === 0 ? "border-muted-foreground/50" : "border-border",
              )}
              style={{ bottom: `${pct(t)}%` }}
            />
          ))}

          <div className="absolute inset-0 flex">
            {columns.map((c, i) => {
              const up = c.value >= 0;
              const height = (Math.abs(c.value) / (hi - lo)) * 100;
              // Keep edge tooltips inside the card.
              const align =
                i < 2 ? "left-0" : i > last - 2 ? "right-0" : "left-1/2 -translate-x-1/2";

              return (
                <div
                  key={c.key}
                  tabIndex={0}
                  aria-label={`${c.fullLabel}: ${format(c.value)}`}
                  className="group relative flex-1 rounded-md outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {height > 0 ? (
                    <div
                      aria-hidden
                      className={cn(
                        "absolute left-1/2 w-[min(24px,62%)] -translate-x-1/2 transition-opacity group-hover:opacity-80",
                        up ? "rounded-t-[4px]" : "rounded-b-[4px]",
                        variant === "diverging" && !up ? "bg-chart-down" : "bg-chart-up",
                      )}
                      style={
                        up
                          ? { bottom: `${zero}%`, height: `${height}%` }
                          : { top: `${100 - zero}%`, height: `${height}%` }
                      }
                    />
                  ) : null}

                  <div
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute z-10 hidden whitespace-nowrap rounded-lg border border-border bg-card px-3 py-2 shadow-md group-hover:block group-focus-visible:block",
                      align,
                    )}
                    style={{ bottom: `calc(${pct(Math.max(c.value, 0))}% + 8px)` }}
                  >
                    <p className="text-sm font-semibold">{format(c.value)}</p>
                    <p className="text-xs text-muted-foreground">{c.fullLabel}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* X axis */}
      <div className="ml-16 flex" aria-hidden>
        {columns.map((c) => (
          <div key={c.key} className="flex-1 text-center text-xs text-muted-foreground">
            <div>{c.label}</div>
            <div className="h-4">{c.sublabel ?? ""}</div>
          </div>
        ))}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Bekijk als tabel
        </summary>
        <table className="mt-2 w-full">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1 font-medium">Maand</th>
              <th className="py-1 text-right font-medium">Bedrag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {columns.map((c) => (
              <tr key={c.key}>
                <td className="py-1">{c.fullLabel}</td>
                <td className="py-1 text-right tabular-nums">{format(c.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

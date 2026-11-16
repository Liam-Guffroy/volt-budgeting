import Link from "next/link";
import { formatEUR } from "@/lib/format";
import { niceScale } from "@/lib/stats";
import { cn } from "@/lib/utils";

export interface YearColumn {
  /** "2026-10" */
  month: string;
  /** "okt" */
  label: string;
  /** "Oktober 2026" */
  fullLabel: string;
  /** What was left that month; null for a month that doesn't count. */
  value: number | null;
  /** Still running: drawn lighter, because the figure will keep moving. */
  inProgress: boolean;
}

const tick = new Intl.NumberFormat("nl-BE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/**
 * What was left per month, as columns around a zero line: above it the month
 * closed with money over, below it with a shortfall. Direction carries the
 * meaning; the two colours repeat it. All twelve months keep their slot so a
 * year always reads January to December, and each column opens its month.
 */
export function YearColumns({ columns }: { columns: YearColumn[] }) {
  const { lo, hi, ticks } = niceScale(
    columns.flatMap((c) => (c.value === null ? [] : [c.value])),
    4,
  );
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const zero = pct(0);
  const last = columns.length - 1;

  return (
    <div>
      <div className="flex">
        <div className="relative h-48 w-14 shrink-0" aria-hidden>
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-2 translate-y-1/2 whitespace-nowrap text-xs tabular-nums text-muted-foreground"
              style={{ bottom: `${pct(t)}%` }}
            >
              {tick.format(t)}
            </span>
          ))}
        </div>

        <div className="relative h-48 min-w-0 flex-1">
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
              if (c.value === null) return <div key={c.month} className="flex-1" />;
              const up = c.value >= 0;
              const top = up ? pct(c.value) : zero;
              return (
                <Link
                  key={c.month}
                  href={`/statistieken?month=${c.month}`}
                  aria-label={`${c.fullLabel}: ${formatEUR(c.value)}${c.inProgress ? " (lopende maand)" : ""}`}
                  className="group relative flex-1 rounded-md outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {c.value !== 0 ? (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-1/2 w-[min(24px,60%)] -translate-x-1/2",
                        up ? "rounded-t-[4px] bg-chart-up" : "rounded-b-[4px] bg-chart-down",
                        c.inProgress && "opacity-50",
                      )}
                      style={{
                        bottom: `${up ? zero : pct(c.value)}%`,
                        height: `${Math.abs(pct(c.value) - zero)}%`,
                      }}
                    />
                  ) : null}
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute z-10 mb-2 hidden whitespace-nowrap rounded-lg border border-border bg-card px-3 py-2 shadow-md group-hover:block group-focus-visible:block",
                      i <= 1 ? "left-0" : i >= last - 1 ? "right-0" : "left-1/2 -translate-x-1/2",
                    )}
                    style={{ bottom: `${top}%` }}
                  >
                    <span className="block text-sm font-semibold">
                      {formatEUR(Math.abs(c.value))} {up ? "over" : "tekort"}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {c.fullLabel}
                      {c.inProgress ? " · loopt nog" : ""}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="ml-14 mt-2 flex" aria-hidden>
        {columns.map((c) => (
          <span
            key={c.month}
            className={cn(
              "flex-1 text-center text-xs",
              c.value === null ? "text-muted-foreground/60" : "text-muted-foreground",
            )}
          >
            {/* Twelve labels don't fit a phone: one letter there, three from sm up. */}
            <span className="sm:hidden">{c.label.charAt(0).toUpperCase()}</span>
            <span className="hidden sm:inline">{c.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

import Link from "next/link";
import { formatEUR } from "@/lib/format";
import { niceScale } from "@/lib/stats";
import { cn } from "@/lib/utils";

export interface MonthColumn {
  /** "2026-10" */
  month: string;
  /** "okt" */
  label: string;
  /** "Oktober 2026" */
  fullLabel: string;
  total: number;
}

const tick = new Intl.NumberFormat("nl-BE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/**
 * One-time costs per month as columns. Emphasis form: the month being viewed
 * is the accent, the others grey. Each column is a link to that month, and its
 * whole slot is the hover/focus target with a tooltip.
 */
export function MonthColumns({
  columns,
  active,
}: {
  columns: MonthColumn[];
  active: string;
}) {
  const { hi, ticks } = niceScale(columns.map((c) => c.total), 3);
  const pct = (v: number) => (v / hi) * 100;
  const last = columns.length - 1;

  return (
    <div>
      <div className="flex">
        <div className="relative h-44 w-12 shrink-0" aria-hidden>
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

        <div className="relative h-44 flex-1">
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
            {columns.map((c, i) => (
              <Link
                key={c.month}
                href={`/statistieken?month=${c.month}`}
                aria-label={`${c.fullLabel}: ${formatEUR(c.total)}`}
                aria-current={c.month === active ? "true" : undefined}
                className="group relative flex-1 rounded-md outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {c.total > 0 ? (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute bottom-0 left-1/2 w-[min(24px,60%)] -translate-x-1/2 rounded-t-[4px]",
                      c.month === active ? "bg-chart-up" : "bg-muted-foreground/40",
                    )}
                    style={{ height: `${pct(c.total)}%` }}
                  />
                ) : null}
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute z-10 mb-2 hidden whitespace-nowrap rounded-lg border border-border bg-card px-3 py-2 shadow-md group-hover:block group-focus-visible:block",
                    i === 0 ? "left-0" : i === last && last > 1 ? "right-0" : "left-1/2 -translate-x-1/2",
                  )}
                  style={{ bottom: `${pct(c.total)}%` }}
                >
                  <span className="block text-sm font-semibold">{formatEUR(c.total)}</span>
                  <span className="block text-xs text-muted-foreground">{c.fullLabel}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="ml-12 mt-2 flex" aria-hidden>
        {columns.map((c) => (
          <span
            key={c.month}
            className={cn(
              "flex-1 text-center text-xs",
              c.month === active ? "font-semibold text-foreground" : "text-muted-foreground",
            )}
          >
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

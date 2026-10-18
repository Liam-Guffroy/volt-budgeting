import type { CategoryStat } from "@/lib/stats";
import { formatEUR } from "@/lib/format";
import { cn } from "@/lib/utils";

const percent = new Intl.NumberFormat("nl-BE", {
  style: "percent",
  maximumFractionDigits: 0,
});

/** "15%" — but "<1%" for a real yet tiny share, which would otherwise read "0%". */
function formatShare(share: number): string {
  return share > 0 && share < 0.005 ? "<1%" : percent.format(share);
}

/**
 * Ranked horizontal bars: label, bar, value at the tip. One series, so every
 * bar is the same colour (not a ramp — the categories have no order); the
 * folded "Overige" row is the de-emphasis grey. The list is its own table:
 * every label and value is plain text, so no separate table view is needed.
 */
export function BarList({
  rows,
  suffix,
  showCount,
}: {
  rows: CategoryStat[];
  /** Appended to each value, e.g. " / mnd". */
  suffix?: string;
  /** Show "3×" — meaningful for one-off entries, not for recurring costs. */
  showCount?: boolean;
}) {
  const max = Math.max(...rows.map((r) => r.total), 0);

  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{r.label}</span>
            <span className="shrink-0 tabular-nums">
              {formatEUR(r.total)}
              {suffix ? <span className="text-muted-foreground">{suffix}</span> : null}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2.5 flex-1">
              <div
                className={cn(
                  "h-full rounded-r-[4px]",
                  r.other ? "bg-muted-foreground/60" : "bg-chart-up",
                )}
                style={{ width: max > 0 ? `${(r.total / max) * 100}%` : "0%" }}
              />
            </div>
            <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {showCount ? `${r.count}× · ` : ""}
              {formatShare(r.share)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

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
 * Ranked horizontal bars: label and amount, a thin bar, then the details. One
 * series, so every bar is the same colour (not a ramp — the categories have no
 * order); the folded "Overige" row is the de-emphasis grey. Every label and
 * value is plain text, so the list is its own table view.
 */
export function BarList({
  rows,
  suffix,
  showCount,
  previousName,
}: {
  rows: CategoryStat[];
  /** Appended to each amount, e.g. " / mnd". */
  suffix?: string;
  /** Show "3×" — meaningful for one-off entries, not for recurring costs. */
  showCount?: boolean;
  /** Month name for the comparison line, e.g. "oktober"; omit to hide it. */
  previousName?: string;
}) {
  const max = Math.max(...rows.map((r) => r.total), 0);

  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{r.label}</span>
            <span className="shrink-0 font-medium tabular-nums">
              {formatEUR(r.total)}
              {suffix ? (
                <span className="font-normal text-muted-foreground">{suffix}</span>
              ) : null}
            </span>
          </div>

          <div className="mt-1.5 h-2">
            <div
              className={cn(
                "h-full min-w-1 rounded-full",
                r.other ? "bg-muted-foreground/50" : "bg-chart-up",
              )}
              style={{ width: max > 0 ? `${(r.total / max) * 100}%` : "0%" }}
            />
          </div>

          <div className="mt-1.5 flex justify-between gap-3 text-xs text-muted-foreground">
            <span>
              {showCount ? `${r.count}× · ` : ""}
              {formatShare(r.share)}
            </span>
            {previousName && r.previous !== null ? (
              <span className="tabular-nums">
                {r.previous > 0 ? `${previousName}: ${formatEUR(r.previous)}` : `niet in ${previousName}`}
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

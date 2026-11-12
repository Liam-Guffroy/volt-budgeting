import { formatEUR } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface MoneyPart {
  key: string;
  label: string;
  value: number;
  /** Tailwind background class of a chart token, e.g. "bg-chart-1". */
  color: string;
}

const percent = new Intl.NumberFormat("nl-BE", {
  style: "percent",
  maximumFractionDigits: 0,
});

/**
 * One income, split into where it went: a tall segmented bar with the parts'
 * amounts listed underneath (that list doubles as the table view).
 *
 * Widths are proportional to the amounts. When costs exceed the income there
 * is no "left over" part; the bar then spans the costs and a marker shows
 * where the income ran out.
 */
export function MoneyBar({
  parts,
  income,
  shortfall,
}: {
  parts: MoneyPart[];
  /** Total income for the month; shares are a fraction of this. */
  income: number;
  /** How far costs exceed income (0 when they don't). */
  shortfall: number;
}) {
  const visible = parts.filter((p) => p.value > 0);
  const whole = visible.reduce((t, p) => t + p.value, 0);
  const share = (v: number) => (income > 0 ? v / income : 0);
  const describe = (p: MoneyPart) =>
    `${p.label}: ${formatEUR(p.value)}${income > 0 ? ` (${percent.format(share(p.value))} van je inkomen)` : ""}`;

  return (
    <div>
      <div
        role="img"
        aria-label={visible.map(describe).join(", ")}
        className={cn("relative flex h-7 gap-0.5", shortfall > 0 && "mt-6")}
      >
        {visible.map((p, i) => (
          <div
            key={p.key}
            className={cn("group relative min-w-1 rounded-[4px]", p.color)}
            style={{ flex: `${p.value} 1 0%` }}
          >
            {/* Print the share only where it comfortably fits. */}
            {p.value / whole >= 0.12 && income > 0 ? (
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-medium text-white">
                {percent.format(share(p.value))}
              </span>
            ) : null}
            <div
              className={cn(
                "pointer-events-none absolute bottom-full z-10 mb-2 hidden whitespace-nowrap rounded-lg border border-border bg-card px-3 py-2 shadow-md group-hover:block",
                i === 0 ? "left-0" : i === visible.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2",
              )}
            >
              <p className="text-sm font-semibold text-foreground">{formatEUR(p.value)}</p>
              <p className="text-xs text-muted-foreground">
                {p.label}
                {income > 0 ? ` · ${percent.format(share(p.value))} van je inkomen` : ""}
              </p>
            </div>
          </div>
        ))}

        {shortfall > 0 && income > 0 ? (
          <div
            aria-hidden
            className="absolute -top-6 bottom-0 flex flex-col items-center"
            style={{ left: `${(income / whole) * 100}%`, transform: "translateX(-50%)" }}
          >
            <span className="whitespace-nowrap text-xs text-muted-foreground">inkomen</span>
            <span className="w-0.5 flex-1 bg-foreground" />
          </div>
        ) : null}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {parts.map((p) => (
          <div key={p.key}>
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              <span aria-hidden className={cn("size-2.5 shrink-0 rounded-[3px]", p.color)} />
              {p.label}
            </dt>
            <dd className="mt-1 text-lg font-semibold">{formatEUR(p.value)}</dd>
            {income > 0 ? (
              <dd className="text-xs text-muted-foreground">
                {percent.format(share(p.value))} van je inkomen
              </dd>
            ) : null}
          </div>
        ))}
      </dl>
    </div>
  );
}

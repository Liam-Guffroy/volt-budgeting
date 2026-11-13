import type { BudgetProgress } from "@/lib/budgets";
import { formatEUR } from "@/lib/format";
import { cn } from "@/lib/utils";

const FILL: Record<BudgetProgress["state"], string> = {
  ok: "bg-chart-up",
  near: "bg-[var(--color-warning)]",
  over: "bg-chart-down",
};

/**
 * One budget as a meter: spent of the budget, a bar, and what's left. The fill
 * colour carries the state (on track / nearly used up / over), and the line
 * underneath always says the same in words, so colour is never the only cue.
 * No hooks — usable from server and client components alike.
 */
export function BudgetMeter({
  budget,
  children,
}: {
  budget: BudgetProgress;
  /** Optional controls shown beside the name (edit / delete on the planner). */
  children?: React.ReactNode;
}) {
  const percent = Math.round(budget.ratio * 100);

  return (
    <div>
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{budget.name}</p>
        <p className="shrink-0 text-sm tabular-nums">
          <span className="font-medium">{formatEUR(budget.spent)}</span>
          <span className="text-muted-foreground"> van {formatEUR(budget.amount)}</span>
        </p>
        {children}
      </div>

      <div
        role="meter"
        aria-label={`${budget.name}: ${formatEUR(budget.spent)} van ${formatEUR(budget.amount)}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(percent, 100)}
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full rounded-full", FILL[budget.state])}
          style={{ width: `${Math.min(budget.ratio, 1) * 100}%` }}
        />
      </div>

      <p className="mt-1.5 flex justify-between gap-3 text-xs text-muted-foreground">
        <span>{percent}% gebruikt</span>
        <span
          className={cn(
            budget.state === "over" && "font-medium text-[var(--color-negative)]",
          )}
        >
          {budget.state === "over"
            ? `${formatEUR(-budget.remaining)} over budget`
            : budget.state === "near"
              ? `bijna op — nog ${formatEUR(budget.remaining)}`
              : `nog ${formatEUR(budget.remaining)}`}
        </span>
      </p>
    </div>
  );
}

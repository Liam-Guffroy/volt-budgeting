import { Card } from "@/components/ui/card";
import { frequencyLabel, type BudgetSummary } from "@/lib/budget";
import { formatEUR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Collapsible } from "./collapsible";

/** The headline's formula line, mentioning one-offs only when there are any. */
function formula(summary: BudgetSummary): string {
  const parts = ["inkomen"];
  if (summary.oneTimeIncomeTotal > 0) parts.push("+ eenmalig inkomen");
  parts.push("− vaste kosten", "− reservering");
  if (summary.oneTimeTotal > 0) parts.push("− eenmalige kosten");
  return parts.join(" ");
}

export function ResultsPanel({
  summary,
  monthLabel,
  reserveOpen,
}: {
  summary: BudgetSummary;
  monthLabel: string;
  reserveOpen: boolean;
}) {
  const negative = summary.remaining < 0;

  // Month-specific stats, shown only when that month has any. A lone one spans
  // the full row; two sit side by side.
  const oneOffStats = [
    summary.oneTimeIncomeTotal > 0 && {
      label: "Eenmalig inkomen",
      value: `+ ${formatEUR(summary.oneTimeIncomeTotal)}`,
      positive: true,
    },
    summary.oneTimeTotal > 0 && {
      label: "Eenmalige kosten",
      value: formatEUR(summary.oneTimeTotal),
      positive: false,
    },
  ].filter((s) => s !== false);

  return (
    <div className="space-y-4">
      {/* Headline: what's left in the month being viewed */}
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Over in {monthLabel}</p>
        <p
          className={cn(
            "mt-1 text-4xl font-semibold tabular-nums",
            negative ? "text-[var(--color-negative)]" : "text-primary",
          )}
        >
          {formatEUR(summary.remaining)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{formula(summary)}</p>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Stat label="Vaste kosten / maand" value={formatEUR(summary.regularTotal)} />
        <Stat label="Reserveren / maand" value={formatEUR(summary.reserveTotal)} />
        {oneOffStats.map((s) => (
          <Stat
            key={s.label}
            className={oneOffStats.length === 1 ? "col-span-2" : undefined}
            label={s.label}
            value={s.value}
            positive={s.positive}
          />
        ))}
      </div>

      {/* Reserve breakdown — what to set aside, per irregular bill */}
      <Collapsible
        id="reservering"
        title="Reservering per post"
        description="Maandelijks opzij te zetten voor niet-maandelijkse rekeningen"
        summary={`${formatEUR(summary.reserveTotal)} / mnd`}
        defaultOpen={reserveOpen}
      >
        <Card className="overflow-hidden">
          {summary.reserve.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Nog geen niet-maandelijkse kosten. Voeg bv. een jaarlijkse verzekering toe.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {summary.reserve.map((e) => (
                <li key={e.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatEUR(e.amount)} · {frequencyLabel(e.frequency)}
                    </p>
                  </div>
                  <p className="tabular-nums font-medium">
                    {formatEUR(e.monthly)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      /mnd
                    </span>
                  </p>
                </li>
              ))}
              <li className="flex items-center justify-between bg-muted px-4 py-3">
                <p className="font-medium">Totaal reservering</p>
                <p className="tabular-nums font-semibold">
                  {formatEUR(summary.reserveTotal)}
                </p>
              </li>
            </ul>
          )}
        </Card>
      </Collapsible>
    </div>
  );
}

function Stat({
  label,
  value,
  className,
  positive = false,
}: {
  label: string;
  value: string;
  className?: string;
  positive?: boolean;
}) {
  return (
    <Card className={cn("p-4", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums",
          positive && "text-[var(--color-positive)]",
        )}
      >
        {value}
      </p>
    </Card>
  );
}

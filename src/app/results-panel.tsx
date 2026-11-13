import { CircleAlert, CircleCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { frequencyLabel, type BudgetSummary } from "@/lib/budget";
import { formatDay, formatEUR } from "@/lib/format";
import type { DayKey } from "@/lib/month";
import { reserveStatus } from "@/lib/reserve";
import { cn } from "@/lib/utils";
import { Collapsible } from "./collapsible";
import { ReserveBalanceForm } from "./reserve-balance-form";

/** The headline's formula line, mentioning one-offs only when there are any. */
function formula(summary: BudgetSummary): string {
  const parts = ["inkomen"];
  if (summary.oneTimeIncomeTotal > 0) parts.push("+ eenmalig inkomen");
  parts.push("− vaste kosten", "− reservering");
  if (summary.oneTimeTotal > 0) parts.push("− eenmalige kosten");
  return parts.join(" ");
}

/** "deze maand" / "volgende maand" / "over 4 maanden" */
function dueIn(monthsLeft: number): string {
  if (monthsLeft <= 0) return "deze maand";
  if (monthsLeft === 1) return "volgende maand";
  return `over ${monthsLeft} maanden`;
}

export function ResultsPanel({
  summary,
  monthLabel,
  reserveOpen,
  reserveBalance,
  today,
}: {
  summary: BudgetSummary;
  monthLabel: string;
  reserveOpen: boolean;
  /** What the user says is set aside for non-monthly bills. */
  reserveBalance: number;
  /** Belgian today; due dates are always measured from now, not the viewed month. */
  today: DayKey;
}) {
  const negative = summary.remaining < 0;

  // Set-asides with a due date say how much should be saved by now.
  const reserve = summary.reserve.map((expense) => ({
    expense,
    status: reserveStatus(expense, today),
  }));
  const dated = reserve.filter((r) => r.status !== null);
  const shouldHave = dated.reduce((t, r) => t + (r.status?.shouldHave ?? 0), 0);
  const gap = Math.round((reserveBalance - shouldHave) * 100) / 100;

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
              {reserve.map(({ expense: e, status }) => (
                <li key={e.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{e.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatEUR(e.amount)} · {frequencyLabel(e.frequency)}
                      </p>
                    </div>
                    <p className="shrink-0 tabular-nums font-medium">
                      {formatEUR(e.monthly)}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        /mnd
                      </span>
                    </p>
                  </div>
                  {status ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Vervalt {formatDay(status.due, today)} ({dueIn(status.monthsLeft)}) ·
                      nu {formatEUR(status.shouldHave)} opzij
                    </p>
                  ) : null}
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

        {summary.reserve.length > 0 ? (
          <Card className="space-y-3 p-4">
            {dated.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Geef een post een vervaldag (het potlood bij Terugkerende kosten) om te
                zien hoeveel er nu opzij zou moeten staan.
              </p>
            ) : (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Zou nu opzij moeten staan</p>
                  <p className="mt-1 text-xl font-semibold">{formatEUR(shouldHave)}</p>
                  {dated.length < reserve.length ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {reserve.length - dated.length}{" "}
                      {reserve.length - dated.length === 1 ? "post" : "posten"} zonder
                      vervaldag {reserve.length - dated.length === 1 ? "telt" : "tellen"} niet
                      mee.
                    </p>
                  ) : null}
                </div>
                <ReserveBalanceForm
                  defaultValue={reserveBalance ? String(reserveBalance).replace(".", ",") : ""}
                />
                <p
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-medium",
                    gap >= 0 ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]",
                  )}
                >
                  {gap >= 0 ? (
                    <CircleCheck aria-hidden className="size-4 shrink-0" />
                  ) : (
                    <CircleAlert aria-hidden className="size-4 shrink-0" />
                  )}
                  {gap >= 0
                    ? gap < 0.005
                      ? "Precies op schema."
                      : `Op schema: ${formatEUR(gap)} meer dan nodig.`
                    : `${formatEUR(-gap)} te weinig opzij.`}
                </p>
              </>
            )}
          </Card>
        ) : null}
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

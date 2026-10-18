import Link from "next/link";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  expenses as expensesTable,
  oneTimeExpenses,
  oneTimeIncomes,
  settings,
  users,
} from "@/db/schema";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { BudgetExpense } from "@/lib/budget";
import { formatEUR } from "@/lib/format";
import { currentMonth, formatMonth, type MonthKey } from "@/lib/month";
import { requireUser } from "@/lib/session";
import {
  PERIODS,
  monthSeries,
  periodMonths,
  periodStart,
  recurringBreakdown,
  toPeriod,
  topCategories,
  type MonthEntry,
  type MonthStat,
} from "@/lib/stats";
import { cn } from "@/lib/utils";
import { AppHeader } from "../app-header";
import { BarList } from "./bar-list";
import { ColumnChart, type Column } from "./column-chart";

export const metadata = { title: "Statistieken — Vlot" };

const shortMonth = new Intl.DateTimeFormat("nl-BE", { month: "short", timeZone: "UTC" });

function columnsFor(stats: MonthStat[], valueOf: (s: MonthStat) => number): Column[] {
  return stats.map((s, i) => {
    const [y, m] = s.month.split("-").map(Number);
    return {
      key: s.month,
      label: shortMonth.format(new Date(Date.UTC(y, m - 1, 1))),
      // The year under the first column and every January, so a period that
      // crosses New Year reads unambiguously.
      sublabel: i === 0 || m === 1 ? String(y) : undefined,
      fullLabel: formatMonth(s.month),
      value: valueOf(s),
    };
  });
}

/** Month entries for the budget math: numeric amounts. */
function toMonthEntries(rows: { month: string; name: string; amount: string }[]): MonthEntry[] {
  return rows.map((r) => ({ month: r.month, name: r.name, amount: Number(r.amount) }));
}

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const userId = await requireUser();
  const period = toPeriod((await searchParams).periode);
  const current = currentMonth();
  const start = periodStart(period, current);

  const inPeriod = (table: typeof oneTimeExpenses | typeof oneTimeIncomes) =>
    and(eq(table.userId, userId), gte(table.month, start), lte(table.month, current));

  const [account, settingRow, expenseRows, costRows, incomeRows] = await Promise.all([
    db
      .select({
        // created_at holds the database's UTC clock time; resolve it to an
        // instant, then take the month in Belgian time.
        createdMonth: sql<string>`to_char((${users.createdAt} at time zone current_setting('TimeZone')) at time zone 'Europe/Brussels', 'YYYY-MM')`,
      })
      .from(users)
      .where(eq(users.id, userId)),
    db.select().from(settings).where(eq(settings.userId, userId)),
    db.select().from(expensesTable).where(eq(expensesTable.userId, userId)),
    db
      .select({
        month: oneTimeExpenses.month,
        name: oneTimeExpenses.name,
        amount: oneTimeExpenses.amount,
      })
      .from(oneTimeExpenses)
      .where(inPeriod(oneTimeExpenses)),
    db
      .select({
        month: oneTimeIncomes.month,
        name: oneTimeIncomes.name,
        amount: oneTimeIncomes.amount,
      })
      .from(oneTimeIncomes)
      .where(inPeriod(oneTimeIncomes)),
  ]);

  const income = settingRow[0] ? Number(settingRow[0].monthlyIncome) : 0;
  const expenses: BudgetExpense[] = expenseRows.map((r) => ({
    id: r.id,
    name: r.name,
    amount: Number(r.amount),
    frequency: r.frequency,
  }));
  const costs = toMonthEntries(costRows);
  const incomes = toMonthEntries(incomeRows);

  // Start at the account's first month — or an earlier entry, if one was
  // filed back in time — so there's no made-up history before you began.
  const firstActive: MonthKey = [
    account[0]?.createdMonth ?? current,
    ...costs.map((c) => c.month),
    ...incomes.map((i) => i.month),
  ].sort()[0];
  const months = periodMonths(period, current, firstActive);

  const stats = monthSeries(months, income, expenses, costs, incomes);
  const n = stats.length;
  const totalCosts = stats.reduce((t, s) => t + s.oneTimeCosts, 0);
  const totalIncome = stats.reduce((t, s) => t + s.oneTimeIncome, 0);
  const avgRemaining = stats.reduce((t, s) => t + s.remaining, 0) / n;

  const categories = topCategories(costs);
  const recurring = recurringBreakdown(expenses);
  const biggest = categories.find((c) => !c.other);

  const range =
    n === 1
      ? formatMonth(months[0])
      : `${formatMonth(months[0])} – ${formatMonth(months[n - 1])}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <AppHeader active="statistieken" />

      {/* One filter row, above everything it scopes. */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Periode" className="flex flex-wrap gap-1">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={`/statistieken?periode=${p.key}`}
              aria-current={p.key === period ? "true" : undefined}
              className={cn(
                buttonVariants({ variant: p.key === period ? "outline" : "ghost", size: "sm" }),
              )}
            >
              {p.label}
            </Link>
          ))}
        </nav>
        <p className="text-sm text-muted-foreground">
          {range} · {n} {n === 1 ? "maand" : "maanden"}
        </p>
      </div>

      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat
            label="Eenmalige kosten"
            value={formatEUR(totalCosts)}
            note={`gem. ${formatEUR(totalCosts / n)} per maand`}
          />
          <Stat
            label="Eenmalig inkomen"
            value={formatEUR(totalIncome)}
            note={`gem. ${formatEUR(totalIncome / n)} per maand`}
          />
          <Stat
            label="Gemiddeld over per maand"
            value={formatEUR(avgRemaining)}
            note="na alle kosten"
          />
          <Stat
            label="Grootste uitgavenpost"
            value={biggest ? biggest.label : "—"}
            note={biggest ? `${formatEUR(biggest.total)} · ${biggest.count}×` : "nog geen eenmalige kosten"}
          />
        </div>

        <Card className="p-6">
          <ChartHeading
            title="Over per maand"
            description="Wat er na alle kosten overblijft. Boven de lijn hield je geld over, eronder kwam je tekort."
          />
          <ColumnChart
            columns={columnsFor(stats, (s) => s.remaining)}
            variant="diverging"
            format={formatEUR}
            caption="Over per maand"
          />
        </Card>

        <Card className="p-6">
          <ChartHeading
            title="Eenmalige kosten per maand"
            description="Alles wat je bij Eenmalige kosten invoerde, per maand opgeteld."
          />
          <ColumnChart
            columns={columnsFor(stats, (s) => s.oneTimeCosts)}
            variant="single"
            format={formatEUR}
            caption="Eenmalige kosten per maand"
          />
        </Card>

        <div className="grid gap-8 lg:grid-cols-2">
          <Card className="p-6">
            <ChartHeading
              title="Waar gaan je eenmalige kosten naartoe?"
              description="Opgeteld per naam over deze periode, grootste eerst."
            />
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nog geen eenmalige kosten in deze periode.
              </p>
            ) : (
              <BarList rows={categories} showCount />
            )}
          </Card>

          <Card className="p-6">
            <ChartHeading
              title="Vaste kosten per maand"
              description="Je terugkerende kosten omgerekend naar een maandbedrag."
            />
            {recurring.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nog geen terugkerende kosten.</p>
            ) : (
              <BarList rows={recurring} suffix=" / mnd" />
            )}
          </Card>
        </div>

        <p className="text-xs text-muted-foreground">
          Je maandinkomen en vaste kosten tellen voor elke maand met de huidige bedragen;
          eenmalige kosten en inkomsten met wat er in die maand werd ingevoerd. De periode
          begint ten vroegste in de maand dat je met Vlot begon.
        </p>
      </div>
    </div>
  );
}

function ChartHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-medium">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

/** Stat tile: label, value (proportional figures — it stands alone), note. */
function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold" title={value}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
    </Card>
  );
}

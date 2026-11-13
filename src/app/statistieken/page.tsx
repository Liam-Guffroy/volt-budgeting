import { and, eq, gte, lte, sql } from "drizzle-orm";
import { TrendingDown, TrendingUp } from "lucide-react";
import { db } from "@/db";
import {
  budgets as budgetsTable,
  expenses as expensesTable,
  oneTimeExpenses,
  oneTimeIncomes,
  settings,
  users,
} from "@/db/schema";
import { Card } from "@/components/ui/card";
import { summarize, type BudgetExpense } from "@/lib/budget";
import { budgetProgress } from "@/lib/budgets";
import { formatDay, formatEUR } from "@/lib/format";
import {
  daysIn,
  formatMonth,
  shiftMonth,
  todayKey,
  toMonth,
  type MonthKey,
} from "@/lib/month";
import { requireUser } from "@/lib/session";
import {
  cumulativeByDay,
  dayOf,
  inMonth,
  largest,
  recurringBreakdown,
  topCategories,
  totalOf,
  trendMonths,
  type DatedEntry,
} from "@/lib/stats";
import { cn } from "@/lib/utils";
import { AppHeader } from "../app-header";
import { BudgetMeter } from "../budget-meter";
import { MonthNav } from "../month-nav";
import { BarList } from "./bar-list";
import { MoneyBar, type MoneyPart } from "./money-bar";
import { MonthColumns } from "./month-columns";
import { SpendingChart } from "./spending-chart";

export const metadata = { title: "Statistieken — Vlot" };

const longMonth = new Intl.DateTimeFormat("nl-BE", { month: "long", timeZone: "UTC" });
const shortMonth = new Intl.DateTimeFormat("nl-BE", { month: "short", timeZone: "UTC" });
const monthDate = (month: MonthKey) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
};

function toEntries(rows: { entryDate: string; name: string; amount: string }[]): DatedEntry[] {
  return rows.map((r) => ({ date: r.entryDate, name: r.name, amount: Number(r.amount) }));
}

/** The budget math wants ids; statistics don't have a use for them. */
const withIds = (entries: DatedEntry[]) =>
  entries.map((e, id) => ({ id, name: e.name, amount: e.amount }));

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const userId = await requireUser();
  const month = toMonth((await searchParams).month);
  const prev = shiftMonth(month, -1);
  const monthLabel = formatMonth(month);
  const monthName = longMonth.format(monthDate(month));
  const prevName = longMonth.format(monthDate(prev));

  const today = todayKey();
  const nowMonth = today.slice(0, 7);
  const isCurrent = month === nowMonth;
  const days = daysIn(month);
  const rangeStart = shiftMonth(month, -5);

  const inRange = (table: typeof oneTimeExpenses | typeof oneTimeIncomes) =>
    and(eq(table.userId, userId), gte(table.month, rangeStart), lte(table.month, month));

  const [account, settingRow, expenseRows, costRows, incomeRows, budgetRows] = await Promise.all([
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
        entryDate: oneTimeExpenses.entryDate,
        name: oneTimeExpenses.name,
        amount: oneTimeExpenses.amount,
      })
      .from(oneTimeExpenses)
      .where(inRange(oneTimeExpenses)),
    db
      .select({
        entryDate: oneTimeIncomes.entryDate,
        name: oneTimeIncomes.name,
        amount: oneTimeIncomes.amount,
      })
      .from(oneTimeIncomes)
      .where(inRange(oneTimeIncomes)),
    db.select().from(budgetsTable).where(eq(budgetsTable.userId, userId)),
  ]);

  const income = settingRow[0] ? Number(settingRow[0].monthlyIncome) : 0;
  const expenses: BudgetExpense[] = expenseRows.map((r) => ({
    id: r.id,
    name: r.name,
    amount: Number(r.amount),
    frequency: r.frequency,
  }));
  const allCosts = toEntries(costRows);
  const allIncomes = toEntries(incomeRows);

  const costs = inMonth(allCosts, month);
  const prevCosts = inMonth(allCosts, prev);
  const summary = summarize(income, expenses, withIds(costs), withIds(inMonth(allIncomes, month)));

  // ── Where the money went ──────────────────────────────────────────────
  const totalIncome = income + summary.oneTimeIncomeTotal;
  const shortfall = Math.max(-summary.remaining, 0);
  const parts: MoneyPart[] = [
    { key: "vast", label: "Vaste kosten", value: summary.regularTotal, color: "bg-chart-1" },
    { key: "reserve", label: "Reserveren", value: summary.reserveTotal, color: "bg-chart-2" },
    { key: "eenmalig", label: "Eenmalige kosten", value: summary.oneTimeTotal, color: "bg-chart-3" },
    ...(shortfall > 0
      ? []
      : [{ key: "over", label: "Over", value: summary.remaining, color: "bg-chart-4" }]),
  ];
  const hasMoney = totalIncome > 0 || parts.some((p) => p.value > 0);

  // ── Spending pace ─────────────────────────────────────────────────────
  // How far the month has got: today for the current month (or a later entry,
  // if one was dated ahead), the whole month for a past one.
  const lastEntryDay = costs.reduce((d, e) => Math.max(d, dayOf(e.date)), 0);
  const reachedDay = isCurrent
    ? Math.max(dayOf(today), lastEntryDay)
    : month < nowMonth
      ? days
      : lastEntryDay;
  const running = cumulativeByDay(costs, days, reachedDay);
  const prevRunning = (
    prevCosts.length > 0 ? cumulativeByDay(prevCosts, daysIn(prev)) : []
  ) as number[];

  const spent = summary.oneTimeTotal;
  // Fair comparison: last month at the same day, not last month's full total.
  const prevAtSameDay =
    prevRunning.length > 0 && reachedDay > 0
      ? prevRunning[Math.min(reachedDay, prevRunning.length) - 1]
      : null;
  const paceDiff = prevAtSameDay !== null ? spent - prevAtSameDay : null;
  const daysLeft = isCurrent ? days - dayOf(today) + 1 : 0;
  const biggest = largest(costs, 5);

  // ── Categories, trend, fixed costs ────────────────────────────────────
  // Same fairness rule as the pace: a month in progress is compared with the
  // month before up to the same day.
  const prevComparable = isCurrent
    ? prevCosts.filter((e) => dayOf(e.date) <= reachedDay)
    : prevCosts;
  const categories = topCategories(costs, 6, prevCosts.length > 0 ? prevComparable : undefined);
  const firstActive: MonthKey = [
    account[0]?.createdMonth ?? month,
    ...allCosts.map((c) => c.date.slice(0, 7)),
  ].sort()[0];
  const trend = trendMonths(month, firstActive).map((m) => ({
    month: m,
    label: shortMonth.format(monthDate(m)),
    fullLabel: formatMonth(m),
    total: totalOf(inMonth(allCosts, m)),
  }));
  const trendAverage = trend.reduce((t, m) => t + m.total, 0) / trend.length;
  const recurring = recurringBreakdown(expenses, 4);
  // Budgets against this month's one-time costs, fullest first.
  const budgets = budgetProgress(
    budgetRows.map((b) => ({ id: b.id, name: b.name, key: b.key, amount: Number(b.amount) })),
    costs,
  ).sort((a, b) => b.ratio - a.ratio);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <AppHeader active="statistieken" />

      <div className="mb-8 flex justify-center sm:justify-start">
        <MonthNav month={month} basePath="/statistieken" />
      </div>

      <div className="space-y-6">
        {/* Where the money went */}
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">
            {shortfall > 0 ? "Tekort" : "Over"} in {monthLabel}
          </p>
          <p
            className={cn(
              "mt-1 text-5xl font-semibold tracking-tight",
              shortfall > 0 ? "text-[var(--color-negative)]" : "text-primary",
            )}
          >
            {formatEUR(summary.remaining)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            van {formatEUR(totalIncome)} inkomen
            {summary.oneTimeIncomeTotal > 0
              ? ` (waarvan ${formatEUR(summary.oneTimeIncomeTotal)} eenmalig)`
              : ""}
            {shortfall > 0 ? ` — je gaf ${formatEUR(shortfall)} meer uit dan er binnenkwam` : ""}
          </p>

          <div className="mt-6">
            {hasMoney ? (
              <MoneyBar parts={parts} income={totalIncome} shortfall={shortfall} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Vul je inkomen en kosten in op de planner om hier te zien waar je geld
                naartoe gaat.
              </p>
            )}
          </div>
        </Card>

        {/* Headline numbers */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Tile label="Eenmalig uitgegeven" value={formatEUR(spent)}>
            {paceDiff === null ? (
              `${costs.length} ${costs.length === 1 ? "uitgave" : "uitgaven"}`
            ) : Math.abs(paceDiff) < 0.005 ? (
              `evenveel als in ${prevName}`
            ) : (
              <span
                className={cn(
                  "inline-flex items-start gap-1",
                  paceDiff < 0 ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]",
                )}
              >
                {paceDiff < 0 ? (
                  <TrendingDown aria-hidden className="mt-px size-3.5 shrink-0" />
                ) : (
                  <TrendingUp aria-hidden className="mt-px size-3.5 shrink-0" />
                )}
                {formatEUR(Math.abs(paceDiff))} {paceDiff < 0 ? "minder" : "meer"} dan{" "}
                {isCurrent ? `op dag ${reachedDay} van ${prevName}` : `in ${prevName}`}
              </span>
            )}
          </Tile>

          <Tile
            label="Gemiddeld per dag"
            value={formatEUR(reachedDay > 0 ? spent / reachedDay : 0)}
          >
            {reachedDay > 0 ? `over ${reachedDay} ${reachedDay === 1 ? "dag" : "dagen"}` : "nog geen dagen"}
          </Tile>

          {isCurrent ? (
            <Tile
              label="Nog vrij per dag"
              value={formatEUR(Math.max(summary.remaining, 0) / daysLeft)}
            >
              nog {daysLeft} {daysLeft === 1 ? "dag" : "dagen"} deze maand
            </Tile>
          ) : (
            <Tile label="Aantal uitgaven" value={String(costs.length)}>
              {costs.length > 0 ? `gemiddeld ${formatEUR(spent / costs.length)} per keer` : "geen eenmalige kosten"}
            </Tile>
          )}

          <Tile label="Grootste uitgave" value={biggest[0]?.name ?? "—"}>
            {biggest[0]
              ? `${formatEUR(biggest[0].amount)} · ${formatDay(biggest[0].date)}`
              : "nog geen eenmalige kosten"}
          </Tile>
        </div>

        {budgets.length > 0 ? (
          <Card className="p-6">
            <Heading
              title="Budgetten"
              description={`Waar je in ${monthName} staat per categorie. Aanpassen kan op de planner.`}
            />
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              {budgets.map((b) => (
                <BudgetMeter key={b.id} budget={b} />
              ))}
            </div>
          </Card>
        ) : null}

        {/* Pace + categories */}
        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="p-6 lg:col-span-3">
            <Heading
              title="Uitgaven door de maand"
              description={
                prevRunning.length > 0
                  ? `Je eenmalige kosten opgeteld per dag, naast ${prevName}.`
                  : "Je eenmalige kosten opgeteld per dag."
              }
            />
            {costs.length === 0 && prevRunning.length === 0 ? (
              <Empty>Nog geen eenmalige kosten in {monthLabel}.</Empty>
            ) : (
              <SpendingChart
                current={running}
                previous={prevRunning}
                currentName={monthName}
                previousName={prevName}
              />
            )}
          </Card>

          <Card className="p-6 lg:col-span-2">
            <Heading
              title="Waar ging het naartoe?"
              description={
                prevCosts.length === 0
                  ? "Eenmalige kosten per naam."
                  : isCurrent
                    ? `Eenmalige kosten per naam, naast ${prevName} tot en met dag ${reachedDay}.`
                    : `Eenmalige kosten per naam, naast ${prevName}.`
              }
            />
            {categories.length === 0 ? (
              <Empty>Nog geen eenmalige kosten in {monthLabel}.</Empty>
            ) : (
              <BarList
                rows={categories}
                showCount
                previousName={prevCosts.length > 0 ? prevName : undefined}
              />
            )}
          </Card>
        </div>

        {/* Trend, biggest, fixed */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-6">
            <Heading
              title="Per maand"
              description={
                trend.length > 1
                  ? `Eenmalige kosten, gemiddeld ${formatEUR(trendAverage)}. Klik op een maand om ze te openen.`
                  : "Eenmalige kosten per maand."
              }
            />
            {trend.every((m) => m.total === 0) ? (
              <Empty>Nog geen eenmalige kosten in de voorbije maanden.</Empty>
            ) : (
              <MonthColumns columns={trend} active={month} />
            )}
          </Card>

          <Card className="p-6">
            <Heading title="Grootste uitgaven" description={`De duurste posten van ${monthName}.`} />
            {biggest.length === 0 ? (
              <Empty>Nog geen eenmalige kosten in {monthLabel}.</Empty>
            ) : (
              <ol className="divide-y divide-border">
                {biggest.map((e, i) => (
                  <li key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="w-4 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDay(e.date)}</p>
                    </div>
                    <p className="text-sm font-medium tabular-nums">{formatEUR(e.amount)}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card className="p-6">
            <Heading
              title="Vaste kosten"
              description={`Samen ${formatEUR(summary.regularTotal + summary.reserveTotal)} per maand, reserveringen inbegrepen.`}
            />
            {recurring.length === 0 ? (
              <Empty>Nog geen terugkerende kosten.</Empty>
            ) : (
              <BarList rows={recurring} suffix=" / mnd" />
            )}
          </Card>
        </div>

        <p className="text-xs text-muted-foreground">
          Je maandinkomen en vaste kosten tellen voor elke maand met de bedragen van
          vandaag; eenmalige kosten en inkomsten met wat er in die maand werd ingevoerd.
        </p>
      </div>
    </div>
  );
}

function Heading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-medium">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

/** Stat tile: label, value (proportional figures — it stands alone), a note. */
function Tile({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold" title={value}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{children}</p>
    </Card>
  );
}

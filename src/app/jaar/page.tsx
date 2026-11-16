import Link from "next/link";
import { and, eq, gte, lte, min, sql } from "drizzle-orm";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
import { formatDay, formatEUR } from "@/lib/format";
import { ensureSnapshots, monthBases } from "@/lib/history";
import { currentMonth, formatMonth, type MonthKey } from "@/lib/month";
import { requireUser } from "@/lib/session";
import { largest, topCategories, type DatedEntry } from "@/lib/stats";
import { cn } from "@/lib/utils";
import {
  countedMonths,
  monthsOfYear,
  summarizeMonth,
  toYear,
  yearTotals,
  type YearMonth,
} from "@/lib/year";
import { AppHeader } from "../app-header";
import { BarList } from "../statistieken/bar-list";
import { Empty, Heading, Tile } from "../statistieken/parts";
import { YearColumns } from "./year-columns";

export const metadata = { title: "Jaaroverzicht — Vlot" };

const longMonth = new Intl.DateTimeFormat("nl-BE", { month: "long", timeZone: "UTC" });
const shortMonth = new Intl.DateTimeFormat("nl-BE", { month: "short", timeZone: "UTC" });
const monthDate = (month: MonthKey) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
};
const longName = (month: MonthKey) => longMonth.format(monthDate(month));
// Some ICU versions abbreviate with a full stop ("jan."); the labels don't want it.
const shortName = (month: MonthKey) => shortMonth.format(monthDate(month)).replace(".", "");
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function toEntries(rows: { entryDate: string; name: string; amount: string }[]): DatedEntry[] {
  return rows.map((r) => ({ date: r.entryDate, name: r.name, amount: Number(r.amount) }));
}

export default async function YearPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const userId = await requireUser();
  await ensureSnapshots(userId);
  const now = currentMonth();
  const thisYear = Number(now.slice(0, 4));

  const [account, settingRow, expenseRows, firstCost, firstIncome] = await Promise.all([
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
      .select({ month: min(oneTimeExpenses.month) })
      .from(oneTimeExpenses)
      .where(eq(oneTimeExpenses.userId, userId)),
    db
      .select({ month: min(oneTimeIncomes.month) })
      .from(oneTimeIncomes)
      .where(eq(oneTimeIncomes.userId, userId)),
  ]);

  // The account's first month in use: when it was made, or an earlier month an
  // entry was filed under.
  const firstActive: MonthKey = [
    account[0]?.createdMonth ?? now,
    firstCost[0]?.month ?? now,
    firstIncome[0]?.month ?? now,
  ].sort()[0];
  const firstYear = Math.min(Number(firstActive.slice(0, 4)), thisYear);
  // Only years with something to show: a stray ?year= lands on the nearest one.
  const year = Math.min(
    Math.max(toYear((await searchParams).year, thisYear), firstYear),
    thisYear,
  );

  const counted = countedMonths(year, firstActive, now);
  const inYear = (table: typeof oneTimeExpenses | typeof oneTimeIncomes) =>
    and(eq(table.userId, userId), gte(table.month, `${year}-01`), lte(table.month, `${year}-12`));

  const income = settingRow[0] ? Number(settingRow[0].monthlyIncome) : 0;
  const expenses: BudgetExpense[] = expenseRows.map((r) => ({
    id: r.id,
    name: r.name,
    amount: Number(r.amount),
    frequency: r.frequency,
  }));

  const [costRows, incomeRows, bases] = await Promise.all([
    db
      .select({
        entryDate: oneTimeExpenses.entryDate,
        name: oneTimeExpenses.name,
        amount: oneTimeExpenses.amount,
      })
      .from(oneTimeExpenses)
      .where(inYear(oneTimeExpenses)),
    db
      .select({
        entryDate: oneTimeIncomes.entryDate,
        name: oneTimeIncomes.name,
        amount: oneTimeIncomes.amount,
      })
      .from(oneTimeIncomes)
      .where(inYear(oneTimeIncomes)),
    monthBases(userId, counted, { income, expenses }),
  ]);

  // Entries dated in a month that hasn't started yet stay out, like the month.
  const isCounted = (e: DatedEntry) => counted.includes(e.date.slice(0, 7));
  const costs = toEntries(costRows).filter(isCounted);
  const incomes = toEntries(incomeRows).filter(isCounted);

  const months: YearMonth[] = counted.map((m) =>
    summarizeMonth(m, bases.get(m) ?? { income, expenses }, costs, incomes, now),
  );
  const byMonth = new Map(months.map((m) => [m.month, m]));
  const totals = yearTotals(months);
  const running = months.find((m) => m.inProgress);

  const columns = monthsOfYear(year).map((m) => ({
    month: m,
    label: shortName(m),
    fullLabel: formatMonth(m),
    value: byMonth.get(m)?.remaining ?? null,
    inProgress: byMonth.get(m)?.inProgress ?? false,
  }));
  const categories = topCategories(costs, 8);
  const biggest = largest(costs, 5);

  const shortfall = totals.remaining < 0;
  const span =
    months.length === 0
      ? ""
      : months.length === 1
        ? longName(months[0].month)
        : `${longName(months[0].month)} – ${longName(months[months.length - 1].month)}`;
  const perMonth = (total: number) =>
    months.length > 0 ? `gemiddeld ${formatEUR(total / months.length)} per maand` : "nog geen maanden";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <AppHeader active="jaar" />

      <div className="mb-8 flex justify-center sm:justify-start">
        <YearNav year={year} first={firstYear} last={thisYear} />
      </div>

      <div className="space-y-6">
        {/* The year in one number */}
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">
            {shortfall ? "Tekort" : "Over"} in {year}
          </p>
          <p
            className={cn(
              "mt-1 text-5xl font-semibold tracking-tight",
              shortfall ? "text-[var(--color-negative)]" : "text-primary",
            )}
          >
            {formatEUR(totals.remaining)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            van {formatEUR(totals.income)} inkomen over {months.length}{" "}
            {months.length === 1 ? "maand" : "maanden"}
            {span ? ` (${span})` : ""}
            {running ? ` — ${longName(running.month)} loopt nog` : ""}
          </p>
        </Card>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Tile label="Inkomen" value={formatEUR(totals.income)}>
            {perMonth(totals.income)}
          </Tile>
          <Tile label="Uitgegeven" value={formatEUR(totals.costs)}>
            {perMonth(totals.costs)}
          </Tile>
          <Tile
            label="Beste maand"
            value={totals.best ? capitalize(longName(totals.best.month)) : "—"}
          >
            {totals.best ? remainingNote(totals.best.remaining) : "na twee afgesloten maanden"}
          </Tile>
          <Tile
            label="Zwakste maand"
            value={totals.worst ? capitalize(longName(totals.worst.month)) : "—"}
          >
            {totals.worst ? remainingNote(totals.worst.remaining) : "na twee afgesloten maanden"}
          </Tile>
        </div>

        <Card className="p-6">
          <Heading
            title="Over per maand"
            description={
              months.length > 1
                ? `Wat er elke maand overbleef, gemiddeld ${formatEUR(totals.averageRemaining)}. Klik op een maand om ze te openen.`
                : "Wat er elke maand overbleef. Klik op een maand om ze te openen."
            }
          />
          <YearColumns columns={columns} />
          {running ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {capitalize(longName(running.month))} is lichter getekend: die maand loopt nog.
            </p>
          ) : null}
        </Card>

        {/* The same figures as a table: every number readable, with totals. */}
        <Card className="p-4 sm:p-6">
          <Heading title="Maand per maand" description="Inkomen, kosten en wat er overbleef." />
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <Th align="left">Maand</Th>
                  <Th>Inkomen</Th>
                  <Th className="sm:hidden">Kosten</Th>
                  <Th className="hidden sm:table-cell">Vaste kosten</Th>
                  <Th className="hidden sm:table-cell">Reserveren</Th>
                  <Th className="hidden sm:table-cell">Eenmalig</Th>
                  <Th>Over</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border border-y border-border">
                {months.map((m) => (
                  <tr key={m.month}>
                    <th scope="row" className="px-1.5 py-2.5 text-left font-medium sm:px-2">
                      <Link
                        href={`/statistieken?month=${m.month}`}
                        className="rounded underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="sm:hidden">{shortName(m.month)}</span>
                        <span className="hidden sm:inline">{capitalize(longName(m.month))}</span>
                      </Link>
                      {m.inProgress ? (
                        <span className="ml-2 hidden text-xs font-normal text-muted-foreground sm:inline">
                          loopt nog
                        </span>
                      ) : null}
                    </th>
                    <Td>{formatEUR(m.income)}</Td>
                    <Td className="sm:hidden">{formatEUR(m.costs)}</Td>
                    <Td className="hidden sm:table-cell">{formatEUR(m.regular)}</Td>
                    <Td className="hidden sm:table-cell">{formatEUR(m.reserve)}</Td>
                    <Td className="hidden sm:table-cell">{formatEUR(m.oneTime)}</Td>
                    <Td className={cn("font-medium", m.remaining < 0 && "text-[var(--color-negative)]")}>
                      {formatEUR(m.remaining)}
                    </Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <th scope="row" className="px-1.5 py-2.5 text-left sm:px-2">
                    Totaal
                  </th>
                  <Td>{formatEUR(totals.income)}</Td>
                  <Td className="sm:hidden">{formatEUR(totals.costs)}</Td>
                  <Td className="hidden sm:table-cell">{formatEUR(totals.regular)}</Td>
                  <Td className="hidden sm:table-cell">{formatEUR(totals.reserve)}</Td>
                  <Td className="hidden sm:table-cell">{formatEUR(totals.oneTime)}</Td>
                  <Td className={cn(shortfall && "text-[var(--color-negative)]")}>
                    {formatEUR(totals.remaining)}
                  </Td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <Heading
              title="Waar ging het naartoe?"
              description={`Eenmalige kosten per naam, samen ${formatEUR(totals.oneTime)}.`}
            />
            {categories.length === 0 ? (
              <Empty>Nog geen eenmalige kosten in {year}.</Empty>
            ) : (
              <BarList rows={categories} showCount />
            )}
          </Card>

          <Card className="p-6">
            <Heading title="Grootste uitgaven" description={`De duurste posten van ${year}.`} />
            {biggest.length === 0 ? (
              <Empty>Nog geen eenmalige kosten in {year}.</Empty>
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
        </div>

        <p className="text-xs text-muted-foreground">
          Een afgesloten maand rekent met het inkomen en de vaste kosten van toen, de lopende
          maand met die van nu. Maanden die nog moeten beginnen tellen niet mee.
        </p>
      </div>
    </div>
  );
}

/** "€ 320,00 over" or "€ 45,00 tekort". */
function remainingNote(remaining: number): string {
  return `${formatEUR(Math.abs(remaining))} ${remaining < 0 ? "tekort" : "over"}`;
}

function Th({
  children,
  align = "right",
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-1.5 pb-2 font-medium sm:px-2",
        align === "left" ? "text-left" : "text-right",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={cn("whitespace-nowrap px-1.5 py-2.5 text-right sm:px-2", className)}>
      {children}
    </td>
  );
}

/** Year switcher, like MonthNav: plain links, and it stops where the data does. */
function YearNav({ year, first, last }: { year: number; first: number; last: number }) {
  const arrow = (target: number, label: string, icon: React.ReactNode) => {
    const className = cn(buttonVariants({ variant: "outline", size: "icon" }));
    return target < first || target > last ? (
      <span aria-hidden className={cn(className, "pointer-events-none opacity-40")}>
        {icon}
      </span>
    ) : (
      <Link href={`/jaar?year=${target}`} aria-label={label} className={className}>
        {icon}
      </Link>
    );
  };

  return (
    <div className="flex items-center gap-2">
      {arrow(year - 1, "Vorig jaar", <ChevronLeft />)}
      <p className="min-w-24 text-center font-medium tabular-nums">{year}</p>
      {arrow(year + 1, "Volgend jaar", <ChevronRight />)}
      {year === last ? null : (
        <Link href="/jaar" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          Dit jaar
        </Link>
      )}
    </div>
  );
}

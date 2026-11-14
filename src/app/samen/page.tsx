import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  expenses as expensesTable,
  oneTimeExpenses,
  oneTimeIncomes,
  settings,
} from "@/db/schema";
import { Card } from "@/components/ui/card";
import { summarize, type BudgetExpense, type BudgetSummary } from "@/lib/budget";
import { formatEUR } from "@/lib/format";
import { ensureSnapshots, monthBasis } from "@/lib/history";
import { householdOf } from "@/lib/household";
import { formatMonth, toMonth, type MonthKey } from "@/lib/month";
import { requireUser } from "@/lib/session";
import { topCategories } from "@/lib/stats";
import { cn } from "@/lib/utils";
import { AppHeader } from "../app-header";
import { MonthNav } from "../month-nav";
import { BarList } from "../statistieken/bar-list";
import { MoneyBar, type MoneyPart } from "../statistieken/money-bar";

export const metadata = { title: "Samen — Vlot" };

interface MemberMonth {
  id: number;
  name: string;
  /** Monthly income plus that month's one-time income. */
  income: number;
  summary: BudgetSummary;
  /** One-time costs, kept only to total them per category across the household. */
  costs: { name: string; amount: number }[];
}

/**
 * One member's month, calculated exactly as their own planner does (frozen
 * income and recurring costs for a finished month). Only totals leave this
 * function's result on the page.
 */
async function memberMonth(
  member: { id: number; name: string },
  month: MonthKey,
): Promise<MemberMonth> {
  await ensureSnapshots(member.id);

  const ofMonth = (table: typeof oneTimeExpenses | typeof oneTimeIncomes) =>
    db
      .select({ name: table.name, amount: table.amount })
      .from(table)
      .where(and(eq(table.userId, member.id), eq(table.month, month)));

  const [settingRow, expenseRows, costRows, incomeRows] = await Promise.all([
    db.select().from(settings).where(eq(settings.userId, member.id)),
    db.select().from(expensesTable).where(eq(expensesTable.userId, member.id)),
    ofMonth(oneTimeExpenses),
    ofMonth(oneTimeIncomes),
  ]);

  const expenses: BudgetExpense[] = expenseRows.map((r) => ({
    id: r.id,
    name: r.name,
    amount: Number(r.amount),
    frequency: r.frequency,
  }));
  const basis = await monthBasis(member.id, month, {
    income: settingRow[0] ? Number(settingRow[0].monthlyIncome) : 0,
    expenses,
  });

  const entries = (rows: { name: string; amount: string }[]) =>
    rows.map((r, id) => ({ id, name: r.name, amount: Number(r.amount) }));
  const costs = entries(costRows);
  const summary = summarize(basis.income, basis.expenses, costs, entries(incomeRows));

  return {
    ...member,
    income: basis.income + summary.oneTimeIncomeTotal,
    summary,
    costs,
  };
}

export default async function HouseholdPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const userId = await requireUser();
  const month = toMonth((await searchParams).month);
  const monthLabel = formatMonth(month);
  const household = await householdOf(userId);

  if (!household) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <AppHeader active="samen" />
        <Card className="p-6">
          <h2 className="font-medium">Nog geen gezamenlijk overzicht</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Dit account zit niet in een huishouden met iemand anders. Wie de app beheert,
            kan accounts koppelen met{" "}
            <code className="rounded bg-muted px-1 py-0.5">
              npm run household -- link &quot;Thuis&quot; &quot;Naam&quot; &quot;Naam&quot;
            </code>
            . Daarna zien de gekoppelde accounts hier elkaars totalen per maand, nooit de
            afzonderlijke posten.
          </p>
        </Card>
      </div>
    );
  }

  const members = await Promise.all(household.members.map((m) => memberMonth(m, month)));
  const sum = (pick: (m: MemberMonth) => number) => members.reduce((t, m) => t + pick(m), 0);

  const income = sum((m) => m.income);
  const regular = sum((m) => m.summary.regularTotal);
  const reserve = sum((m) => m.summary.reserveTotal);
  const oneTime = sum((m) => m.summary.oneTimeTotal);
  const remaining = sum((m) => m.summary.remaining);
  const shortfall = Math.max(-remaining, 0);

  const parts: MoneyPart[] = [
    { key: "vast", label: "Vaste kosten", value: regular, color: "bg-chart-1" },
    { key: "reserve", label: "Reserveren", value: reserve, color: "bg-chart-2" },
    { key: "eenmalig", label: "Eenmalige kosten", value: oneTime, color: "bg-chart-3" },
    ...(shortfall > 0
      ? []
      : [{ key: "over", label: "Over", value: remaining, color: "bg-chart-4" }]),
  ];
  const hasMoney = income > 0 || parts.some((p) => p.value > 0);
  const categories = topCategories(members.flatMap((m) => m.costs), 8);
  const names = household.members.map((m) => m.name);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <AppHeader active="samen" />

      <div className="mb-8 flex justify-center sm:justify-start">
        <MonthNav month={month} basePath="/samen" />
      </div>

      <div className="space-y-6">
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">
            {household.name} · samen {shortfall > 0 ? "tekort" : "over"} in {monthLabel}
          </p>
          <p
            className={cn(
              "mt-1 text-5xl font-semibold tracking-tight",
              shortfall > 0 ? "text-[var(--color-negative)]" : "text-primary",
            )}
          >
            {formatEUR(remaining)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            van {formatEUR(income)} gezamenlijk inkomen · {names.join(", ")}
          </p>
          <div className="mt-6">
            {hasMoney ? (
              <MoneyBar
                parts={parts}
                income={income}
                shortfall={shortfall}
                incomeLabel="het gezamenlijk inkomen"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Nog niemand heeft een inkomen of kosten ingevuld.
              </p>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-medium">Per persoon</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Ieders eigen maand, zoals op de eigen planner.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="text-right text-xs text-muted-foreground">
                  <th className="py-2 pr-3 text-left font-medium">Naam</th>
                  <th className="px-3 py-2 font-medium">Inkomen</th>
                  <th className="px-3 py-2 font-medium">Vaste kosten</th>
                  <th className="px-3 py-2 font-medium">Reserveren</th>
                  <th className="px-3 py-2 font-medium">Eenmalig</th>
                  <th className="py-2 pl-3 font-medium">Over</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular-nums">
                {members.map((m) => (
                  <tr key={m.id} className="text-right">
                    <td className="py-2.5 pr-3 text-left font-medium">
                      {m.name}
                      {m.id === userId ? (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          (jij)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">{formatEUR(m.income)}</td>
                    <td className="px-3 py-2.5">{formatEUR(m.summary.regularTotal)}</td>
                    <td className="px-3 py-2.5">{formatEUR(m.summary.reserveTotal)}</td>
                    <td className="px-3 py-2.5">{formatEUR(m.summary.oneTimeTotal)}</td>
                    <td
                      className={cn(
                        "py-2.5 pl-3 font-medium",
                        m.summary.remaining < 0 && "text-[var(--color-negative)]",
                      )}
                    >
                      {formatEUR(m.summary.remaining)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="tabular-nums">
                <tr className="border-t border-border text-right font-semibold">
                  <td className="py-2.5 pr-3 text-left">Samen</td>
                  <td className="px-3 py-2.5">{formatEUR(income)}</td>
                  <td className="px-3 py-2.5">{formatEUR(regular)}</td>
                  <td className="px-3 py-2.5">{formatEUR(reserve)}</td>
                  <td className="px-3 py-2.5">{formatEUR(oneTime)}</td>
                  <td
                    className={cn(
                      "py-2.5 pl-3",
                      remaining < 0 && "text-[var(--color-negative)]",
                    )}
                  >
                    {formatEUR(remaining)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-medium">Samen uitgegeven per categorie</h2>
          <p className="mb-5 text-sm text-muted-foreground">
            Ieders eenmalige kosten in {monthLabel}, opgeteld per naam.
          </p>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nog geen eenmalige kosten in {monthLabel}.
            </p>
          ) : (
            <div className="max-w-xl">
              <BarList rows={categories} showCount />
            </div>
          )}
        </Card>

        <p className="text-xs text-muted-foreground">
          Hier staan alleen totalen: per persoon en per categorie. Afzonderlijke posten
          blijven op ieders eigen planner.
        </p>
      </div>
    </div>
  );
}

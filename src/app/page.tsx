import { cookies } from "next/headers";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  expenses as expensesTable,
  oneTimeExpenses,
  oneTimeIncomes,
  quickAdds,
  settings,
} from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { summarize, type BudgetExpense, type OneTimeEntry } from "@/lib/budget";
import { COLLAPSE_COOKIE, parseCollapsed, type SectionId } from "@/lib/collapse";
import { formatEUR } from "@/lib/format";
import { formatMonth, toMonth } from "@/lib/month";
import {
  BUILT_IN_QUICK_ADDS,
  type QuickAdd,
  type QuickAddKind,
} from "@/lib/quick-adds";
import { requireUser } from "@/lib/session";
import {
  addOneTimeExpense,
  addOneTimeIncome,
  deleteOneTimeExpense,
  deleteOneTimeIncome,
  logout,
} from "./actions";
import { Collapsible } from "./collapsible";
import { ExpenseForm } from "./expense-form";
import { ExpenseRow } from "./expense-row";
import { IncomeForm } from "./income-form";
import { MonthNav } from "./month-nav";
import { OneTimeSection } from "./one-time-section";
import { ResultsPanel } from "./results-panel";
import { ThemeToggle } from "./theme-toggle";

/** DB numeric rows -> plain entries for the budget math. */
function toEntries(
  rows: { id: number; name: string; amount: string }[],
): OneTimeEntry[] {
  return rows.map((r) => ({ id: r.id, name: r.name, amount: Number(r.amount) }));
}

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const userId = await requireUser();
  const month = toMonth((await searchParams).month);
  const monthLabel = formatMonth(month);

  const collapsed = parseCollapsed((await cookies()).get(COLLAPSE_COOKIE)?.value);
  const isOpen = (id: SectionId) => !collapsed.has(id);

  const [rows, settingRow, oneTimeCostRows, oneTimeIncomeRows, quickAddRows] = await Promise.all([
    db
      .select()
      .from(expensesTable)
      .where(eq(expensesTable.userId, userId))
      .orderBy(asc(expensesTable.position), asc(expensesTable.id)),
    db.select().from(settings).where(eq(settings.userId, userId)),
    db
      .select()
      .from(oneTimeExpenses)
      .where(
        and(eq(oneTimeExpenses.userId, userId), eq(oneTimeExpenses.month, month)),
      )
      .orderBy(asc(oneTimeExpenses.id)),
    db
      .select()
      .from(oneTimeIncomes)
      .where(
        and(eq(oneTimeIncomes.userId, userId), eq(oneTimeIncomes.month, month)),
      )
      .orderBy(asc(oneTimeIncomes.id)),
    db
      .select()
      .from(quickAdds)
      .where(eq(quickAdds.userId, userId))
      .orderBy(asc(quickAdds.id)),
  ]);

  // Built-in buttons first, then this account's own (removable) ones.
  const quickAddsFor = (kind: QuickAddKind): QuickAdd[] => [
    ...BUILT_IN_QUICK_ADDS[kind],
    ...quickAddRows
      .filter((q) => q.kind === kind)
      .map((q) => ({
        name: q.name,
        frequency: q.frequency ?? undefined,
        customId: q.id,
      })),
  ];

  const income = settingRow[0] ? Number(settingRow[0].monthlyIncome) : 0;

  const parsed: BudgetExpense[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    amount: Number(r.amount),
    frequency: r.frequency,
  }));

  const oneTime = toEntries(oneTimeCostRows);
  const oneTimeIncome = toEntries(oneTimeIncomeRows);

  const summary = summarize(income, parsed, oneTime, oneTimeIncome);
  const incomeInput = income ? String(income).replace(".", ",") : "";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Vlot</h1>
          <p className="text-sm text-muted-foreground">
            Wat houd je over, en hoeveel zet je opzij?
          </p>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <form action={logout}>
            <Button type="submit" variant="ghost" size="sm">
              Uitloggen
            </Button>
          </form>
        </div>
      </header>

      <div className="mb-8 flex justify-center sm:justify-start">
        <MonthNav month={month} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        {/* Left: inputs. The month-specific sections come first (one-off costs
            are typed in constantly), then the ones that hold every month. Each
            folds away to its header and remembers that per browser. */}
        <div className="space-y-8">
          <Collapsible
            id="eenmalige-kosten"
            title="Eenmalige kosten"
            description={`Alleen voor ${monthLabel} — telt niet mee in andere maanden.`}
            summary={formatEUR(summary.oneTimeTotal)}
            defaultOpen={isOpen("eenmalige-kosten")}
          >
            <OneTimeSection
              month={month}
              monthLabel={monthLabel}
              entries={oneTime}
              total={summary.oneTimeTotal}
              addAction={addOneTimeExpense}
              deleteAction={deleteOneTimeExpense}
              quickAddKind="one_time_cost"
              quickAdds={quickAddsFor("one_time_cost")}
              placeholder="bv. Boodschappen"
              idPrefix="one-time"
              variant="expense"
              emptyText="Geen eenmalige kosten"
              totalLabel="Totaal eenmalig"
            />
          </Collapsible>

          <Collapsible
            id="eenmalige-inkomsten"
            title="Eenmalige inkomsten"
            description={`Bovenop je vaste inkomen, alleen voor ${monthLabel}.`}
            summary={`+ ${formatEUR(summary.oneTimeIncomeTotal)}`}
            defaultOpen={isOpen("eenmalige-inkomsten")}
          >
            <OneTimeSection
              month={month}
              monthLabel={monthLabel}
              entries={oneTimeIncome}
              total={summary.oneTimeIncomeTotal}
              addAction={addOneTimeIncome}
              deleteAction={deleteOneTimeIncome}
              quickAddKind="one_time_income"
              quickAdds={quickAddsFor("one_time_income")}
              placeholder="bv. Vakantiegeld"
              idPrefix="one-time-income"
              variant="income"
              emptyText="Geen eenmalige inkomsten"
              totalLabel="Totaal eenmalig inkomen"
            />
          </Collapsible>

          <Collapsible
            id="terugkerende-kosten"
            title="Terugkerende kosten"
            summary={`${formatEUR(summary.regularTotal + summary.reserveTotal)} / mnd`}
            defaultOpen={isOpen("terugkerende-kosten")}
          >
            <Card className="p-6">
              <ExpenseForm quickAdds={quickAddsFor("recurring")} />
            </Card>

            <Card className="overflow-hidden">
              {parsed.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  Nog geen kosten toegevoegd.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {summary.all.map((e, i) => (
                    <ExpenseRow
                      key={e.id}
                      expense={e}
                      isFirst={i === 0}
                      isLast={i === summary.all.length - 1}
                    />
                  ))}
                </ul>
              )}
            </Card>
          </Collapsible>

          <Collapsible
            id="inkomen"
            title="Maandelijks netto-inkomen"
            summary={formatEUR(income)}
            defaultOpen={isOpen("inkomen")}
          >
            <Card className="p-6">
              <IncomeForm defaultValue={incomeInput} />
            </Card>
          </Collapsible>
        </div>

        {/* Right: results */}
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <ResultsPanel
            summary={summary}
            monthLabel={monthLabel}
            reserveOpen={isOpen("reservering")}
          />
        </aside>
      </div>
    </div>
  );
}

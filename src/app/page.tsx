import { cookies } from "next/headers";
import { and, asc, desc, eq, type AnyColumn } from "drizzle-orm";
import { db } from "@/db";
import {
  budgets as budgetsTable,
  expenses as expensesTable,
  hiddenQuickAdds,
  oneTimeExpenses,
  oneTimeIncomes,
  quickAdds,
  settings,
} from "@/db/schema";
import { Card } from "@/components/ui/card";
import { summarize, type BudgetExpense } from "@/lib/budget";
import { budgetProgress } from "@/lib/budgets";
import { COLLAPSE_COOKIE, parseCollapsed, type SectionId } from "@/lib/collapse";
import {
  SORT_COOKIE,
  parseOldestFirst,
  type ListSort,
  type SortableList,
} from "@/lib/list-sort";
import { formatEUR } from "@/lib/format";
import { formatMonth, toMonth } from "@/lib/month";
import {
  BUILT_IN_QUICK_ADDS,
  type QuickAddKind,
  type QuickAddSet,
} from "@/lib/quick-adds";
import { requireUser } from "@/lib/session";
import {
  addOneTimeExpense,
  addOneTimeIncome,
  deleteOneTimeExpense,
  deleteOneTimeIncome,
  updateOneTimeExpense,
  updateOneTimeIncome,
} from "./actions";
import { AppHeader } from "./app-header";
import { BudgetSection } from "./budget-section";
import { Collapsible } from "./collapsible";
import { ExpenseForm } from "./expense-form";
import { ExpenseRow } from "./expense-row";
import { IncomeForm } from "./income-form";
import { MonthNav } from "./month-nav";
import type { DatedOneTimeEntry } from "./one-time-row";
import { OneTimeSection } from "./one-time-section";
import { ResultsPanel } from "./results-panel";

/** DB numeric rows -> entries for the budget math, keeping their day. */
function toEntries(
  rows: { id: number; name: string; amount: string; entryDate: string }[],
): DatedOneTimeEntry[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    amount: Number(r.amount),
    date: r.entryDate,
  }));
}

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const userId = await requireUser();
  const month = toMonth((await searchParams).month);
  const monthLabel = formatMonth(month);

  const cookieStore = await cookies();
  const collapsed = parseCollapsed(cookieStore.get(COLLAPSE_COOKIE)?.value);
  const isOpen = (id: SectionId) => !collapsed.has(id);

  // Newest first unless this browser switched the list to oldest first. The
  // id tie-break keeps same-day entries in the order they were added.
  const oldestFirst = parseOldestFirst(cookieStore.get(SORT_COOKIE)?.value);
  const sortFor = (list: SortableList): ListSort =>
    oldestFirst.has(list) ? "oldest" : "newest";
  const byDate = (list: SortableList, date: AnyColumn, id: AnyColumn) =>
    sortFor(list) === "oldest" ? [asc(date), asc(id)] : [desc(date), desc(id)];

  const [
    rows,
    settingRow,
    oneTimeCostRows,
    oneTimeIncomeRows,
    quickAddRows,
    hiddenRows,
    budgetRows,
  ] = await Promise.all([
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
      .orderBy(
        ...byDate("eenmalige-kosten", oneTimeExpenses.entryDate, oneTimeExpenses.id),
      ),
    db
      .select()
      .from(oneTimeIncomes)
      .where(
        and(eq(oneTimeIncomes.userId, userId), eq(oneTimeIncomes.month, month)),
      )
      .orderBy(
        ...byDate("eenmalige-inkomsten", oneTimeIncomes.entryDate, oneTimeIncomes.id),
      ),
    db
      .select()
      .from(quickAdds)
      .where(eq(quickAdds.userId, userId))
      .orderBy(asc(quickAdds.id)),
    db.select().from(hiddenQuickAdds).where(eq(hiddenQuickAdds.userId, userId)),
    db
      .select()
      .from(budgetsTable)
      .where(eq(budgetsTable.userId, userId))
      .orderBy(asc(budgetsTable.id)),
  ]);

  // Un-hidden built-ins first, then this account's own buttons; hidden
  // built-ins are listed separately so they can be brought back.
  const quickAddsFor = (kind: QuickAddKind): QuickAddSet => {
    const hidden = new Set(
      hiddenRows.filter((h) => h.kind === kind).map((h) => h.name),
    );
    const builtIns = BUILT_IN_QUICK_ADDS[kind];
    return {
      kind,
      items: [
        ...builtIns.filter((q) => !hidden.has(q.name)),
        ...quickAddRows
          .filter((q) => q.kind === kind)
          .map((q) => ({
            name: q.name,
            frequency: q.frequency ?? undefined,
            customId: q.id,
          })),
      ],
      hidden: builtIns.filter((q) => hidden.has(q.name)).map((q) => q.name),
    };
  };

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

  // Budgets against this month's one-time costs.
  const budgets = budgetProgress(
    budgetRows.map((b) => ({ id: b.id, name: b.name, key: b.key, amount: Number(b.amount) })),
    oneTime,
  );
  const budgetTotal = budgets.reduce((t, b) => t + b.amount, 0);
  const budgetSpent = budgets.reduce((t, b) => t + b.spent, 0);
  // Names to offer in the budget form: the cost quick-adds, then anything
  // else entered this month.
  const budgetSuggestions = [
    ...new Set([
      ...quickAddsFor("one_time_cost").items.map((q) => q.name),
      ...oneTime.map((e) => e.name.trim()),
    ]),
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <AppHeader active="planner" />

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
              updateAction={updateOneTimeExpense}
              deleteAction={deleteOneTimeExpense}
              listId="eenmalige-kosten"
              sort={sortFor("eenmalige-kosten")}
              quickAdds={quickAddsFor("one_time_cost")}
              placeholder="bv. Boodschappen"
              idPrefix="one-time"
              variant="expense"
              emptyText="Geen eenmalige kosten"
              totalLabel="Totaal eenmalig"
            />
          </Collapsible>

          <Collapsible
            id="budgetten"
            title="Budgetten"
            description={`Hoeveel je per categorie wilt uitgeven, en waar je in ${monthLabel} staat.`}
            summary={
              budgets.length > 0
                ? `${formatEUR(budgetSpent)} van ${formatEUR(budgetTotal)}`
                : undefined
            }
            defaultOpen={isOpen("budgetten")}
          >
            <BudgetSection
              budgets={budgets}
              suggestions={budgetSuggestions}
              monthLabel={monthLabel}
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
              updateAction={updateOneTimeIncome}
              deleteAction={deleteOneTimeIncome}
              listId="eenmalige-inkomsten"
              sort={sortFor("eenmalige-inkomsten")}
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

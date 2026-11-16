import { Fragment } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { LayoutList } from "lucide-react";
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
import { buttonVariants } from "@/components/ui/button";
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
import { formatDay, formatEUR } from "@/lib/format";
import { ensureSnapshots, monthBasis } from "@/lib/history";
import { currentMonth, formatMonth, todayKey, toMonth, type MonthKey } from "@/lib/month";
import {
  SECTION_LABELS,
  parseLayout,
  type PlannerSection,
} from "@/lib/planner-layout";
import { reserveStatus } from "@/lib/reserve";
import {
  BUILT_IN_QUICK_ADDS,
  type QuickAddKind,
  type QuickAddSet,
} from "@/lib/quick-adds";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
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
import { LayoutPanel } from "./layout-panel";
import { MonthNav } from "./month-nav";
import type { DatedOneTimeEntry } from "./one-time-row";
import { OneTimeSection } from "./one-time-section";
import { ResultsPanel } from "./results-panel";

/** The planner URL for a month, with or without the layout editor open. */
function plannerHref(month: MonthKey, editing: boolean): string {
  const params = new URLSearchParams();
  if (month !== currentMonth()) params.set("month", month);
  if (editing) params.set("indeling", "1");
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

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
  searchParams: Promise<{ month?: string; indeling?: string }>;
}) {
  const userId = await requireUser();
  const params = await searchParams;
  const month = toMonth(params.month);
  const monthLabel = formatMonth(month);
  // The layout editor is open while the URL says so: no client state needed,
  // and every change keeps it open.
  const editing = params.indeling === "1";

  // Freeze any month that has finished since the last visit, before reading.
  await ensureSnapshots(userId);

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
    nextDue: r.nextDue,
  }));
  const reserveBalance = settingRow[0] ? Number(settingRow[0].reserveBalance) : 0;
  const layout = parseLayout(settingRow[0]?.plannerLayout);
  const today = todayKey();

  const oneTime = toEntries(oneTimeCostRows);
  const oneTimeIncome = toEntries(oneTimeIncomeRows);

  // A finished month is calculated from its frozen income and recurring
  // costs; the editable lists below always show today's.
  const basis = await monthBasis(userId, month, { income, expenses: parsed });
  const summary = summarize(basis.income, basis.expenses, oneTime, oneTimeIncome);
  const currentSummary = basis.frozen ? summarize(income, parsed) : summary;
  const frozenNote = basis.frozen
    ? ` ${monthLabel} is afgesloten en rekent met de bedragen van toen.`
    : "";
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

  // The left column's sections, keyed by id; rendered in this account's order.
  const sections: Record<PlannerSection, React.ReactNode> = {
    "eenmalige-kosten": (
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
    ),
    "budgetten": (
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
    ),
    "eenmalige-inkomsten": (
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
    ),
    "terugkerende-kosten": (
    <Collapsible
          id="terugkerende-kosten"
          title="Terugkerende kosten"
          description={basis.frozen ? `Je vaste kosten van nu.${frozenNote}` : undefined}
          summary={`${formatEUR(currentSummary.regularTotal + currentSummary.reserveTotal)} / mnd`}
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
                {currentSummary.all.map((e, i) => {
                  const due = e.group === "reserve" ? reserveStatus(e, today) : null;
                  return (
                    <ExpenseRow
                      key={e.id}
                      expense={e}
                      isFirst={i === 0}
                      isLast={i === currentSummary.all.length - 1}
                      dueLabel={due ? `vervalt ${formatDay(due.due, today)}` : undefined}
                    />
                  );
                })}
              </ul>
            )}
          </Card>
        </Collapsible>
    ),
    "inkomen": (
    <Collapsible
          id="inkomen"
          title="Maandelijks netto-inkomen"
          description={basis.frozen ? `Je inkomen van nu.${frozenNote}` : undefined}
          summary={formatEUR(income)}
          defaultOpen={isOpen("inkomen")}
        >
          <Card className="p-6">
            <IncomeForm defaultValue={incomeInput} />
          </Card>
        </Collapsible>
    ),
  };
  const shown = layout.order.filter((id) => !layout.hidden.includes(id));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <AppHeader active="planner" />

      <div className="mb-8 flex flex-wrap items-center justify-center gap-3 sm:justify-between">
        <MonthNav month={month} />
        <Link
          href={editing ? plannerHref(month, false) : plannerHref(month, true)}
          aria-expanded={editing}
          className={cn(buttonVariants({ variant: editing ? "outline" : "ghost", size: "sm" }))}
        >
          <LayoutList />
          Indeling
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        {/* Left: inputs, in this account's own order (default: the month-
            specific sections first, then the ones that hold every month). Each
            folds away to its header and remembers that per browser. min-w-0 lets
            the column shrink to the screen instead of growing to fit
            non-wrapping content (the layout editor's labels truncate instead). */}
        <div className="min-w-0 space-y-8">
          {editing ? (
            <LayoutPanel layout={layout} closeHref={plannerHref(month, false)} />
          ) : null}

          {shown.map((id) => (
            <Fragment key={id}>{sections[id]}</Fragment>
          ))}

          {!editing && layout.hidden.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Verborgen: {layout.hidden.map((id) => SECTION_LABELS[id]).join(", ")} ·{" "}
              <Link
                href={plannerHref(month, true)}
                className="underline underline-offset-4 hover:text-foreground"
              >
                Indeling aanpassen
              </Link>
            </p>
          ) : null}
        </div>

        {/* Right: results */}
        <aside className="min-w-0 lg:sticky lg:top-8 lg:self-start">
          <ResultsPanel
            summary={summary}
            monthLabel={monthLabel}
            reserveOpen={isOpen("reservering")}
            reserveBalance={reserveBalance}
            today={today}
            currentReserve={currentSummary.reserve}
            frozen={basis.frozen ? { month, income: basis.income } : undefined}
          />
        </aside>
      </div>
    </div>
  );
}

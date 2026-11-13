"use client";

import { useActionState, useEffect, useRef } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BudgetProgress } from "@/lib/budgets";
import { deleteBudget, saveBudget, type FormState } from "./actions";
import { BudgetMeter } from "./budget-meter";

const initial: FormState = {};

/** "400" -> "400", "12.5" -> "12,5" for the amount field. */
function toInput(amount: number): string {
  return String(amount).replace(".", ",");
}

/**
 * Budgets on the planner: a form that adds a budget (or, for a name that
 * already has one, replaces its amount) and a meter per budget for the month
 * being viewed. The pencil on a meter loads it into the form.
 */
export function BudgetSection({
  budgets,
  suggestions,
  monthLabel,
}: {
  budgets: BudgetProgress[];
  /** Category names to offer while typing. */
  suggestions: string[];
  monthLabel: string;
}) {
  const [state, formAction, pending] = useActionState(saveBudget, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  function edit(budget: BudgetProgress) {
    if (nameRef.current) nameRef.current.value = budget.name;
    if (amountRef.current) {
      amountRef.current.value = toInput(budget.amount);
      amountRef.current.focus();
      amountRef.current.select();
    }
  }

  return (
    <>
      <Card className="p-6">
        <form
          ref={formRef}
          action={formAction}
          className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end"
        >
          <div className="space-y-2">
            <Label htmlFor="budget-name">Categorie</Label>
            <Input
              ref={nameRef}
              id="budget-name"
              name="name"
              list="budget-suggestions"
              placeholder="bv. Boodschappen"
              autoComplete="off"
            />
          </div>
          {/* Outside the field column, so it doesn't count toward its spacing. */}
          <datalist id="budget-suggestions">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>

          <div className="space-y-2">
            <Label htmlFor="budget-amount">Budget per maand</Label>
            <Input
              ref={amountRef}
              id="budget-amount"
              name="amount"
              inputMode="decimal"
              placeholder="0,00"
            />
          </div>

          <Button type="submit" disabled={pending}>
            {pending ? "Bezig…" : "Bewaren"}
          </Button>

          {state.error ? (
            <p className="sm:col-span-3 text-sm text-[var(--color-negative)]">
              {state.error}
            </p>
          ) : null}
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          Een budget telt alle eenmalige kosten met die naam. Bestaat de categorie al,
          dan vervangt dit het bedrag.
        </p>
      </Card>

      <Card className="overflow-hidden">
        {budgets.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Nog geen budgetten. Stel er een in om te zien hoeveel je in {monthLabel} nog
            kunt uitgeven.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {budgets.map((b) => (
              <li key={b.id} className="px-4 py-3">
                <BudgetMeter budget={b}>
                  <div className="-mr-2 flex items-center">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Budget ${b.name} aanpassen`}
                      onClick={() => edit(b)}
                    >
                      <Pencil />
                    </Button>
                    <form action={deleteBudget}>
                      <input type="hidden" name="id" value={b.id} />
                      <Button
                        type="submit"
                        size="icon"
                        variant="ghost"
                        aria-label={`Budget ${b.name} verwijderen`}
                      >
                        <Trash2 />
                      </Button>
                    </form>
                  </div>
                </BudgetMeter>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

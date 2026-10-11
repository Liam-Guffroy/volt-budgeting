"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FREQUENCY_KEYS } from "@/lib/budget";
import type { QuickAdd } from "@/lib/quick-adds";
import { addExpense, type FormState } from "./actions";
import { FrequencySelect } from "./frequency-select";
import { QuickAddBar } from "./quick-add-bar";

const initial: FormState = {};

/**
 * Adds a recurring cost. A quick-add fills the name and picks its frequency —
 * the user still sets the amount and can change the frequency in the dropdown
 * before adding.
 */
export function ExpenseForm({ quickAdds }: { quickAdds: QuickAdd[] }) {
  const [state, formAction, pending] = useActionState(addExpense, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  function frequencySelect(): HTMLSelectElement | null {
    const el = formRef.current?.elements.namedItem("frequency");
    return el instanceof HTMLSelectElement ? el : null;
  }

  function applyQuickAdd(item: QuickAdd) {
    if (nameRef.current) nameRef.current.value = item.name;
    const select = frequencySelect();
    if (select && item.frequency) select.value = item.frequency;
    amountRef.current?.focus();
  }

  function draft() {
    const value = frequencySelect()?.value;
    const frequency = FREQUENCY_KEYS.find((k) => k === value);
    return { name: nameRef.current?.value.trim() ?? "", frequency };
  }

  return (
    <div className="space-y-4">
      <QuickAddBar
        kind="recurring"
        items={quickAdds}
        onApply={applyQuickAdd}
        getDraft={draft}
      />

      <form
        ref={formRef}
        action={formAction}
        className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem_10rem_auto] sm:items-end"
      >
        <div className="space-y-2">
          <Label htmlFor="name">Naam</Label>
          <Input ref={nameRef} id="name" name="name" placeholder="bv. Huur" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Bedrag</Label>
          <Input
            ref={amountRef}
            id="amount"
            name="amount"
            inputMode="decimal"
            placeholder="0,00"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="frequency">Frequentie</Label>
          <FrequencySelect id="frequency" name="frequency" />
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Bezig…" : "Toevoegen"}
        </Button>

        {state.error ? (
          <p className="sm:col-span-4 text-sm text-[var(--color-negative)]">
            {state.error}
          </p>
        ) : null}
      </form>
    </div>
  );
}

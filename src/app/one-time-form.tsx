"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MonthKey } from "@/lib/month";
import type { QuickAdd, QuickAddSet } from "@/lib/quick-adds";
import type { FormState } from "./actions";
import { QuickAddBar } from "./quick-add-bar";

const initial: FormState = {};

/**
 * Adds a one-off entry (cost or income) to the month currently being viewed.
 *
 * Shared by both one-time sections; the server action, quick-adds and
 * placeholder are what differ. Quick-adds carry no frequency — a one-off
 * belongs to a single month — so a click just fills the name and drops you in
 * the amount field. The same one can be used repeatedly (several shops a month).
 *
 * `idPrefix` keeps element ids unique, since two of these forms share a page.
 */
export function OneTimeForm({
  month,
  action,
  quickAdds,
  placeholder,
  idPrefix,
}: {
  month: MonthKey;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  quickAdds: QuickAddSet;
  placeholder: string;
  idPrefix: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  function applyQuickAdd(item: QuickAdd) {
    if (nameRef.current) nameRef.current.value = item.name;
    amountRef.current?.focus();
  }

  const nameId = `${idPrefix}-name`;
  const amountId = `${idPrefix}-amount`;

  return (
    <div className="space-y-4">
      <QuickAddBar
        quickAdds={quickAdds}
        onApply={applyQuickAdd}
        getDraft={() => ({ name: nameRef.current?.value.trim() ?? "" })}
      />

      <form
        ref={formRef}
        action={formAction}
        className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end"
      >
        {/* The viewed month travels with the submission, so an entry always
            lands in the month you were looking at. */}
        <input type="hidden" name="month" value={month} />

        <div className="space-y-2">
          <Label htmlFor={nameId}>Naam</Label>
          <Input ref={nameRef} id={nameId} name="name" placeholder={placeholder} />
        </div>

        <div className="space-y-2">
          <Label htmlFor={amountId}>Bedrag</Label>
          <Input
            ref={amountRef}
            id={amountId}
            name="amount"
            inputMode="decimal"
            placeholder="0,00"
          />
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Bezig…" : "Toevoegen"}
        </Button>

        {state.error ? (
          <p className="sm:col-span-3 text-sm text-[var(--color-negative)]">
            {state.error}
          </p>
        ) : null}
      </form>
    </div>
  );
}

"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DayKey } from "@/lib/month";
import type { QuickAdd, QuickAddSet } from "@/lib/quick-adds";
import type { FormState } from "./actions";
import { QuickAddBar } from "./quick-add-bar";

const initial: FormState = {};

/**
 * Adds a one-off entry (cost or income) on a chosen day of the month currently
 * being viewed.
 *
 * Shared by both one-time sections; the server action, quick-adds and
 * placeholder are what differ. Quick-adds carry no frequency — a one-off
 * belongs to a single month — so a click just fills the name and drops you in
 * the amount field. The same one can be used repeatedly (several shops a month).
 *
 * The date starts on today (or the nearest day of the viewed month) and is
 * limited to the viewed month, so an entry can't vanish into a month you're
 * not looking at. It snaps back to that default after each add.
 *
 * `idPrefix` keeps element ids unique, since two of these forms share a page.
 */
export function OneTimeForm({
  dates,
  action,
  quickAdds,
  placeholder,
  idPrefix,
}: {
  dates: { default: DayKey; min: DayKey; max: DayKey };
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
  const dateId = `${idPrefix}-date`;

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
        className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_7rem_9.5rem_auto] sm:items-end"
      >
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

        <div className="space-y-2">
          <Label htmlFor={dateId}>Datum</Label>
          {/* `key` remounts the input when the default changes (another
              month viewed), since defaultValue only applies on mount. */}
          <Input
            key={dates.default}
            id={dateId}
            name="date"
            type="date"
            required
            defaultValue={dates.default}
            min={dates.min}
            max={dates.max}
          />
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

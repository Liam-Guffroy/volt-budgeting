"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setReserveBalance, type FormState } from "./actions";

const initial: FormState = {};

/** One field: what is actually set aside for non-monthly bills right now. */
export function ReserveBalanceForm({ defaultValue }: { defaultValue: string }) {
  const [state, formAction, pending] = useActionState(setReserveBalance, initial);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="min-w-[8rem] flex-1 space-y-1.5">
        <label htmlFor="reserveBalance" className="text-sm text-muted-foreground">
          Wat staat er nu opzij?
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            €
          </span>
          <Input
            id="reserveBalance"
            name="reserveBalance"
            inputMode="decimal"
            defaultValue={defaultValue}
            placeholder="0,00"
            className="pl-7"
          />
        </div>
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Bezig…" : "Opslaan"}
      </Button>
      {state.error ? (
        <p className="w-full text-sm text-[var(--color-negative)]">{state.error}</p>
      ) : null}
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setIncome, type FormState } from "./actions";

const initial: FormState = {};

export function IncomeForm({ defaultValue }: { defaultValue: string }) {
  const [state, formAction, pending] = useActionState(setIncome, initial);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[12rem] space-y-2">
        {/* The section heading already says this visibly; keep the label for
            screen readers. */}
        <label htmlFor="monthlyIncome" className="sr-only">
          Maandelijks netto-inkomen
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            €
          </span>
          <Input
            id="monthlyIncome"
            name="monthlyIncome"
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
      ) : state.ok ? (
        <p className="w-full text-sm text-primary">Opgeslagen.</p>
      ) : null}
    </form>
  );
}

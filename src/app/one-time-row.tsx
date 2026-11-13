"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OneTimeEntry } from "@/lib/budget";
import { formatDay, formatEUR } from "@/lib/format";
import type { DayKey } from "@/lib/month";
import { cn } from "@/lib/utils";
import type { FormState } from "./actions";

/** A one-off entry plus its day — the date is display-only for the math. */
export type DatedOneTimeEntry = OneTimeEntry & { date: DayKey };

const initial: FormState = {};

/** "12.5" -> "12,5" for the editable amount field. */
function toInput(amount: number): string {
  return String(amount).replace(".", ",");
}

/**
 * One-off cost or income row, with inline edit (name, amount, date) like the
 * recurring rows. Income is shown with a leading "+" in the positive colour so
 * the two lists can't be confused at a glance. The date stays within the month
 * being viewed, so an edited entry doesn't vanish from the list.
 */
export function OneTimeRow({
  entry,
  updateAction,
  deleteAction,
  variant,
  dates,
}: {
  entry: DatedOneTimeEntry;
  updateAction: (prev: FormState, formData: FormData) => Promise<FormState>;
  deleteAction: (formData: FormData) => Promise<void>;
  variant: "expense" | "income";
  dates: { min: DayKey; max: DayKey };
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateAction, initial);
  const income = variant === "income";

  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state]);

  if (editing) {
    return (
      <li className="px-4 py-3">
        <form
          action={formAction}
          className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_7rem_9.5rem_auto] sm:items-center"
        >
          <input type="hidden" name="id" value={entry.id} />
          <Input name="name" defaultValue={entry.name} aria-label="Naam" />
          <Input
            name="amount"
            inputMode="decimal"
            defaultValue={toInput(entry.amount)}
            aria-label="Bedrag"
          />
          <Input
            name="date"
            type="date"
            required
            defaultValue={entry.date}
            min={dates.min}
            max={dates.max}
            aria-label="Datum"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "…" : "Bewaren"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
            >
              Annuleer
            </Button>
          </div>
          {state.error ? (
            <p className="sm:col-span-4 text-sm text-[var(--color-negative)]">
              {state.error}
            </p>
          ) : null}
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{entry.name}</p>
        <p className="text-xs text-muted-foreground">
          <time dateTime={entry.date}>{formatDay(entry.date)}</time>
        </p>
      </div>

      <p
        className={cn(
          "tabular-nums font-medium",
          income && "text-[var(--color-positive)]",
        )}
      >
        {income ? "+ " : ""}
        {formatEUR(entry.amount)}
      </p>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Bewerken"
          onClick={() => setEditing(true)}
        >
          <Pencil />
        </Button>
        <form action={deleteAction}>
          <input type="hidden" name="id" value={entry.id} />
          <Button type="submit" size="icon" variant="ghost" aria-label="Verwijderen">
            <Trash2 />
          </Button>
        </form>
      </div>
    </li>
  );
}

"use client";

import { useActionState, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { frequencyLabel, type NormalizedExpense } from "@/lib/budget";
import { formatEUR } from "@/lib/format";
import {
  deleteExpense,
  moveExpense,
  updateExpense,
  type FormState,
} from "./actions";
import { FrequencySelect } from "./frequency-select";

const initial: FormState = {};

/** "12.5" -> "12,5" for the editable amount field. */
function toInput(amount: number): string {
  return String(amount).replace(".", ",");
}

/** One up/down arrow, submitting a move for this expense. */
function MoveButton({
  id,
  direction,
  disabled,
}: {
  id: number;
  direction: "up" | "down";
  disabled: boolean;
}) {
  const up = direction === "up";
  return (
    <form action={moveExpense}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direction" value={direction} />
      <Button
        type="submit"
        size="icon"
        variant="ghost"
        className="h-6 w-6"
        disabled={disabled}
        aria-label={up ? "Omhoog verplaatsen" : "Omlaag verplaatsen"}
      >
        {up ? <ChevronUp /> : <ChevronDown />}
      </Button>
    </form>
  );
}

export function ExpenseRow({
  expense,
  isFirst,
  isLast,
  dueLabel,
}: {
  expense: NormalizedExpense;
  isFirst: boolean;
  isLast: boolean;
  /** "vervalt 15 mrt" for a non-monthly bill with a due date; worked out on the server. */
  dueLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateExpense, initial);

  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state]);

  if (editing) {
    return (
      <li className="px-4 py-3">
        <form
          action={formAction}
          className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem_10rem_auto] sm:items-center"
        >
          <input type="hidden" name="id" value={expense.id} />
          <Input name="name" defaultValue={expense.name} aria-label="Naam" />
          <Input
            name="amount"
            inputMode="decimal"
            defaultValue={toInput(expense.amount)}
            aria-label="Bedrag"
          />
          <FrequencySelect name="frequency" defaultValue={expense.frequency} />
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:col-span-4">
            <label
              htmlFor={`next-due-${expense.id}`}
              className="text-sm text-muted-foreground"
            >
              Volgende vervaldag
            </label>
            <Input
              id={`next-due-${expense.id}`}
              name="nextDue"
              type="date"
              defaultValue={expense.nextDue ?? ""}
              className="w-auto"
            />
            <span className="text-xs text-muted-foreground">
              optioneel — alleen voor kosten die niet elke maand komen
            </span>
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
      <div className="flex flex-col gap-0.5">
        <MoveButton id={expense.id} direction="up" disabled={isFirst} />
        <MoveButton id={expense.id} direction="down" disabled={isLast} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{expense.name}</p>
        <p className="text-sm text-muted-foreground">
          {formatEUR(expense.amount)} · {frequencyLabel(expense.frequency)}
          {dueLabel ? ` · ${dueLabel}` : ""}
        </p>
      </div>

      <div className="text-right">
        <p className="tabular-nums font-medium">{formatEUR(expense.monthly)}</p>
        <p className="text-xs text-muted-foreground">per maand</p>
      </div>

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
        <form action={deleteExpense}>
          <input type="hidden" name="id" value={expense.id} />
          <Button type="submit" size="icon" variant="ghost" aria-label="Verwijderen">
            <Trash2 />
          </Button>
        </form>
      </div>
    </li>
  );
}

"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { frequencyLabel, type Frequency } from "@/lib/budget";
import type { QuickAdd, QuickAddKind } from "@/lib/quick-adds";
import { addQuickAdd, deleteQuickAdd, type FormState } from "./actions";
import { FrequencySelect } from "./frequency-select";

/** What's currently typed in the entry form, used to prefill a new button. */
export interface QuickAddDraft {
  name: string;
  frequency?: Frequency;
}

/**
 * The "Snel toevoegen" row: built-in buttons, then the account's own (each
 * with an × to remove it), then "+ Eigen" to save a new one.
 *
 * Shared by the one-time cost, one-time income and recurring cost forms; only
 * recurring buttons carry a frequency.
 */
export function QuickAddBar({
  kind,
  items,
  onApply,
  getDraft,
}: {
  kind: QuickAddKind;
  items: QuickAdd[];
  onApply: (item: QuickAdd) => void;
  getDraft: () => QuickAddDraft;
}) {
  // null = the add form is closed; otherwise what to prefill it with.
  const [draft, setDraft] = useState<QuickAddDraft | null>(null);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Snel toevoegen</p>

      <div className="flex flex-wrap gap-2">
        {items.map((item) =>
          item.customId === undefined ? (
            <Button
              key={`built-in-${item.name}`}
              type="button"
              variant="outline"
              size="sm"
              title={item.frequency ? frequencyLabel(item.frequency) : undefined}
              onClick={() => onApply(item)}
            >
              {item.name}
            </Button>
          ) : (
            <CustomChip key={`custom-${item.customId}`} item={item} onApply={onApply} />
          ),
        )}

        {draft === null ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="border border-dashed border-border text-muted-foreground"
            onClick={() => setDraft(getDraft())}
          >
            <Plus />
            Eigen
          </Button>
        ) : null}
      </div>

      {draft !== null ? (
        <AddQuickAddForm kind={kind} draft={draft} onDone={() => setDraft(null)} />
      ) : null}
    </div>
  );
}

/** An account's own button: click the label to use it, × to remove it. */
function CustomChip({
  item,
  onApply,
}: {
  item: QuickAdd;
  onApply: (item: QuickAdd) => void;
}) {
  return (
    <span className="inline-flex h-9 items-stretch rounded-lg border border-border bg-card text-sm font-medium">
      <button
        type="button"
        title={item.frequency ? frequencyLabel(item.frequency) : undefined}
        onClick={() => onApply(item)}
        className="rounded-l-lg pl-3 pr-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {item.name}
      </button>
      <form action={deleteQuickAdd} className="flex">
        <input type="hidden" name="id" value={item.customId} />
        <button
          type="submit"
          aria-label={`Snelknop ${item.name} verwijderen`}
          title="Verwijderen"
          className="flex items-center rounded-r-lg pl-1 pr-2 text-muted-foreground transition-colors hover:bg-muted hover:text-[var(--color-negative)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" />
        </button>
      </form>
    </span>
  );
}

const initial: FormState = {};

/**
 * Inline form for a new button. Mounted fresh each time it opens, so its
 * action state — and any old error message — starts clean.
 */
function AddQuickAddForm({
  kind,
  draft,
  onDone,
}: {
  kind: QuickAddKind;
  draft: QuickAddDraft;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(addQuickAdd, initial);
  const recurring = kind === "recurring";
  const nameId = `${kind}-quick-add-name`;

  useEffect(() => {
    if (state.ok) onDone();
  }, [state]);

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-3"
    >
      <input type="hidden" name="kind" value={kind} />

      <label htmlFor={nameId} className="sr-only">
        Naam van de snelknop
      </label>
      <Input
        id={nameId}
        name="name"
        defaultValue={draft.name}
        placeholder="Naam van je snelknop"
        maxLength={40}
        autoFocus
        className="h-9 min-w-[10rem] flex-1"
      />

      {recurring ? (
        <FrequencySelect
          name="frequency"
          defaultValue={draft.frequency ?? "monthly"}
          className="h-9 w-auto"
        />
      ) : null}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "…" : "Bewaren"}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onDone}>
        Annuleer
      </Button>

      {state.error ? (
        <p className="w-full text-sm text-[var(--color-negative)]">{state.error}</p>
      ) : null}
    </form>
  );
}

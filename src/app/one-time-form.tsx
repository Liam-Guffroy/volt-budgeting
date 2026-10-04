"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MonthKey } from "@/lib/month";
import type { FormState } from "./actions";

const initial: FormState = {};

/**
 * Adds a one-off entry (cost or income) to the month currently being viewed.
 *
 * Shared by both one-time sections; the server action, presets and placeholder
 * are what differ. Presets carry no frequency — a one-off belongs to a single
 * month — so a click just fills the name and drops you in the amount field. The
 * same preset can be used repeatedly (several shops a month).
 *
 * `idPrefix` keeps element ids unique, since two of these forms share a page.
 */
export function OneTimeForm({
  month,
  action,
  presets,
  placeholder,
  idPrefix,
}: {
  month: MonthKey;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  presets: string[];
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

  function applyPreset(name: string) {
    if (nameRef.current) nameRef.current.value = name;
    amountRef.current?.focus();
  }

  const nameId = `${idPrefix}-name`;
  const amountId = `${idPrefix}-amount`;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Snel toevoegen</p>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <Button
              key={preset}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyPreset(preset)}
            >
              {preset}
            </Button>
          ))}
        </div>
      </div>

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

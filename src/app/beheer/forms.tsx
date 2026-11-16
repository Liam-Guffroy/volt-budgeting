"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  createAccount,
  createHousehold,
  resetPassword,
  setHousehold,
  type AdminFormState,
} from "./actions";

const initial: AdminFormState = {};

function Feedback({ state }: { state: AdminFormState }) {
  return state.error ? (
    <p role="alert" className="w-full text-sm text-[var(--color-negative)]">
      {state.error}
    </p>
  ) : state.ok ? (
    <p role="status" className="w-full text-sm text-primary">
      {state.ok}
    </p>
  ) : null;
}

// Passwords here are typed by the admin to hand to someone else, so they're
// shown as plain text: you need to read back what you're about to pass on.
// The attributes keep browsers from offering to save or fill them in.
const passwordProps = {
  type: "text",
  autoComplete: "off",
  autoCapitalize: "none",
  autoCorrect: "off",
  spellCheck: false,
} as const;

export function CreateAccountForm() {
  const [state, formAction, pending] = useActionState(createAccount, initial);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[10rem] flex-1 space-y-2">
        <Label htmlFor="new-account-name">Naam</Label>
        <Input
          id="new-account-name"
          name="name"
          defaultValue={state.name ?? ""}
          autoComplete="off"
          maxLength={40}
          placeholder="Bv. Kelly"
        />
      </div>
      <div className="min-w-[10rem] flex-1 space-y-2">
        <Label htmlFor="new-account-password">Wachtwoord</Label>
        <Input id="new-account-password" name="password" {...passwordProps} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Bezig…" : "Account maken"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export function ResetPasswordForm({ id, name }: { id: number; name: string }) {
  const [state, formAction, pending] = useActionState(resetPassword, initial);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="id" value={id} />
      <div className="min-w-[10rem] flex-1 space-y-2">
        <Label htmlFor={`password-${id}`}>Nieuw wachtwoord voor {name}</Label>
        <Input id={`password-${id}`} name="password" autoFocus {...passwordProps} />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Bezig…" : "Wijzigen"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export function CreateHouseholdForm() {
  const [state, formAction, pending] = useActionState(createHousehold, initial);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[10rem] flex-1 space-y-2">
        <Label htmlFor="new-household-name">Nieuw huishouden</Label>
        <Input
          id="new-household-name"
          name="name"
          defaultValue={state.name ?? ""}
          autoComplete="off"
          maxLength={40}
          placeholder="Bv. Thuis"
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Bezig…" : "Toevoegen"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

/** Which household an account is in. Saves as soon as you pick one. */
export function HouseholdSelect({
  id,
  name,
  householdId,
  households,
}: {
  id: number;
  name: string;
  householdId: number | null;
  households: { id: number; name: string }[];
}) {
  return (
    <form action={setHousehold}>
      <input type="hidden" name="id" value={id} />
      <label htmlFor={`household-${id}`} className="sr-only">
        Huishouden van {name}
      </label>
      <select
        id={`household-${id}`}
        name="householdId"
        // Keyed on the saved value below, so the select always shows what the
        // server has — also right after a change.
        key={householdId ?? "none"}
        defaultValue={householdId ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={cn(
          "h-9 max-w-[11rem] rounded-lg border border-border bg-card px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          householdId === null && "text-muted-foreground",
        )}
      >
        <option value="">Geen huishouden</option>
        {households.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </select>
    </form>
  );
}

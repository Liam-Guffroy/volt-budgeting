import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OneTimeEntry } from "@/lib/budget";
import { formatDay, formatEUR } from "@/lib/format";
import type { DayKey } from "@/lib/month";
import { cn } from "@/lib/utils";

/** A one-off entry plus its day — the date is display-only for the math. */
export type DatedOneTimeEntry = OneTimeEntry & { date: DayKey };

/**
 * One-off cost or income row. Server component — delete is a plain form
 * action. Income is shown with a leading "+" in the positive colour so the two
 * lists can't be confused at a glance. The small date under the name is the
 * entry's day.
 */
export function OneTimeRow({
  entry,
  deleteAction,
  variant,
}: {
  entry: DatedOneTimeEntry;
  deleteAction: (formData: FormData) => Promise<void>;
  variant: "expense" | "income";
}) {
  const income = variant === "income";

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

      <form action={deleteAction}>
        <input type="hidden" name="id" value={entry.id} />
        <Button type="submit" size="icon" variant="ghost" aria-label="Verwijderen">
          <Trash2 />
        </Button>
      </form>
    </li>
  );
}

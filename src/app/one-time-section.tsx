import { Card } from "@/components/ui/card";
import { formatEUR } from "@/lib/format";
import { defaultDayFor, monthBounds, type MonthKey } from "@/lib/month";
import type { QuickAddSet } from "@/lib/quick-adds";
import { cn } from "@/lib/utils";
import type { FormState } from "./actions";
import { OneTimeForm } from "./one-time-form";
import { OneTimeRow, type DatedOneTimeEntry } from "./one-time-row";

/**
 * Body of a one-time section: add form, then the month's entries with a total.
 * Rendered once for one-off costs and once for one-off income.
 */
export function OneTimeSection({
  month,
  monthLabel,
  entries,
  total,
  addAction,
  deleteAction,
  quickAdds,
  placeholder,
  idPrefix,
  variant,
  emptyText,
  totalLabel,
}: {
  month: MonthKey;
  monthLabel: string;
  entries: DatedOneTimeEntry[];
  total: number;
  addAction: (prev: FormState, formData: FormData) => Promise<FormState>;
  deleteAction: (formData: FormData) => Promise<void>;
  quickAdds: QuickAddSet;
  placeholder: string;
  idPrefix: string;
  variant: "expense" | "income";
  emptyText: string;
  totalLabel: string;
}) {
  const { first, last } = monthBounds(month);

  return (
    <>
      <Card className="p-6">
        <OneTimeForm
          dates={{ default: defaultDayFor(month), min: first, max: last }}
          action={addAction}
          quickAdds={quickAdds}
          placeholder={placeholder}
          idPrefix={idPrefix}
        />
      </Card>

      <Card className="overflow-hidden">
        {entries.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            {emptyText} in {monthLabel}.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((e) => (
              <OneTimeRow
                key={e.id}
                entry={e}
                deleteAction={deleteAction}
                variant={variant}
              />
            ))}
            <li className="flex items-center justify-between bg-muted px-4 py-3">
              <p className="font-medium">{totalLabel}</p>
              <p
                className={cn(
                  "tabular-nums font-semibold",
                  variant === "income" && "text-[var(--color-positive)]",
                )}
              >
                {variant === "income" ? "+ " : ""}
                {formatEUR(total)}
              </p>
            </li>
          </ul>
        )}
      </Card>
    </>
  );
}

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatEUR } from "@/lib/format";
import type { ListSort, SortableList } from "@/lib/list-sort";
import { defaultDayFor, monthBounds, type MonthKey } from "@/lib/month";
import type { QuickAddSet } from "@/lib/quick-adds";
import { cn } from "@/lib/utils";
import { setListSort, type FormState } from "./actions";
import { OneTimeForm } from "./one-time-form";
import { OneTimeRow, type DatedOneTimeEntry } from "./one-time-row";

const ORDERS: { value: ListSort; label: string }[] = [
  { value: "newest", label: "Nieuwste eerst" },
  { value: "oldest", label: "Oudste eerst" },
];

/**
 * Body of a one-time section: add form, then the month's entries with a total.
 * Rendered once for one-off costs and once for one-off income. `entries`
 * arrive already sorted (the query orders them); the toolbar only picks which
 * order the next render uses.
 */
export function OneTimeSection({
  listId,
  sort,
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
  listId: SortableList;
  sort: ListSort;
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
          <>
            {entries.length > 1 ? (
              <SortBar listId={listId} sort={sort} count={entries.length} />
            ) : null}
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
          </>
        )}
      </Card>
    </>
  );
}

/** Entry count plus a two-way order choice; each option is a plain form post. */
function SortBar({
  listId,
  sort,
  count,
}: {
  listId: SortableList;
  sort: ListSort;
  count: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
      <p className="text-xs text-muted-foreground">{count} posten</p>
      <div role="group" aria-label="Volgorde" className="flex gap-1">
        {ORDERS.map((o) => (
          <form key={o.value} action={setListSort}>
            <input type="hidden" name="list" value={listId} />
            <input type="hidden" name="order" value={o.value} />
            <Button
              type="submit"
              size="sm"
              variant={sort === o.value ? "outline" : "ghost"}
              aria-pressed={sort === o.value}
              className="h-7 px-2 text-xs"
            >
              {o.label}
            </Button>
          </form>
        ))}
      </div>
    </div>
  );
}

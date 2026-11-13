import Link from "next/link";
import { Download, Search } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDay, formatEUR } from "@/lib/format";
import { formatMonth } from "@/lib/month";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { AppHeader } from "../app-header";
import { ENTRY_KINDS, searchEntries, toEntryKind, type EntryKind } from "./search";

export const metadata = { title: "Zoeken — Vlot" };

/** More than this and the page shows the newest ones; the export still has all. */
const LIMIT = 300;

const KIND_LABELS: Record<EntryKind, string> = {
  alle: "Kosten en inkomsten",
  kosten: "Alleen kosten",
  inkomsten: "Alleen inkomsten",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; soort?: string }>;
}) {
  const userId = await requireUser();
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 120);
  const kind = toEntryKind(params.soort);

  const found = await searchEntries(userId, q, kind);
  const shown = found.slice(0, LIMIT);
  const costs = found.filter((e) => e.kind === "kosten");
  const incomes = found.filter((e) => e.kind === "inkomsten");
  const sum = (list: typeof found) => list.reduce((t, e) => t + e.amount, 0);

  const exportQuery = new URLSearchParams({ soort: "eenmalig", type: kind });
  if (q) exportQuery.set("q", q);

  // Entries grouped under their month, in the order they come (newest first).
  const months: { month: string; entries: typeof shown }[] = [];
  for (const e of shown) {
    const month = e.date.slice(0, 7);
    const last = months[months.length - 1];
    if (last?.month === month) last.entries.push(e);
    else months.push({ month, entries: [e] });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <AppHeader active="zoeken" />

      <div className="space-y-6">
        <Card className="p-6">
          <form
            action="/zoeken"
            className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end"
          >
            <div className="space-y-2">
              <Label htmlFor="q">Zoek op naam</Label>
              <Input
                id="q"
                name="q"
                type="search"
                defaultValue={q}
                placeholder="bv. Boodschappen"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="soort">Soort</Label>
              <select
                id="soort"
                name="soort"
                defaultValue={kind}
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {ENTRY_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit">
              <Search />
              Zoeken
            </Button>
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {found.length} {found.length === 1 ? "post" : "posten"}
              </span>
              {costs.length > 0 ? ` · kosten ${formatEUR(sum(costs))}` : ""}
              {incomes.length > 0 ? ` · inkomsten ${formatEUR(sum(incomes))}` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              {/* Plain links, not <Link>: these download a file. */}
              <a
                href={`/export?${exportQuery}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <Download />
                Deze lijst (CSV)
              </a>
              <a
                href="/export?soort=vast"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <Download />
                Vaste kosten (CSV)
              </a>
            </div>
          </div>
        </Card>

        {found.length === 0 ? (
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">
              {q
                ? `Geen eenmalige posten gevonden voor “${q}”.`
                : "Nog geen eenmalige kosten of inkomsten ingevoerd."}
            </p>
          </Card>
        ) : (
          months.map(({ month, entries }) => (
            <section key={month}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h2 className="font-medium">{formatMonth(month)}</h2>
                <Link
                  href={`/?month=${month}`}
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Open in planner
                </Link>
              </div>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-border">
                  {entries.map((e) => (
                    <li key={`${e.kind}-${e.id}`} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{e.name}</p>
                        <p className="text-xs text-muted-foreground">
                          <time dateTime={e.date}>{formatDay(e.date)}</time>
                          {" · "}
                          {e.kind === "kosten" ? "eenmalige kost" : "eenmalig inkomen"}
                        </p>
                      </div>
                      <p
                        className={cn(
                          "tabular-nums font-medium",
                          e.kind === "inkomsten" && "text-[var(--color-positive)]",
                        )}
                      >
                        {e.kind === "inkomsten" ? "+ " : ""}
                        {formatEUR(e.amount)}
                      </p>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ))
        )}

        {found.length > LIMIT ? (
          <p className="text-sm text-muted-foreground">
            De nieuwste {LIMIT} van {found.length} posten worden getoond. Verfijn je
            zoekopdracht, of exporteer de lijst om alles te zien.
          </p>
        ) : null}
      </div>
    </div>
  );
}

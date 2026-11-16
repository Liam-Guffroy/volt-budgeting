import Link from "next/link";
import { asc, count, eq, sql } from "drizzle-orm";
import { X } from "lucide-react";
import { db } from "@/db";
import {
  expenses,
  households as householdsTable,
  oneTimeExpenses,
  oneTimeIncomes,
  users,
} from "@/db/schema";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDay } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";
import { AppHeader } from "../app-header";
import { Heading } from "../statistieken/parts";
import { deleteAccount, deleteHousehold } from "./actions";
import {
  CreateAccountForm,
  CreateHouseholdForm,
  HouseholdSelect,
  ResetPasswordForm,
} from "./forms";

export const metadata = { title: "Beheer — Vlot" };

const toId = (value: string | undefined) =>
  value && /^\d+$/.test(value) ? Number(value) : null;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Admin page: accounts (create, new password, delete) and households. The two
 * per-account panels open from the URL (?wachtwoord=<id>, ?verwijder=<id>), so
 * deleting is always two deliberate steps and nothing needs client state.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ wachtwoord?: string; verwijder?: string }>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;

  const [accounts, households] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        isAdmin: users.isAdmin,
        householdId: users.householdId,
        // created_at holds the database's UTC clock time; resolve it to an
        // instant, then take the day in Belgian time.
        createdDay: sql<string>`to_char((${users.createdAt} at time zone current_setting('TimeZone')) at time zone 'Europe/Brussels', 'YYYY-MM-DD')`,
      })
      .from(users)
      .orderBy(asc(users.name)),
    db.select().from(householdsTable).orderBy(asc(householdsTable.name)),
  ]);

  // An id that isn't an account (or is your own, for deleting) opens nothing.
  const passwordFor = accounts.find((a) => a.id === toId(params.wachtwoord)) ?? null;
  const deleting =
    accounts.find((a) => a.id === toId(params.verwijder) && a.id !== admin.id) ?? null;

  // What deleting would take with it — shown in the confirmation.
  const contents = deleting
    ? await Promise.all(
        [expenses, oneTimeExpenses, oneTimeIncomes].map((table) =>
          db
            .select({ n: count() })
            .from(table)
            .where(eq(table.userId, deleting.id))
            .then((rows) => rows[0]?.n ?? 0),
        ),
      )
    : null;

  const membersOf = (householdId: number) =>
    accounts.filter((a) => a.householdId === householdId).map((a) => a.name);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <AppHeader active="beheer" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-6">
          <Card className="p-6">
            <Heading
              title="Accounts"
              description="Wie kan inloggen. Kies bij elk account het huishouden waarmee het de pagina Samen deelt."
            />
            <ul className="divide-y divide-border border-y border-border">
              {accounts.map((a) => (
                <li key={a.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                    <div className="min-w-[8rem] flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 font-medium">
                        <span className="truncate">{a.name}</span>
                        {a.isAdmin ? <Badge>beheerder</Badge> : null}
                        {a.id === admin.id ? <Badge>jij</Badge> : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        sinds {formatDay(a.createdDay)}
                      </p>
                    </div>

                    {households.length > 0 ? (
                      <HouseholdSelect
                        id={a.id}
                        name={a.name}
                        householdId={a.householdId}
                        households={households}
                      />
                    ) : null}
                    {/* On a phone the two links get their own line, pulled left
                        so their text lines up with the name above. */}
                    <div className="-ml-3 flex basis-full gap-1 sm:ml-0 sm:basis-auto">
                      <Link
                        href={passwordFor?.id === a.id ? "/beheer" : `/beheer?wachtwoord=${a.id}`}
                        scroll={false}
                        aria-expanded={passwordFor?.id === a.id}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                      >
                        Wachtwoord
                      </Link>
                      {a.id === admin.id ? null : (
                        <Link
                          href={deleting?.id === a.id ? "/beheer" : `/beheer?verwijder=${a.id}`}
                          scroll={false}
                          aria-expanded={deleting?.id === a.id}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "sm" }),
                            "text-[var(--color-negative)]",
                          )}
                        >
                          Verwijderen
                        </Link>
                      )}
                    </div>
                  </div>

                  {passwordFor?.id === a.id ? (
                    <div className="mt-3 rounded-lg border border-border p-3">
                      <ResetPasswordForm id={a.id} name={a.name} />
                      <p className="mt-2 text-xs text-muted-foreground">
                        Het oude wachtwoord werkt daarna niet meer. Wie al ingelogd is, blijft
                        ingelogd.
                      </p>
                    </div>
                  ) : null}

                  {deleting?.id === a.id && contents ? (
                    <div className="mt-3 rounded-lg border border-[var(--color-negative)]/50 p-3">
                      <p className="text-sm font-medium">{a.name} verwijderen?</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Dit wist het account en alles wat erin zit:{" "}
                        {plural(contents[0], "terugkerende kost", "terugkerende kosten")},{" "}
                        {plural(contents[1], "eenmalige kost", "eenmalige kosten")} en{" "}
                        {plural(contents[2], "eenmalig inkomen", "eenmalige inkomsten")}, plus
                        budgetten en instellingen. Dit kan niet ongedaan worden gemaakt.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <form action={deleteAccount}>
                          <input type="hidden" name="id" value={a.id} />
                          <Button
                            type="submit"
                            size="sm"
                            variant="outline"
                            className="border-[var(--color-negative)] text-[var(--color-negative)] hover:bg-[var(--color-negative)]/10"
                          >
                            Definitief verwijderen
                          </Button>
                        </form>
                        <Link
                          href="/beheer"
                          scroll={false}
                          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                        >
                          Annuleren
                        </Link>
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-6">
            <Heading
              title="Nieuw account"
              description="Inloggen gaat met het wachtwoord alleen, dus elk account krijgt een eigen wachtwoord. Geef het daarna door; je kunt het later niet meer bekijken, alleen vervangen."
            />
            <CreateAccountForm />
          </Card>
        </div>

        <Card className="min-w-0 p-6 lg:self-start">
          <Heading
            title="Huishoudens"
            description="Accounts in hetzelfde huishouden krijgen de pagina Samen, met elkaars totalen — nooit elkaars losse uitgaven. Ze verschijnt vanaf twee leden."
          />
          {households.length === 0 ? (
            <p className="mb-5 text-sm text-muted-foreground">Nog geen huishoudens.</p>
          ) : (
            <ul className="mb-5 divide-y divide-border border-y border-border">
              {households.map((h) => {
                const members = membersOf(h.id);
                return (
                  <li key={h.id} className="flex items-center gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{h.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {members.length > 0 ? members.join(", ") : "nog geen leden"}
                      </p>
                    </div>
                    <form action={deleteHousehold}>
                      <input type="hidden" name="id" value={h.id} />
                      <Button
                        type="submit"
                        size="icon"
                        variant="ghost"
                        aria-label={`Huishouden ${h.name} verwijderen`}
                        title="Huishouden verwijderen (de accounts blijven bestaan)"
                      >
                        <X />
                      </Button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
          <CreateHouseholdForm />
          <p className="mt-3 text-xs text-muted-foreground">
            Een huishouden verwijderen koppelt alleen de leden los; hun accounts en gegevens
            blijven.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
      {children}
    </span>
  );
}

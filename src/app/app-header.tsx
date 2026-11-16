import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { householdOf } from "@/lib/household";
import { getAccount } from "@/lib/session";
import { cn } from "@/lib/utils";
import { logout } from "./actions";
import { ThemeToggle } from "./theme-toggle";

const PAGES = [
  { key: "planner", href: "/", label: "Planner" },
  { key: "statistieken", href: "/statistieken", label: "Statistieken" },
  { key: "jaar", href: "/jaar", label: "Jaar" },
  { key: "zoeken", href: "/zoeken", label: "Zoeken" },
  { key: "samen", href: "/samen", label: "Samen" },
  { key: "beheer", href: "/beheer", label: "Beheer" },
] as const;

type PageKey = (typeof PAGES)[number]["key"];

/**
 * Title, page navigation, theme toggle and logout — shared by every page.
 * "Samen" only appears for accounts that share a household with someone, and
 * "Beheer" only for admins (the page checks that itself as well).
 */
export async function AppHeader({ active }: { active: PageKey }) {
  const account = await getAccount();
  const inHousehold = account !== null && (await householdOf(account.id)) !== null;
  const pages = PAGES.filter((p) =>
    p.key === "samen"
      ? inHousehold || active === "samen"
      : p.key === "beheer"
        ? account?.isAdmin === true
        : true,
  );

  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">Vlot</h1>
        <p className="text-sm text-muted-foreground">
          Wat houd je over, en hoeveel zet je opzij?
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <nav aria-label="Pagina's" className="mr-1 flex flex-wrap items-center gap-1">
          {pages.map((page) => (
            <Link
              key={page.key}
              href={page.href}
              aria-current={page.key === active ? "page" : undefined}
              className={cn(
                buttonVariants({
                  variant: page.key === active ? "outline" : "ghost",
                  size: "sm",
                }),
              )}
            >
              {page.label}
            </Link>
          ))}
        </nav>
        <ThemeToggle />
        <form action={logout}>
          <Button type="submit" variant="ghost" size="sm">
            Uitloggen
          </Button>
        </form>
      </div>
    </header>
  );
}

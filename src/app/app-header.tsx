import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logout } from "./actions";
import { ThemeToggle } from "./theme-toggle";

const PAGES = [
  { key: "planner", href: "/", label: "Planner" },
  { key: "statistieken", href: "/statistieken", label: "Statistieken" },
] as const;

/** Title, page navigation, theme toggle and logout — shared by every page. */
export function AppHeader({ active }: { active: (typeof PAGES)[number]["key"] }) {
  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">Vlot</h1>
        <p className="text-sm text-muted-foreground">
          Wat houd je over, en hoeveel zet je opzij?
        </p>
      </div>

      <div className="flex items-center gap-1">
        <nav aria-label="Pagina's" className="mr-1 flex items-center gap-1">
          {PAGES.map((page) => (
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

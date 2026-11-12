import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { currentMonth, formatMonth, shiftMonth, type MonthKey } from "@/lib/month";
import { cn } from "@/lib/utils";

/**
 * Month switcher. Plain links (not client state) so each month is a real URL —
 * shareable, bookmarkable, and back/forward works. `basePath` is the page the
 * links stay on ("/" for the planner, "/statistieken" for the statistics).
 */
export function MonthNav({
  month,
  basePath = "/",
}: {
  month: MonthKey;
  basePath?: string;
}) {
  const isCurrent = month === currentMonth();

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`${basePath}?month=${shiftMonth(month, -1)}`}
        aria-label="Vorige maand"
        className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
      >
        <ChevronLeft />
      </Link>

      <p className="min-w-40 text-center font-medium tabular-nums">
        {formatMonth(month)}
      </p>

      <Link
        href={`${basePath}?month=${shiftMonth(month, 1)}`}
        aria-label="Volgende maand"
        className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
      >
        <ChevronRight />
      </Link>

      {isCurrent ? null : (
        <Link
          href={basePath}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          Deze maand
        </Link>
      )}
    </div>
  );
}

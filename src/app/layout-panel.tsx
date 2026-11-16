import Link from "next/link";
import { ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  SECTION_LABELS,
  isDefaultLayout,
  type PlannerLayout,
  type PlannerSection,
} from "@/lib/planner-layout";
import { cn } from "@/lib/utils";
import { updatePlannerLayout } from "./actions";

/** One small form post per button — no client state, like the other row controls. */
function LayoutButton({
  section,
  op,
  label,
  disabled,
  pressed,
  children,
}: {
  section: PlannerSection;
  op: "up" | "down" | "toggle";
  label: string;
  disabled?: boolean;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <form action={updatePlannerLayout}>
      <input type="hidden" name="op" value={op} />
      <input type="hidden" name="section" value={section} />
      <Button
        type="submit"
        size="icon"
        variant="ghost"
        aria-label={label}
        aria-pressed={pressed}
        title={label}
        disabled={disabled}
      >
        {children}
      </Button>
    </form>
  );
}

/**
 * Edit the planner's section layout: reorder with the arrows, hide or show
 * with the eye. Open while the URL has ?indeling=1, so every change keeps the
 * panel open and "Klaar" is just a link.
 */
export function LayoutPanel({
  layout,
  closeHref,
}: {
  layout: PlannerLayout;
  closeHref: string;
}) {
  const last = layout.order.length - 1;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">Indeling</h2>
          <p className="text-sm text-muted-foreground">
            Zet de onderdelen in je eigen volgorde, of verberg wat je niet gebruikt.
          </p>
        </div>
        <Link href={closeHref} className={cn(buttonVariants({ size: "sm" }))}>
          Klaar
        </Link>
      </div>

      <ol className="divide-y divide-border rounded-lg border border-border">
        {layout.order.map((section, i) => {
          const hidden = layout.hidden.includes(section);
          const label = SECTION_LABELS[section];
          return (
            <li key={section} className="flex items-center gap-1 py-1 pl-3 pr-1">
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-sm",
                  hidden ? "text-muted-foreground line-through" : "font-medium",
                )}
              >
                {label}
              </span>
              {hidden ? (
                <span className="mr-1 text-xs text-muted-foreground">verborgen</span>
              ) : null}
              <LayoutButton
                section={section}
                op="toggle"
                label={hidden ? `${label} tonen` : `${label} verbergen`}
                pressed={hidden}
              >
                {hidden ? <EyeOff /> : <Eye />}
              </LayoutButton>
              <LayoutButton
                section={section}
                op="up"
                label={`${label} omhoog`}
                disabled={i === 0}
              >
                <ChevronUp />
              </LayoutButton>
              <LayoutButton
                section={section}
                op="down"
                label={`${label} omlaag`}
                disabled={i === last}
              >
                <ChevronDown />
              </LayoutButton>
            </li>
          );
        })}
      </ol>

      {!isDefaultLayout(layout) ? (
        <form action={updatePlannerLayout} className="mt-3">
          <input type="hidden" name="op" value="reset" />
          <Button type="submit" size="sm" variant="ghost">
            Standaard herstellen
          </Button>
        </form>
      ) : null}
    </Card>
  );
}

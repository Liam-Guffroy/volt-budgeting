"use client";

import { useId, useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  COLLAPSE_COOKIE,
  parseCollapsed,
  serializeCollapsed,
  type SectionId,
} from "@/lib/collapse";
import { cn } from "@/lib/utils";

/** Read the cookie fresh on each toggle, so two sections never clobber each other. */
function rememberCollapsed(id: SectionId, collapsed: boolean) {
  const current = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${COLLAPSE_COOKIE}=`))
    ?.slice(COLLAPSE_COOKIE.length + 1);

  const ids = parseCollapsed(current);
  if (collapsed) ids.add(id);
  else ids.delete(id);

  document.cookie = `${COLLAPSE_COOKIE}=${serializeCollapsed(ids)}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * A planner section that folds away to its header line.
 *
 * The header follows the WAI-ARIA disclosure pattern — a button inside the
 * heading, with aria-expanded/aria-controls. `summary` (e.g. the section total)
 * stays visible when collapsed, so a folded section still tells you its number.
 * Content is hidden rather than unmounted, so a half-typed entry survives a
 * fold and unfold.
 *
 * `defaultOpen` comes from the server-read cookie (see lib/collapse.ts), so the
 * first render already matches what you left it as.
 */
export function Collapsible({
  id,
  title,
  description,
  summary,
  defaultOpen,
  children,
}: {
  id: SectionId;
  title: string;
  description?: string;
  summary?: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  function toggle() {
    const next = !open;
    setOpen(next);
    rememberCollapsed(id, !next);
  }

  return (
    <section>
      <h2>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={contentId}
          className="flex w-full items-center gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight
            aria-hidden
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90",
            )}
          />
          <span className="font-medium">{title}</span>
          {summary ? (
            <span className="ml-auto pl-3 text-sm tabular-nums text-muted-foreground">
              {summary}
            </span>
          ) : null}
        </button>
      </h2>

      <div id={contentId} hidden={!open} className="mt-4 space-y-4">
        {description ? (
          <p className="-mt-3 pl-6 text-sm text-muted-foreground">{description}</p>
        ) : null}
        {children}
      </div>
    </section>
  );
}

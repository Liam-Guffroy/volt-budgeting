"use client";

import { useState } from "react";
import { niceScale } from "@/lib/stats";
import { cn } from "@/lib/utils";

const euro = new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" });
const euroRound = new Intl.NumberFormat("nl-BE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const DAY_TICKS = [1, 5, 10, 15, 20, 25, 30];

/**
 * Running total of one-time costs through the month, against the month before.
 *
 * Emphasis form: this month is the accent line (with a light wash under it and
 * its latest value labelled), last month the grey one. A crosshair snaps to the
 * nearest day and one tooltip lists both months; arrow keys do the same when
 * the plot has focus. Every value is also in the table view.
 */
export function SpendingChart({
  current,
  previous,
  currentName,
  previousName,
}: {
  /** Running total per day, index 0 = day 1; null for days not reached yet. */
  current: (number | null)[];
  /** The month before, same shape; empty when there's nothing to compare. */
  previous: number[];
  /** Lower-case month names for labels, e.g. "november". */
  currentName: string;
  previousName: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const days = Math.max(current.length, previous.length);
  const reached = current.filter((v): v is number => v !== null);
  const lastIdx = reached.length - 1;
  const { hi, ticks } = niceScale([...reached, ...previous]);

  const x = (i: number) => (days > 1 ? (i / (days - 1)) * 100 : 0);
  const y = (v: number) => (v / hi) * 100;
  const path = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)} ${(100 - y(v)).toFixed(2)}`).join(" ");

  const linePath = path(reached);
  const areaPath =
    reached.length > 1 ? `${linePath} L${x(lastIdx).toFixed(2)} 100 L0 100 Z` : "";

  const clamp = (i: number) => Math.max(0, Math.min(days - 1, i));
  const hasPrevious = previous.length > 0;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <figure className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-4 rounded-full bg-chart-up" />
          {cap(currentName)}
        </span>
        {hasPrevious ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <span aria-hidden className="h-0.5 w-4 rounded-full bg-muted-foreground/60" />
            {cap(previousName)}
          </span>
        ) : null}
      </div>

      <div className="flex">
        <div className="relative h-72 w-14 shrink-0" aria-hidden>
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-2 translate-y-1/2 text-xs tabular-nums text-muted-foreground"
              style={{ bottom: `${y(t)}%` }}
            >
              {euroRound.format(t)}
            </span>
          ))}
        </div>

        <div
          tabIndex={0}
          role="group"
          aria-label={`Uitgaven per dag in ${currentName}. Gebruik de pijltjestoetsen om een dag te kiezen.`}
          className="relative h-72 flex-1 cursor-crosshair touch-pan-y rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setHover(clamp(Math.round(((e.clientX - rect.left) / rect.width) * (days - 1))));
          }}
          onPointerLeave={() => setHover(null)}
          onFocus={() => setHover((h) => h ?? Math.max(lastIdx, 0))}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            setHover((h) => clamp((h ?? Math.max(lastIdx, 0)) + (e.key === "ArrowRight" ? 1 : -1)));
          }}
        >
          {ticks.map((t) => (
            <div
              key={t}
              aria-hidden
              className={cn(
                "absolute inset-x-0 border-t",
                t === 0 ? "border-muted-foreground/50" : "border-border",
              )}
              style={{ bottom: `${y(t)}%` }}
            />
          ))}

          <svg
            aria-hidden
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
          >
            {hasPrevious ? (
              <path
                d={path(previous)}
                fill="none"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className="stroke-muted-foreground/60"
              />
            ) : null}
            {areaPath ? <path d={areaPath} className="fill-chart-up/10" /> : null}
            {reached.length > 1 ? (
              <path
                d={linePath}
                fill="none"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className="stroke-chart-up"
              />
            ) : null}
          </svg>

          {/* Latest point of this month: dot with a surface ring + its value. */}
          {lastIdx >= 0 ? (
            <>
              <span
                aria-hidden
                className="absolute size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-chart-up ring-2 ring-card"
                style={{ left: `${x(lastIdx)}%`, bottom: `${y(reached[lastIdx])}%` }}
              />
              {hover === null ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute mb-2.5 whitespace-nowrap text-xs font-semibold",
                    x(lastIdx) > 80 ? "-translate-x-full" : x(lastIdx) < 10 ? "" : "-translate-x-1/2",
                  )}
                  style={{ left: `${x(lastIdx)}%`, bottom: `${y(reached[lastIdx])}%` }}
                >
                  {euroRound.format(reached[lastIdx])}
                </span>
              ) : null}
            </>
          ) : null}

          {hover !== null ? (
            <>
              <div
                aria-hidden
                className="absolute inset-y-0 w-px bg-muted-foreground/60"
                style={{ left: `${x(hover)}%` }}
              />
              <div
                role="status"
                className={cn(
                  "pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded-lg border border-border bg-card px-3 py-2 shadow-md",
                  x(hover) > 55 ? "-translate-x-full" : "",
                )}
                style={{
                  left: `${x(hover)}%`,
                  marginLeft: x(hover) > 55 ? -10 : 10,
                }}
              >
                <p className="mb-1 text-xs text-muted-foreground">Dag {hover + 1}</p>
                <TooltipRow
                  keyClass="bg-chart-up"
                  value={current[hover] ?? null}
                  name={currentName}
                />
                {hasPrevious ? (
                  <TooltipRow
                    keyClass="bg-muted-foreground/60"
                    value={previous[hover] ?? null}
                    name={previousName}
                  />
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="relative ml-14 h-4" aria-hidden>
        {DAY_TICKS.filter((d) => d <= days).map((d) => (
          <span
            key={d}
            className="absolute -translate-x-1/2 text-xs tabular-nums text-muted-foreground"
            style={{ left: `${x(d - 1)}%` }}
          >
            {d}
          </span>
        ))}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Bekijk als tabel
        </summary>
        <table className="mt-2 w-full">
          <caption className="sr-only">Opgetelde eenmalige kosten per dag</caption>
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1 font-medium">Dag</th>
              <th className="py-1 text-right font-medium">{cap(currentName)}</th>
              {hasPrevious ? (
                <th className="py-1 text-right font-medium">{cap(previousName)}</th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Array.from({ length: days }, (_, i) => (
              <tr key={i}>
                <td className="py-1 tabular-nums">{i + 1}</td>
                <td className="py-1 text-right tabular-nums">
                  {current[i] != null ? euro.format(current[i] as number) : "—"}
                </td>
                {hasPrevious ? (
                  <td className="py-1 text-right tabular-nums">
                    {previous[i] != null ? euro.format(previous[i]) : "—"}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Tooltip row: a line key, the value (strong), then the series name. */
function TooltipRow({
  keyClass,
  value,
  name,
}: {
  keyClass: string;
  value: number | null;
  name: string;
}) {
  return (
    <p className="flex items-center gap-2 text-sm">
      <span aria-hidden className={cn("h-0.5 w-3 rounded-full", keyClass)} />
      <span className="font-semibold tabular-nums">
        {value !== null ? euro.format(value) : "—"}
      </span>
      <span className="text-xs text-muted-foreground">{name}</span>
    </p>
  );
}

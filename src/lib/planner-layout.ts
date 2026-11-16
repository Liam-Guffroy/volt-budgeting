/**
 * The order and visibility of the planner's left-column sections, per account
 * (stored in settings.planner_layout). Pure — parsing and edits only.
 */

export const PLANNER_SECTIONS = [
  "eenmalige-kosten",
  "budgetten",
  "eenmalige-inkomsten",
  "terugkerende-kosten",
  "inkomen",
] as const;

export type PlannerSection = (typeof PLANNER_SECTIONS)[number];

export const SECTION_LABELS: Record<PlannerSection, string> = {
  "eenmalige-kosten": "Eenmalige kosten",
  budgetten: "Budgetten",
  "eenmalige-inkomsten": "Eenmalige inkomsten",
  "terugkerende-kosten": "Terugkerende kosten",
  inkomen: "Maandelijks netto-inkomen",
};

export interface PlannerLayout {
  /** Every section exactly once, top to bottom. */
  order: PlannerSection[];
  /** Sections not shown on the planner. */
  hidden: PlannerSection[];
}

export const DEFAULT_LAYOUT: PlannerLayout = {
  order: [...PLANNER_SECTIONS],
  hidden: [],
};

function isSection(value: unknown): value is PlannerSection {
  return PLANNER_SECTIONS.some((s) => s === value);
}

/**
 * Read a stored layout defensively: unknown ids are dropped, duplicates
 * ignored, and sections the stored layout doesn't mention (say, one added to
 * the app later) are appended in their default position order, visible.
 */
export function parseLayout(raw: unknown): PlannerLayout {
  const value = (raw ?? {}) as { order?: unknown; hidden?: unknown };
  const order: PlannerSection[] = [];
  for (const id of Array.isArray(value.order) ? value.order : []) {
    if (isSection(id) && !order.includes(id)) order.push(id);
  }
  for (const id of PLANNER_SECTIONS) {
    if (!order.includes(id)) order.push(id);
  }
  const hidden = (Array.isArray(value.hidden) ? value.hidden : []).filter(
    (id, i, all): id is PlannerSection => isSection(id) && all.indexOf(id) === i,
  );
  return { order, hidden };
}

export function isDefaultLayout(layout: PlannerLayout): boolean {
  return (
    layout.hidden.length === 0 &&
    layout.order.every((id, i) => id === DEFAULT_LAYOUT.order[i])
  );
}

export type LayoutOp = "up" | "down" | "toggle";

/** Move a section one place, or show/hide it. Out-of-range moves are no-ops. */
export function editLayout(
  layout: PlannerLayout,
  section: PlannerSection,
  op: LayoutOp,
): PlannerLayout {
  if (op === "toggle") {
    const hidden = layout.hidden.includes(section)
      ? layout.hidden.filter((s) => s !== section)
      : [...layout.hidden, section];
    return { order: layout.order, hidden };
  }
  const order = [...layout.order];
  const from = order.indexOf(section);
  const to = op === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= order.length) return layout;
  [order[from], order[to]] = [order[to], order[from]];
  return { order, hidden: layout.hidden };
}

import { quickAddKey } from "./quick-adds";

/**
 * Category budgets — pure math. A budget is a monthly amount for one name of
 * one-time costs; an entry counts toward it when its name matches after the
 * same normalisation quick-adds use ("boodschappen " = "Boodschappen").
 */

export interface Budget {
  id: number;
  name: string;
  key: string;
  amount: number;
}

export type BudgetState = "ok" | "near" | "over";

export interface BudgetProgress extends Budget {
  spent: number;
  /** amount − spent; negative when over budget. */
  remaining: number;
  /** spent / amount, uncapped (1.2 = 20% over). */
  ratio: number;
  state: BudgetState;
}

/** From this share of the budget on, the meter warns that it's nearly used up. */
const NEAR = 0.8;

export function budgetProgress(
  budgets: Budget[],
  entries: { name: string; amount: number }[],
): BudgetProgress[] {
  const spentByKey = new Map<string, number>();
  for (const e of entries) {
    const key = quickAddKey(e.name);
    spentByKey.set(key, (spentByKey.get(key) ?? 0) + e.amount);
  }

  return budgets.map((b) => {
    // Cents, so sums of decimals compare cleanly against the budget.
    const spent = Math.round((spentByKey.get(b.key) ?? 0) * 100) / 100;
    const ratio = b.amount > 0 ? spent / b.amount : 0;
    return {
      ...b,
      spent,
      remaining: Math.round((b.amount - spent) * 100) / 100,
      ratio,
      state: spent > b.amount ? "over" : ratio >= NEAR ? "near" : "ok",
    };
  });
}

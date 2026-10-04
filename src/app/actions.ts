"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  expenses,
  oneTimeExpenses,
  oneTimeIncomes,
  settings,
} from "@/db/schema";
import { FREQUENCY_KEYS } from "@/lib/budget";
import { isMonthKey } from "@/lib/month";
import { endSession, requireUser } from "@/lib/session";

export interface FormState {
  error?: string;
  ok?: boolean;
}

// A money string from a form input. Accepts "1234,56" (nl) or "1234.56".
const amount = z
  .string()
  .trim()
  .min(1, "Vul een bedrag in.")
  .transform((s) => Number(s.replace(/\s/g, "").replace(",", ".")))
  .pipe(z.number().finite("Ongeldig bedrag.").nonnegative("Bedrag mag niet negatief zijn."));

const incomeSchema = z.object({ monthlyIncome: amount });

const expenseSchema = z.object({
  name: z.string().trim().min(1, "Vul een naam in.").max(120),
  amount: amount.pipe(z.number().positive("Bedrag moet groter zijn dan nul.")),
  frequency: z.enum(FREQUENCY_KEYS),
});

const idSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const moveSchema = idSchema.extend({
  direction: z.enum(["up", "down"]),
});

const oneTimeSchema = z.object({
  name: z.string().trim().min(1, "Vul een naam in.").max(120),
  amount: amount.pipe(z.number().positive("Bedrag moet groter zijn dan nul.")),
  month: z.string().refine(isMonthKey, "Ongeldige maand."),
});

function fail(parsed: z.SafeParseReturnType<unknown, unknown>): FormState {
  if (parsed.success) return {};
  return {
    error:
      "error" in parsed
        ? parsed.error.issues[0]?.message ?? "Ongeldige invoer."
        : "Ongeldige invoer.",
  };
}

export async function setIncome(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUser();

  const parsed = incomeSchema.safeParse({
    monthlyIncome: formData.get("monthlyIncome"),
  });
  if (!parsed.success) return fail(parsed);

  const value = parsed.data.monthlyIncome.toFixed(2);
  await db
    .insert(settings)
    .values({ userId, monthlyIncome: value })
    .onConflictDoUpdate({
      target: settings.userId,
      set: { monthlyIncome: value },
    });

  revalidatePath("/");
  return { ok: true };
}

export async function addExpense(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUser();

  const parsed = expenseSchema.safeParse({
    name: formData.get("name"),
    amount: formData.get("amount"),
    frequency: formData.get("frequency"),
  });
  if (!parsed.success) return fail(parsed);

  // Append at the end of this user's list.
  const [{ next } = { next: 0 }] = await db
    .select({ next: sql<number>`coalesce(max(${expenses.position}), -1) + 1` })
    .from(expenses)
    .where(eq(expenses.userId, userId));

  await db.insert(expenses).values({
    userId,
    name: parsed.data.name,
    amount: parsed.data.amount.toFixed(2),
    frequency: parsed.data.frequency,
    position: next,
  });

  revalidatePath("/");
  return { ok: true };
}

export async function updateExpense(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUser();

  const id = idSchema.safeParse({ id: formData.get("id") });
  if (!id.success) return fail(id);

  const parsed = expenseSchema.safeParse({
    name: formData.get("name"),
    amount: formData.get("amount"),
    frequency: formData.get("frequency"),
  });
  if (!parsed.success) return fail(parsed);

  await db
    .update(expenses)
    .set({
      name: parsed.data.name,
      amount: parsed.data.amount.toFixed(2),
      frequency: parsed.data.frequency,
    })
    .where(and(eq(expenses.id, id.data.id), eq(expenses.userId, userId)));

  revalidatePath("/");
  return { ok: true };
}

/**
 * Move one expense up or down in this user's list.
 *
 * Rather than swapping two position values, this renumbers the whole list
 * 0..n-1 in its new order. Older rows can share a position (the column defaults
 * to 0) or have gaps after deletes, and a plain swap misbehaves on ties — a
 * renumber always lands in a consistent state. Only rows whose position
 * actually changed are written.
 */
export async function moveExpense(formData: FormData): Promise<void> {
  const userId = await requireUser();

  const parsed = moveSchema.safeParse({
    id: formData.get("id"),
    direction: formData.get("direction"),
  });
  if (!parsed.success) return;

  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: expenses.id, position: expenses.position })
      .from(expenses)
      .where(eq(expenses.userId, userId))
      .orderBy(asc(expenses.position), asc(expenses.id));

    const from = rows.findIndex((r) => r.id === parsed.data.id);
    if (from < 0) return; // not this user's row (or already gone)

    const to = parsed.data.direction === "up" ? from - 1 : from + 1;
    if (to < 0 || to >= rows.length) return; // already at the edge

    [rows[from], rows[to]] = [rows[to], rows[from]];

    // Sequential, not Promise.all: a transaction is one connection.
    for (const [index, row] of rows.entries()) {
      if (row.position === index) continue;
      await tx
        .update(expenses)
        .set({ position: index })
        .where(and(eq(expenses.id, row.id), eq(expenses.userId, userId)));
    }
  });

  revalidatePath("/");
}

export async function deleteExpense(formData: FormData): Promise<void> {
  const userId = await requireUser();

  const id = idSchema.safeParse({ id: formData.get("id") });
  if (!id.success) return;

  await db
    .delete(expenses)
    .where(and(eq(expenses.id, id.data.id), eq(expenses.userId, userId)));
  revalidatePath("/");
}

/** Add a one-off cost to a specific month. */
export async function addOneTimeExpense(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUser();

  const parsed = oneTimeSchema.safeParse({
    name: formData.get("name"),
    amount: formData.get("amount"),
    month: formData.get("month"),
  });
  if (!parsed.success) return fail(parsed);

  await db.insert(oneTimeExpenses).values({
    userId,
    month: parsed.data.month,
    name: parsed.data.name,
    amount: parsed.data.amount.toFixed(2),
  });

  revalidatePath("/");
  return { ok: true };
}

export async function deleteOneTimeExpense(formData: FormData): Promise<void> {
  const userId = await requireUser();

  const id = idSchema.safeParse({ id: formData.get("id") });
  if (!id.success) return;

  await db
    .delete(oneTimeExpenses)
    .where(
      and(eq(oneTimeExpenses.id, id.data.id), eq(oneTimeExpenses.userId, userId)),
    );
  revalidatePath("/");
}

/** Add one-off income (holiday pay, a refund…) to a specific month. */
export async function addOneTimeIncome(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await requireUser();

  const parsed = oneTimeSchema.safeParse({
    name: formData.get("name"),
    amount: formData.get("amount"),
    month: formData.get("month"),
  });
  if (!parsed.success) return fail(parsed);

  await db.insert(oneTimeIncomes).values({
    userId,
    month: parsed.data.month,
    name: parsed.data.name,
    amount: parsed.data.amount.toFixed(2),
  });

  revalidatePath("/");
  return { ok: true };
}

export async function deleteOneTimeIncome(formData: FormData): Promise<void> {
  const userId = await requireUser();

  const id = idSchema.safeParse({ id: formData.get("id") });
  if (!id.success) return;

  await db
    .delete(oneTimeIncomes)
    .where(
      and(eq(oneTimeIncomes.id, id.data.id), eq(oneTimeIncomes.userId, userId)),
    );
  revalidatePath("/");
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/login");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { households, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { requireAdmin } from "@/lib/session";

/**
 * Admin actions: accounts and households. Every one starts with
 * requireAdmin() — the page being hidden from the menu protects nothing, since
 * a server action can be called by anyone who is logged in.
 */

export interface AdminFormState {
  error?: string;
  /** A confirmation to show, e.g. `Account "Kelly" is aangemaakt.` */
  ok?: string;
  /** The submitted name, handed back so a failed form keeps it. */
  name?: string;
}

const nameSchema = z.string().trim().min(1, "Vul een naam in.").max(40, "Maximaal 40 tekens.");
// Login is by password alone, so there is no username to fall back on: the
// only rule beyond a minimum length is that no two accounts share one.
const passwordSchema = z
  .string()
  .min(4, "Het wachtwoord moet minstens 4 tekens hebben.")
  .max(200, "Het wachtwoord is te lang.");
const idSchema = z.coerce.number().int().positive();

const firstError = (error: z.ZodError) => error.issues[0]?.message ?? "Ongeldige invoer.";

/**
 * The name of an account that already uses this password, or null. Hashes are
 * salted, so this means trying the password against every account.
 */
async function passwordOwner(plain: string, exceptId?: number): Promise<string | null> {
  const all = await db
    .select({ id: users.id, name: users.name, passwordHash: users.passwordHash })
    .from(users);
  return (
    all.find((u) => u.id !== exceptId && verifyPassword(plain, u.passwordHash))?.name ?? null
  );
}

const inUse = (owner: string) =>
  `Dat wachtwoord wordt al gebruikt door ${owner}. Inloggen gaat met het wachtwoord alleen, dus elk account heeft een eigen wachtwoord nodig.`;

export async function createAccount(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();
  const typedName = String(formData.get("name") ?? "");
  const parsed = z
    .object({ name: nameSchema, password: passwordSchema })
    .safeParse({ name: typedName, password: formData.get("password") });
  if (!parsed.success) return { error: firstError(parsed.error), name: typedName };
  const { name, password } = parsed.data;

  // Names are unique in the database, but only exactly: also refuse "liam"
  // next to "Liam", which nobody could tell apart in the lists.
  const [taken] = await db
    .select({ name: users.name })
    .from(users)
    .where(sql`lower(${users.name}) = lower(${name})`);
  if (taken) return { error: `Er is al een account met de naam ${taken.name}.`, name };

  const owner = await passwordOwner(password);
  if (owner) return { error: inUse(owner), name };

  await db.insert(users).values({ name, passwordHash: hashPassword(password) });
  revalidatePath("/beheer");
  return { ok: `Account "${name}" is aangemaakt.` };
}

export async function resetPassword(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();
  const parsed = z
    .object({ id: idSchema, password: passwordSchema })
    .safeParse({ id: formData.get("id"), password: formData.get("password") });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { id, password } = parsed.data;

  const owner = await passwordOwner(password, id);
  if (owner) return { error: inUse(owner) };

  const [updated] = await db
    .update(users)
    .set({ passwordHash: hashPassword(password) })
    .where(eq(users.id, id))
    .returning({ name: users.name });
  if (!updated) return { error: "Dat account bestaat niet meer." };
  return { ok: `Het wachtwoord van ${updated.name} is gewijzigd.` };
}

/**
 * Delete an account and, through the foreign keys, everything in it. The page
 * asks for confirmation first (?verwijder=<id>); this is the confirmed step.
 */
export async function deleteAccount(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = idSchema.safeParse(formData.get("id"));
  // Never your own account: that would lock the only admin out.
  if (id.success && id.data !== admin.id) {
    await db.delete(users).where(and(eq(users.id, id.data), ne(users.id, admin.id)));
    revalidatePath("/beheer");
  }
  redirect("/beheer");
}

/** Put an account in a household, or take it out (empty household id). */
export async function setHousehold(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z
    .object({
      id: idSchema,
      householdId: z.union([z.literal(""), idSchema]).transform((v) => (v === "" ? null : v)),
    })
    .safeParse({ id: formData.get("id"), householdId: formData.get("householdId") });
  if (!parsed.success) return;
  const { id, householdId } = parsed.data;

  if (householdId !== null) {
    const [exists] = await db
      .select({ id: households.id })
      .from(households)
      .where(eq(households.id, householdId));
    if (!exists) return;
  }
  await db.update(users).set({ householdId }).where(eq(users.id, id));
  revalidatePath("/beheer");
}

export async function createHousehold(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();
  const typedName = String(formData.get("name") ?? "");
  const parsed = nameSchema.safeParse(typedName);
  if (!parsed.success) return { error: firstError(parsed.error), name: typedName };
  const name = parsed.data;

  const [taken] = await db
    .select({ name: households.name })
    .from(households)
    .where(sql`lower(${households.name}) = lower(${name})`);
  if (taken) return { error: `Er is al een huishouden met de naam ${taken.name}.`, name };

  await db.insert(households).values({ name });
  revalidatePath("/beheer");
  return { ok: `Huishouden "${name}" is aangemaakt.` };
}

/** Remove a household. Its members keep their accounts; they're just unlinked. */
export async function deleteHousehold(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return;
  await db.delete(households).where(eq(households.id, id.data));
  revalidatePath("/beheer");
}

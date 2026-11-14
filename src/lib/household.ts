import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { households, users } from "@/db/schema";

export interface Household {
  id: number;
  name: string;
  /** Every account in it, this one included, by name. */
  members: { id: number; name: string }[];
}

/**
 * The household an account shares a combined view with, or null when it isn't
 * in one — or is its only member, in which case there's nothing to combine.
 */
export async function householdOf(userId: number): Promise<Household | null> {
  const [me] = await db
    .select({ householdId: users.householdId })
    .from(users)
    .where(eq(users.id, userId));
  if (!me?.householdId) return null;

  const [[household], members] = await Promise.all([
    db.select().from(households).where(eq(households.id, me.householdId)),
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.householdId, me.householdId))
      .orderBy(asc(users.name)),
  ]);
  if (!household || members.length < 2) return null;

  return { id: household.id, name: household.name, members };
}

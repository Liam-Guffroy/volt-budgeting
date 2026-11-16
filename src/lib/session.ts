import "server-only";
import crypto from "node:crypto";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Cookie-based sessions tied to a user account. A successful login (see
 * src/app/login/actions.ts, which checks the password against the users table)
 * mints a signed, httpOnly cookie carrying the user's id. requireUser() reads
 * that id back on every protected route/action so each request is scoped to one
 * account.
 */

const COOKIE_NAME = "vlot_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function appSecret(): string {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error("APP_SECRET is not set");
  return secret;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", appSecret()).update(payload).digest("base64url");
}

/** Compare two equal-length buffers in constant time. */
function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Mint a fresh signed session token: "vlot.<userId>.<issuedAt>.<hmac>". */
function createToken(userId: number): string {
  const payload = `vlot.${userId}.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * Verify a token's signature (constant-time) and expiry, and return the userId
 * it carries. Returns null for any missing, tampered, or expired token.
 */
function readToken(token: string | undefined): number | null {
  if (!token) return null;
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return null;

  const payload = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);
  if (!timingSafeEqualStr(signature, sign(payload))) return null;

  const [, userIdRaw, issuedAtRaw] = payload.split(".");
  const userId = Number(userIdRaw);
  const issuedAt = Number(issuedAtRaw);
  if (!Number.isInteger(userId) || userId <= 0) return null;
  if (!Number.isFinite(issuedAt)) return null;
  if (Date.now() - issuedAt >= MAX_AGE_SECONDS * 1000) return null;

  return userId;
}

/** Set the session cookie for a user (call from the login action after the password check). */
export async function startSession(userId: number): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, createToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** Clear the session cookie. */
export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export interface Account {
  id: number;
  name: string;
  isAdmin: boolean;
}

/**
 * The logged-in account, or null: no valid cookie, or the account it names no
 * longer exists. The cookie alone isn't enough — it stays validly signed after
 * an admin deletes the account, and a session for a deleted account would show
 * an empty planner and fail on every save. One primary-key lookup, shared by
 * everything in the same request.
 */
export const getAccount = cache(async (): Promise<Account | null> => {
  const store = await cookies();
  const userId = readToken(store.get(COOKIE_NAME)?.value);
  if (userId === null) return null;

  const [account] = await db
    .select({ id: users.id, name: users.name, isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId));
  return account ?? null;
});

/** The logged-in user's id, or null if the request has no valid session. */
export async function getUserId(): Promise<number | null> {
  return (await getAccount())?.id ?? null;
}

/** True if the current request carries a valid session for an existing account. */
export async function isAuthenticated(): Promise<boolean> {
  return (await getAccount()) !== null;
}

/**
 * Return the logged-in user's id, or redirect to /login. Call at the top of
 * every protected route/action and scope all queries by the returned id.
 */
export async function requireUser(): Promise<number> {
  const userId = await getUserId();
  if (userId === null) redirect("/login");
  return userId;
}

/**
 * Return the logged-in account if it is an admin; otherwise leave. Call at the
 * top of the admin page and of every admin action — hiding the menu item is
 * not protection.
 */
export async function requireAdmin(): Promise<Account> {
  const account = await getAccount();
  if (!account) redirect("/login");
  if (!account.isAdmin) redirect("/");
  return account;
}

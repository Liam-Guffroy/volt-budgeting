import {
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { FREQUENCY_KEYS } from "../lib/budget";
import { QUICK_ADD_KINDS } from "../lib/quick-adds";

export const frequencyEnum = pgEnum("frequency", FREQUENCY_KEYS);
export const quickAddKindEnum = pgEnum("quick_add_kind", QUICK_ADD_KINDS);

// Accounts. Login is by password only (no email) — the password itself
// identifies the person, so each account's password must be unique. `name` is
// just a human label for managing/greeting the account, never typed at login.
// Passwords are stored as a scrypt hash (see src/lib/password.ts), never
// plaintext. Users are created out-of-band (npm run user:create); no signup.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Recurring costs, owned by one user. Every query is scoped by userId so
// accounts never see each other's data.
export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  frequency: frequencyEnum("frequency").notNull(),
  position: integer("position").notNull().default(0),
  // Optional: when a non-monthly bill is next due. A date in the past simply
  // means that one was paid — lib/reserve.ts rolls it forward by the frequency.
  nextDue: date("next_due", { mode: "string" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// One-off costs on a specific day, e.g. a new washing machine on 3 March.
// Unlike `expenses` these don't recur, so they only affect their own month —
// which is what makes browsing past months meaningful. `month` is always
// `entryDate`'s "YYYY-MM" (set together on insert) and is what lists query by.
export const oneTimeExpenses = pgTable("one_time_expenses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  month: text("month").notNull(),
  entryDate: date("entry_date", { mode: "string" }).notNull(),
  name: text("name").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// One-off income on a specific day, e.g. holiday pay in June or a refund. The
// mirror image of `oneTimeExpenses`: it only lifts its own month, on top of the
// regular monthly income in `settings`. Same month/entryDate pairing.
export const oneTimeIncomes = pgTable("one_time_incomes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  month: text("month").notNull(),
  entryDate: date("entry_date", { mode: "string" }).notNull(),
  name: text("name").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// An account's own quick-add buttons, shown after the built-ins in
// src/lib/quick-adds.ts. `frequency` is only set for kind = "recurring".
export const quickAdds = pgTable("quick_adds", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: quickAddKindEnum("kind").notNull(),
  name: text("name").notNull(),
  frequency: frequencyEnum("frequency"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Built-in quick-add buttons an account has hidden. Deleting the row brings the
// button back. Unique per account/category/name, so hiding twice is a no-op.
//
// A unique *index*, not a unique constraint: drizzle-kit introspects
// constraint columns with an unordered query, reads them back in a different
// order than declared, and then `db:push` wants to drop and re-add the
// constraint — offering to TRUNCATE the table. Index columns are introspected
// in order, so pushes stay clean.
export const hiddenQuickAdds = pgTable(
  "hidden_quick_adds",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: quickAddKindEnum("kind").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("hidden_quick_adds_user_kind_name").on(t.userId, t.kind, t.name),
  ],
);

// A monthly budget for one category of one-time costs, e.g. € 400 for
// "Boodschappen". `key` is the name normalised the same way quick-adds and the
// statistics group names (trimmed, lower-cased), and is what entries are
// matched on; `name` keeps the spelling the user typed. One budget per key.
export const budgets = pgTable(
  "budgets",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    key: text("key").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("budgets_user_key").on(t.userId, t.key)],
);

// One settings row per user, keyed by userId, holding the monthly take-home income.
export const settings = pgTable("settings", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  monthlyIncome: numeric("monthly_income", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  // What the user says is actually set aside for non-monthly bills, to compare
  // against what should be there by now.
  reserveBalance: numeric("reserve_balance", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type OneTimeExpenseRow = typeof oneTimeExpenses.$inferSelect;

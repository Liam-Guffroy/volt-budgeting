# Vlot — persoonlijke budgetplanner

Vul je maandelijks netto-inkomen en je terugkerende kosten in (op om het even
welke frequentie). Vlot toont wat je elke maand overhoudt en hoeveel je opzij
moet zetten voor de niet-maandelijkse rekeningen.

Built on a small Next.js + Drizzle + Postgres slice: password-only login →
server action → Postgres. Multiple accounts, each with its own private budget;
no public signup (you provision accounts from the CLI).

## Stack

- **Next.js 15** (App Router, server actions, React 19)
- **Drizzle ORM** over **Postgres** via the portable `node-postgres` driver
- **Zod** for input validation
- **Tailwind v4** + small shadcn-style components

## The one knob that matters: `DATABASE_URL`

The whole app talks to Postgres through Drizzle, so the database is a connection
string, not a commitment. Swap the value, change nothing else:

| Provider | What to paste |
|---|---|
| **Neon** | the **pooled** connection string (host ends in `-pooler`) |
| **Supabase** | Project Settings → Database → Connection string → **Session pooler** |
| **Local** | `postgresql://postgres:postgres@localhost:5432/postgres` |

## Setup

```bash
npm install
cp .env.example .env            # fill in DATABASE_URL and APP_SECRET
openssl rand -base64 32         # paste the output as APP_SECRET
npm run db:push                 # create the tables in your database
npm run user:create -- "Liam" "a-strong-password"   # add an account
npm run dev                     # http://localhost:3000
```

On Windows without `openssl` on PATH, generate `APP_SECRET` with PowerShell
(uses the cryptographic RNG, not the non-secure `Get-Random`):

```powershell
$b = New-Object byte[] 32
([System.Security.Cryptography.RNGCryptoServiceProvider]::new()).GetBytes($b)
[Convert]::ToBase64String($b)
```

`db:push` is the quick path for prototyping. For real projects use migrations:

```bash
npm run db:generate             # write a SQL migration from schema.ts
npm run db:migrate              # apply it
```

## Auth: password-only accounts

Accounts live in the `users` table. There's no public signup — you provision
accounts from the CLI:

```bash
npm run user:create -- "Liam" "a-strong-password"
```

- The **name** is just a label for managing/greeting the account; it's never
  typed at login.
- Login is by **password only** — so each account's password must be unique. The
  script refuses a password already used by another account.
- Re-running with an existing name overwrites that account's password (a reset).

Passwords are stored as a salted **scrypt** hash (`src/lib/password.ts`), never
plaintext — a leaked database can't be reversed into passwords. The login server
action loads the accounts and finds the one whose hash matches; on success it
mints a **signed, httpOnly** session cookie carrying the user's id (HMAC-SHA256
over `<userId>.<issuedAt>`, keyed by `APP_SECRET`). `requireUser()` (in
`src/lib/session.ts`) verifies that cookie on every protected route/action and
returns the user id, or redirects to `/login`.

Each account's data is private: `expenses` and `settings` carry a `userId`, and
**every query is scoped by it** so accounts never see each other's budgets.

## Core logic

Pure functions in `src/lib/budget.ts`, no I/O:

- Every expense is normalized to a **monthly equivalent**.
- **Regular** = weekly / biweekly / monthly (what you actually pay each month).
- **Reserve** = anything less frequent than monthly, divided down to a monthly
  set-aside (a yearly €1.200 bill → €100/month).
- **One-time** costs and **one-time income** (holiday pay, a refund) are filed
  against a single month (`YYYY-MM`) and are *not* normalized — they hit only
  the month they belong to.
- `summarize(income, expenses, oneTime, oneTimeIncome)` returns `remaining`
  (income + oneTimeIncome − regular − reserve − oneTime), `regularTotal`,
  `reserveTotal`, `oneTimeTotal`, `oneTimeIncomeTotal`, and a per-bill reserve
  breakdown.

Belgian euro formatting (`nl-BE`, "€ 1.234,56") lives in `src/lib/format.ts`.

## Months

The planner is scoped to a month via `?month=YYYY-MM` (defaults to the current
one). Recurring costs are month-independent, so they show up in every month;
one-time costs and income only appear in theirs. That makes browsing back
through previous months a real overview rather than a snapshot.

Month keys are plain strings and all arithmetic is integer math
(`src/lib/month.ts`) — nothing can drift across a timezone boundary into the
wrong month. An invalid or missing `?month=` falls back to the current month.

Each one-time entry has a date (`entry_date`, a plain calendar day) and the
date decides its month — `month` is derived from it on insert. The form's date
field starts on today (Belgian time) and is limited to the month being viewed;
in another month it starts on the nearest day of it (the last day of a past
month), so an entry can't vanish into a month you aren't looking at. Lists
sort by date, and each row shows it ("19 okt", with the year when it isn't
this year).

Careful with the `created_at` columns: they're `timestamp` *without* time zone
holding the database's UTC clock time, and node-postgres reads them as
server-local time — hours off. Resolve them in SQL first (`created_at at time
zone current_setting('TimeZone')`), as the statistics page does.

## Statistieken

`/statistieken` summarises a period (6 months, 12 months or this year): four
stat tiles, "over per maand" as columns above/below zero, one-time costs per
month, where one-time costs go (grouped by name, case-insensitive, folding the
tail into "Overige") and recurring costs as monthly amounts. The math is pure,
in `src/lib/stats.ts`. Two honest limits, also stated on the page: past months
use today's income and recurring costs (there's no history of those), and a
period never starts before the account's first month.

Charts are server-rendered HTML — no chart library. Fills use the
`--color-chart-*` tokens in `globals.css`, chosen per theme and checked for
lightness, chroma, colour-blind separation and contrast on the card surface;
every chart has a "Bekijk als tabel" view and a hover/keyboard tooltip.

## Collapsible sections

Every planner section folds away to its header line, which keeps showing the
section total. Which sections are folded is stored in a `vlot_collapsed` cookie
(`src/lib/collapse.ts`) rather than localStorage, because the server can read a
cookie: a folded section renders folded from the first byte instead of
flashing open and snapping shut after hydration.

## Quick-adds

One-time costs, one-time income and recurring costs each have a row of
quick-add buttons: one click fills the entry's name (and, for recurring costs,
its frequency) so you only type the amount. The built-ins live in
`src/lib/quick-adds.ts`; each account can add its own with **+ Eigen** (stored
per account in `quick_adds`) and remove them with their ×. A name that already
exists in that category — built-in or custom, ignoring case — is refused.

Built-ins can't be deleted, but each account can hide the ones it never uses
(eye-slash button; stored in `hidden_quick_adds`, unique per account, category
and name). A "n verborgen" toggle lists them, and one click puts a button back
in its original spot.

That uniqueness is a unique *index*, deliberately not a unique constraint:
drizzle-kit reads constraint columns back in an arbitrary order, decides the
constraint changed, and `db:push` then offers to **truncate** the table. Prefer
`uniqueIndex()` for multi-column uniqueness in this schema.

## Where things live

```
src/
  app/
    layout.tsx              # root shell + globals.css + no-flash theme script
    page.tsx                # planner: requireUser(), reads this user's data, composes UI
    actions.ts             # setIncome / addExpense / updateExpense / deleteExpense / logout (Zod, userId-scoped)
    app-header.tsx          # title + page nav (Planner / Statistieken) + theme + logout
    theme-toggle.tsx        # client light/dark toggle
    month-nav.tsx           # prev/next month links (?month=YYYY-MM)
    collapsible.tsx         # client fold-away section header (state in a cookie)
    income-form.tsx         # client form -> setIncome
    expense-form.tsx        # client form -> addExpense + quick-adds
    expense-row.tsx         # client row: inline edit + reorder + delete
    quick-add-bar.tsx       # client quick-add row: built-ins, own buttons, + Eigen, hide/restore
    one-time-section.tsx    # one-off costs or income: form + month list + total
    one-time-form.tsx       # client add form (name, amount, date) + quick-adds (shared by both)
    one-time-row.tsx        # one-off cost/income row + date + delete
    frequency-select.tsx    # native <select> sharing the Input look
    results-panel.tsx       # three totals + reserve breakdown
    statistieken/
      page.tsx              # period filter, stat tiles, charts, category lists
      column-chart.tsx      # server-rendered columns (single / diverging) + table view
      bar-list.tsx          # ranked horizontal bars with value + share
    login/
      page.tsx              # password-only gate
      login-form.tsx        # client form -> login action
      actions.ts            # match password against accounts + set cookie
  lib/
    session.ts              # cookie sign/verify (carries userId), requireUser()
    password.ts             # scrypt hash/verify for stored account passwords
    budget.ts               # frequency config + pure normalization/summarize
    month.ts                # month + day keys, Belgian "today", month bounds, default day
    stats.ts                # pure statistics math: periods, month series, categories, scale
    collapse.ts             # collapsed-sections cookie: ids, parse, serialize
    quick-adds.ts           # built-in quick-add buttons per category
    format.ts               # nl-BE euro + short day labels
    utils.ts                # cn()
  db/
    index.ts                # Drizzle client (node-postgres)
    schema.ts               # users + expenses + one-time expenses/incomes + quick-adds (own + hidden) + settings
  components/ui/            # button, input, label, card
scripts/
  create-user.mjs           # provision/reset an account (npm run user:create)
drizzle.config.ts           # migration config
```

## Next pass

- A 12-month cashflow chart (the reserve math already gives the per-month figures).

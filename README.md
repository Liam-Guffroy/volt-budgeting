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

For everyday use, run the production build instead:

```bash
npm run build && npm start
```

`npm run dev` compiles each server action the first time it's used, which
makes the page fully reload after the first save on a freshly loaded page
(the entry is still saved). The production build doesn't do that.

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

Accounts live in the `users` table. There's no public signup — an admin makes
accounts on the **Beheer** page (see *Admin page* below), or from the CLI:

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
returns the user id, or redirects to `/login`. It also checks that the account
still exists (one primary-key lookup per request): the cookie stays validly
signed after an account is deleted, so without that a deleted account's open
session would keep showing an empty planner.

Each account's data is private: `expenses` and `settings` carry a `userId`, and
**every query is scoped by it** so accounts never see each other's budgets.

## Admin page

Accounts with `users.is_admin` get a **Beheer** page (`/beheer`):

- **Accounts** — create one (name + password), give one a new password, or
  delete one. Deleting takes everything in the account with it, so it is two
  steps: *Verwijderen* opens a confirmation (`?verwijder=<id>`) that says what
  will be lost, and only *Definitief verwijderen* does it. You can't delete the
  account you're logged in with.
- **Households** — create and remove households, and pick each account's
  household from a dropdown (it saves on change). Removing a household only
  unlinks its members.

Creating and resetting refuse a password another account already uses (login is
by password alone) and a name that only differs in capitals. Passwords are
typed as plain text there, because the admin has to pass them on; they're still
stored hashed, so they can be replaced later but never looked up.

Every admin action calls `requireAdmin()` itself — hiding the menu item
protects nothing, since server actions can be called by anyone logged in.
Non-admins who open `/beheer` are sent to the planner.

Admin rights are granted from the CLI only, never from the app:

```bash
npm run user:admin -- "Liam"            # make an account admin
npm run user:admin -- "Liam" --revoke   # take it away
npm run user:admin                      # list the admins
```

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
month), so an entry can't vanish into a month you aren't looking at. Each row
shows its date ("19 okt", with the year when it isn't this year).

Both one-time lists sort newest first by default (same-day entries: latest
added first); each list has a "Nieuwste eerst / Oudste eerst" choice once it
holds two or more entries. The choice is remembered per browser in a
`vlot_oldest_first` cookie the server reads, so the list renders in that order
from the start (`src/lib/list-sort.ts`).

Careful with the `created_at` columns: they're `timestamp` *without* time zone
holding the database's UTC clock time, and node-postgres reads them as
server-local time — hours off. Resolve them in SQL first (`created_at at time
zone current_setting('TimeZone')`), as the statistics page does.

## Households: the shared view

Accounts can be linked into a household (`households` table,
`users.household_id`). Linked accounts get a **Samen** page (`/samen`) with the
month switcher: the combined amount left over, the combined income split into
fixed costs / set-asides / one-time costs / left, a per-person table, and
one-time costs totalled per category across the household. Each member's month
is calculated exactly as on their own planner, frozen months included.

It shows **totals only** — per person and per category — never anyone's
individual entries. The menu item only appears for accounts that share a
household with at least one other account.

Linking is done on the admin's **Beheer** page, or with a command:

```bash
npm run household -- link "Thuis" "Liam" "Sabrina"   # create/extend a household
npm run household -- unlink "Sabrina"                # take an account out
npm run household -- list
```

## History: frozen months

Income and recurring costs have one current value each, so on their own a
raise or a rent increase would rewrite every past month. Instead a finished
month is **frozen**: its income and recurring costs are copied into
`month_snapshots` (one row per account and month), and from then on that month
is calculated from the copy. One-time entries are dated already and need none.

Freezing is lazy (`src/lib/history.ts`): `ensureSnapshots` runs at the top of
the planner and statistics pages and before every action that changes income
or recurring costs, so the copy is always taken before a change can land. It
covers every finished month from the account's first month; months from before
that keep using current values.

When a frozen month is on screen the planner's results panel says so and
offers "Herbereken met de bedragen van nu", which re-freezes that month from
the current values — for when the old amounts were already out of date. The
editable lists (recurring costs, income) always show today's values.

## Due dates for set-asides

A non-monthly recurring cost can carry a "next due" date (`expenses.next_due`,
set through the row's pencil). From it `src/lib/reserve.ts` works out what
should be set aside for that bill by now: for an amount A every P months with n
monthly set-asides still to come before the due month, A × (P − n) / P. A due
date in the past means that bill was paid, so it rolls forward by the
frequency. The results panel shows each bill's due date and that amount, the
total that should be set aside, and — against `settings.reserve_balance`, what
the user says is actually there — whether they're on schedule or short. Bills
without a due date are left out of that total (and the panel says so).

## Search and export

`/zoeken` lists every one-time cost and income across all months, newest
first and grouped per month, with a name search (case-insensitive; `%` and `_`
are matched literally) and a kind filter. Two CSV downloads come from
`/export`: the list as filtered (`?soort=eenmalig&q=…&type=…`) and the
recurring costs (`?soort=vast`). The route answers 401 without a session.

The CSV is written for Belgian Excel (`src/lib/csv.ts`): semicolons, decimal
commas, `dd/mm/yyyy`, a UTF-8 byte-order mark, and a leading apostrophe on
names that start with `=`, `+`, `-` or `@` so Excel can't run them as formulas.

## Budgets

A budget is a monthly amount for one category of one-time costs (`budgets`
table, one per account and name). An entry counts toward it when its name
matches after the same normalisation quick-adds use, so "boodschappen" and
"Boodschappen" are one category. The planner's *Budgetten* section adds,
edits (saving an existing name replaces its amount) and deletes them, and shows
a meter per budget for the month being viewed: on track, nearly used up (from
80%), or over. The statistics page shows the same meters, fullest first. The
math is in `src/lib/budgets.ts`.

## Statistieken

`/statistieken?month=YYYY-MM` looks at one month at a time, with the same month
switcher as the planner:

- **Where the money went** — the month's income as one segmented bar: fixed
  costs, set-asides, one-time costs and what's left. When costs exceed income
  the bar spans the costs and a marker shows where the income ran out.
- **Four tiles** — one-time spending (against the month before *at the same
  day*, so a month in progress is compared fairly), average per day, what's
  still free per day, and the largest expense.
- **Spending through the month** — the running total of one-time costs per
  day against the month before, with a crosshair tooltip (pointer, touch and
  arrow keys).
- **Where it went** — one-time costs grouped by name (case-insensitive, tail
  folded into "Overige"), each with the month before alongside.
- **Per month** — up to six months of one-time costs; a column opens its month.
  Never starts before the account's first month.
- Largest expenses and recurring costs as monthly amounts.

The math is pure, in `src/lib/stats.ts`. A finished month uses its frozen
income and recurring costs (see *History: frozen months*); the current month
uses today's.

No chart library: the charts are HTML and a little SVG. Fills use the
`--color-chart-*` tokens in `globals.css`, chosen per theme and checked for
lightness, chroma, colour-blind separation and contrast on the card surface —
`--color-chart-1..4` are validated *in that order*, so re-run the checks before
reordering or changing one.

## Jaaroverzicht

`/jaar?year=YYYY` puts a year side by side: what was left in total, income and
costs, the best and weakest month, a column per month around a zero line
(above = money over, below = a shortfall), the same figures as a table with
totals, and the year's one-time costs per name plus the largest ones. A column
or a month name opens that month's statistics.

Only months the account was in use count: from its first month (creation, or an
earlier month an entry was filed under) up to the current one. Months still to
come are left out rather than projected. The current month is included but
marked as running, and it is never the "best" or "weakest" month — those need
two finished months. The year switcher stops at the first and the current year.

Each month is calculated like everywhere else: a finished month from its frozen
income and recurring costs, the current one from today's (`monthBases` in
`src/lib/history.ts` fetches the year's snapshots in one query). The math is
pure, in `src/lib/year.ts`.

## Install as an app

Vlot can be put on a phone's home screen and then opens full-screen, without
the browser bars:

- **Android (Chrome):** menu ⋮ → *App installeren* / *Toevoegen aan
  startscherm*. Long-pressing the icon offers shortcuts to Statistieken,
  Jaaroverzicht and Zoeken.
- **iPhone (Safari):** share button → *Zet op beginscherm*.

This needs the app to be served over **https** (or `localhost`); over plain
http on the local network a phone only makes a bookmark that opens in the
browser.

What makes it work: `src/app/manifest.ts` (name, colours, icons, shortcuts),
the PNG icons in `public/icons/` (rounded ones, plus full-bleed "maskable" ones
the launcher crops to its own shape) and `src/app/apple-icon.png` for iOS — all
rendered from the shapes in `icon.svg`. A `theme-color` meta tag follows the
light/dark toggle (`src/lib/theme.ts`) so the status bar matches the page.
There is no service worker on purpose: every page is rendered per request
behind a login, so there is nothing useful to show offline.

## Planner layout

The **Indeling** button next to the month switcher opens an editor
(`?indeling=1`) where the planner's sections can be moved up or down and
hidden. The layout is saved per account in `settings.planner_layout` (null =
default) and always read through `parseLayout` (`src/lib/planner-layout.ts`),
which drops unknown section ids and appends sections it doesn't mention — so a
section added to the app later shows up for everyone. Hidden sections are
listed under the planner with a link back to the editor; "Standaard herstellen"
resets everything.

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
    layout.tsx              # root shell + globals.css + no-flash theme script + theme-color
    manifest.ts             # web app manifest: install to the home screen
    apple-icon.png          # iOS home-screen icon
    page.tsx                # planner: requireUser(), reads this user's data, composes UI
    actions.ts             # setIncome / addExpense / updateExpense / deleteExpense / logout (Zod, userId-scoped)
    app-header.tsx          # title + page nav (Planner / Statistieken / Jaar / …) + theme + logout
    theme-toggle.tsx        # client light/dark toggle
    month-nav.tsx           # prev/next month links (?month=YYYY-MM)
    collapsible.tsx         # client fold-away section header (state in a cookie)
    layout-panel.tsx        # planner layout editor: reorder / hide sections
    income-form.tsx         # client form -> setIncome
    expense-form.tsx        # client form -> addExpense + quick-adds
    expense-row.tsx         # client row: inline edit + reorder + delete
    quick-add-bar.tsx       # client quick-add row: built-ins, own buttons, + Eigen, hide/restore
    reserve-balance-form.tsx # client: "what is set aside now" field in the results panel
    budget-section.tsx      # client: budget form + a meter per budget (edit/delete)
    budget-meter.tsx        # one budget as a meter; shared with the statistics page
    one-time-section.tsx    # one-off costs or income: form + month list + total
    one-time-form.tsx       # client add form (name, amount, date) + quick-adds (shared by both)
    one-time-row.tsx        # client row: date, inline edit (name/amount/date), delete
    frequency-select.tsx    # native <select> sharing the Input look
    results-panel.tsx       # three totals + reserve breakdown
    samen/page.tsx          # household view: combined month, per-person table, categories
    zoeken/
      page.tsx              # search form, totals, results grouped per month
      search.ts             # the query, shared with the export
    export/route.ts         # CSV downloads (one-time entries, recurring costs)
    statistieken/
      page.tsx              # one month: queries, figures, layout
      money-bar.tsx         # income split into fixed / set-aside / one-time / left
      spending-chart.tsx    # client line chart: running total vs the month before
      month-columns.tsx     # one-time costs per month; columns link to their month
      bar-list.tsx          # ranked bars with amount, share and last month's figure
      parts.tsx             # heading / empty note / stat tile, shared with the year page
    jaar/
      page.tsx              # one year: totals, best/weakest month, table, categories
      year-columns.tsx      # what was left per month, columns around a zero line
    beheer/
      page.tsx              # admin: accounts (create / new password / delete) + households
      forms.tsx             # client forms: create account, new password, household picker
      actions.ts            # admin server actions, each guarded by requireAdmin()
    login/
      page.tsx              # password-only gate
      login-form.tsx        # client form -> login action
      actions.ts            # match password against accounts + set cookie
  lib/
    session.ts              # cookie sign/verify (carries userId), requireUser(), requireAdmin()
    password.ts             # scrypt hash/verify for stored account passwords
    budget.ts               # frequency config + pure normalization/summarize
    month.ts                # month + day keys, Belgian "today", month bounds, default day
    stats.ts                # pure statistics math: running totals, categories, trend months, scale
    year.ts                 # pure year math: counted months, per-month figures, totals, best/weakest
    theme.ts                # page background per theme, for the theme-color meta tag
    collapse.ts             # collapsed-sections cookie: ids, parse, serialize
    list-sort.ts            # newest/oldest-first cookie for the one-time lists
    planner-layout.ts       # section order + hidden sections: parse, edit, defaults
    budgets.ts              # pure budget math: spent, remaining, state per budget
    csv.ts                  # CSV for Belgian Excel: cells, amounts, dates
    reserve.ts              # due dates: next occurrence, months left, should-have-saved
    history.ts              # frozen months: ensureSnapshots, monthBasis(es), refreeze
    household.ts            # which household an account shares, and its members
    quick-adds.ts           # built-in quick-add buttons per category
    format.ts               # nl-BE euro + short day labels
    utils.ts                # cn()
  db/
    index.ts                # Drizzle client (node-postgres)
    schema.ts               # users + expenses + one-time expenses/incomes + quick-adds (own + hidden) + settings
  components/ui/            # button, input, label, card
public/icons/               # PNG app icons for the manifest (192/512, rounded + maskable)
scripts/
  create-user.mjs           # provision/reset an account (npm run user:create)
  household.mjs             # link/unlink accounts into a household (npm run household)
  set-admin.mjs             # grant/revoke admin rights (npm run user:admin)
drizzle.config.ts           # migration config
```

## Next pass

- A 12-month cashflow chart (the reserve math already gives the per-month figures).

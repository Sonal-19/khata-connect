# Khata Connect

A lena-dena ledger for the people you trust: money you **gave** and **got**, loans
**lent or borrowed with interest** (₹1 sainkda / month or any yearly rate), and cash
**kept with someone else** that is partly lent out — with interest worked out to the
rupee, the way a family Excel khata does it. Responsive, installable (PWA), light/dark.

## Stack

| Layer | Tech |
| --- | --- |
| Runtime / workspaces | Bun workspaces (`apps/*`) |
| API | Elysia + TypeBox, Drizzle ORM (1.0 rc) + PostgreSQL, nodemailer |
| Web | Vite 8, React 19, TanStack Router (file-based) + Query, Eden Treaty, Tailwind v4, Radix UI, Recharts, vaul, sonner |
| Tooling | TypeScript 7, Biome |

Same architecture as `finance-tracker`, but a separate project and database.

## First run

```bash
createdb khata_connect
cp apps/api/.env.example apps/api/.env
bun install
bun run --cwd apps/api db:push
bun run --cwd apps/api db:seed     # optional demo data
bun run dev                        # api :4400 + web :3400
```

Open http://localhost:3400.

- **Seeded accounts** (log in with email *or* username):
  - `@demo` (`demo@khataconnect.local` / `Demo@1234`) — the demo khata; has a pending invite from Ravi
  - `@ravi` (`ravi@khataconnect.local` / `Demo@1234`) — sees demo's "Ravi Sharma" ledger under *Shared with me*
  - `@admin` (`admin@khataconnect.local` / `Admin@1234`) — admin dashboard at `/admin`
- Make your own account an admin: `bun run --cwd apps/api db:make-admin <email|username>`
- Database created before usernames existed: `bun run --cwd apps/api db:backfill-usernames && bun run --cwd apps/api db:push`
- **Dev OTP**: outside production every OTP flow accepts **`123456`** (the real code is also logged).

## Features

- Landing page with register (name, email OTP, unique **@username** with live availability) / log in with **email or username**, forgot password, change password / username, delete account
- **Tag people with their @username**: they accept the invite and see the same ledger from their side ("owed by you" / "owed to you"), read-only; either side can unlink
- **Admin dashboard**: total users, new this week / month, signups chart, records count (never amounts), search users, create users, make / remove admins, delete users
- **People** (no account needed on their side) with a live balance: “will give you” / “you will give”
- **You gave / You got** entries with mode (cash, UPI, bank, cheque), reason, note; undo delete
- **Loans** lent or borrowed: simple interest per month or per year, counted in completed
  months (Excel `DATEDIF "M"`) or daily; top-ups, principal / interest payments, interest
  waivers, close / reopen (interest stops on the close date), due date, interest day, security
- **Money held by** — lend out of cash someone keeps for you; their balance moves with every payout and repayment
- Per-payment interest breakdown (like a sheet's “interest accumulation” column) and **interest by financial year** (Apr–Mar)
- Dashboard: net position, held by people, lent out, interest due, what you owe, chart over time,
  upcoming interest dates / due / overdue loans, top balances, recent activity
- Statement per person with running balance — print / save as PDF, CSV export
- **WhatsApp reminders** with the exact amounts (opens WhatsApp, you press send)
- **Import from Excel / CSV**: column auto-mapping, sign convention, interest rows → one loan, preview totals before importing
- Interest calculator (also on the landing page), activity feed with search + CSV, full CSV backup

## What's where

| Path | Purpose |
| --- | --- |
| `apps/api/src/lib/utils/interest.ts` | All interest maths (pure; imported by the web too) |
| `apps/api/src/lib/services/book-service.ts` | Loads a user's book and computes every balance |
| `apps/api/src/lib/services/share-service.ts` | Tagged links + "mirroring" a ledger to the other person's side |
| `apps/api/src/controllers/*` | `/api/auth`, `/connections`, `/entries`, `/loans`, `/dashboard`, `/activity`, `/import`, `/shared`, `/users/lookup`, `/admin` |
| `apps/api/src/db/schema/*` | Drizzle tables (money in **paise**) |
| `apps/web/src/routes/*` | `index` = landing + auth, `_app/*` = logged-in app |
| `apps/web/src/lib/xlsx.ts`, `import-mapping.ts` | Spreadsheet reader + mapping to entries / loans |
| `apps/api/scripts/smoke.ts` | In-process API smoke test against the seeded demo user |

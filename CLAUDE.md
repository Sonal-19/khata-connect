# Khata Connect

Bun workspaces monorepo: `apps/api` (Elysia + Drizzle + Postgres) and `apps/web` (Vite + React 19 + TanStack Router/Query).
Architecture mirrors `~/Developer/Projects/finance-tracker`, but this is a separate product, repo and database — never share code by importing across the two projects.

- Ports: API **4500**, web **3400** (Vite proxies `/api`). DB: `khata_connect` on local Postgres.
- Commands: `bun run dev`, `bun run typecheck`, `bun run lint`, `bun run --cwd apps/api db:push | db:seed`, `bun apps/api/scripts/smoke.ts` (from `apps/api`).
- Brand name lives in `apps/web/src/lib/brand.ts`, `apps/api/src/env.ts` (`APP_NAME`), `index.html`, `vite.config.ts`.
- Money is stored in **paise** (bigint) and sent over the API in rupees. INR only, `en-IN`.
- Dates are date-only `yyyy-MM-dd` strings in `Asia/Kolkata`; Eden uses `parseDate: false`.
- Every response uses `ok()` / `fail()`; the web unwraps with `call()` / `callMsg()`.
- Logged-in routes use `protectedUser` and are grouped in `controllers/index.ts`. Every query filters by the session `user.id`.
- Dev OTP `123456` works whenever `NODE_ENV !== "production"`.
- Domain: `connections` (people) → `entries` (`gave` = + their balance, `got` = −) and `loans` (`lent`/`borrowed`) with `loan_events` (`disbursement`, `principal`, `interest`, `waiver`). Loan principal is never stored; it is Σ disbursements − Σ principal.
- `loans.via_connection_id` = the money moved through someone who holds the user's cash; `viaEffect()` in `book-service.ts` applies each event to that holder's balance.
- Interest maths lives only in `apps/api/src/lib/utils/interest.ts` (pure, no env/db imports). The web imports it via `@api/lib/utils/interest` — keep it pure. Simple interest per principal movement × monthly rate × elapsed (completed months like Excel DATEDIF "M", or days × 12/365); accrual stops at `closed_on`.
- All balances are computed in memory from the whole book (`loadBook` + `summarizeBook`); keep that the single source of truth.
- Colours: `--got` teal (money in), `--gave` orange (money out), rani pink (rose) primary; the net-position card uses `--hero-from/--hero-to`; amounts always carry a sign or label too.
- Phones (<768px): bottom tab bar + FAB → quick-add sheet; forms open in `ResponsiveSheet` (vaul). Global sheets live in `stores/sheets-store.ts`. Person pickers create new people inline (no nested sheets).
- Users have a unique lowercase `username` (`^[a-z0-9_.]{3,16}$`, `USERNAME_PATTERN` in `lib/utils`) and a `role` (`user` | `admin`). Username checks go through `usernameProblem()` in `user-service.ts`; reserved names are blocked for self-registration only. Login takes `identifier` = email or username (`findUserByLogin`).
- Admin routes (`admin-controller.ts`) check `role === "admin"` after `protectedUser`; they expose counts only, never anyone's people or amounts. `bun run --cwd apps/api db:make-admin <email|username>`. Every account change an admin makes is written to `admin_actions` (usernames snapshotted; null actor = CLI) and shown at `/admin/activity`. Under `/admin` the shell swaps to `ADMIN_NAV` (Overview, Users, Admin activity, "My khata" exit) — no ledger nav or quick-add.
- Tagging: `connection_links` (owner's connection → target user, `pending | accepted | declined | removed`; one live link per connection and per owner/target pair). The target gets a read-only mirror: `mirrorSummary` / `mirrorLedger` / `mirrorLoan` in `share-service.ts` flip signs and lent ↔ borrowed. Shared balances are shown separately, never added to the viewer's own totals.
- Sheets opened from dropdown items rely on `ResponsiveSheet` ignoring focus-outside (the menu returns focus to its trigger).
- Seeded accounts: `@demo`, `@ravi` (Demo@1234), `@admin` (Admin@1234), all `*@khataconnect.local`.


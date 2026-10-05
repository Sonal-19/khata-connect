import { inArray } from "drizzle-orm";
import { db } from "$/db";
import {
  connectionLinksTable,
  connectionsTable,
  entriesTable,
  loanEventsTable,
  loansTable,
  usersTable,
} from "$/db/schema";
import { toPaise } from "$/lib/utils/money";

/**
 * Accounts (all local-only):
 *   demo@khataconnect.local  / @demo  / Demo@1234   — the main demo book
 *   ravi@khataconnect.local  / @ravi  / Demo@1234   — sees demo's "Ravi Sharma" ledger (accepted link)
 *   admin@khataconnect.local / @admin / Admin@1234  — admin dashboard
 *
 * Demo book:
 * Modelled on a typical family khata — cash kept with a relative, part of
 * it lent out at 1% a month, a few small udhaar entries with friends and a
 * business loan taken at 12% a year.
 */
const EMAIL = "demo@khataconnect.local";
const RAVI_EMAIL = "ravi@khataconnect.local";
const ADMIN_EMAIL = "admin@khataconnect.local";

await db
  .delete(usersTable)
  .where(inArray(usersTable.email, [EMAIL, RAVI_EMAIL, ADMIN_EMAIL]));

const demoHash = await Bun.password.hash("Demo@1234");
const [user, raviUser] = await db
  .insert(usersTable)
  .values([
    {
      name: "Demo User",
      email: EMAIL,
      username: "demo",
      passwordHash: demoHash,
    },
    {
      name: "Ravi Sharma",
      email: RAVI_EMAIL,
      username: "ravi",
      passwordHash: demoHash,
    },
    {
      name: "Admin",
      email: ADMIN_EMAIL,
      username: "admin",
      role: "admin" as const,
      passwordHash: await Bun.password.hash("Admin@1234"),
    },
  ])
  .returning();
const userId = user!.id;

const people = await db
  .insert(connectionsTable)
  .values([
    {
      userId,
      name: "Ravi Sharma",
      relation: "family",
      phone: "9876500001",
      note: "Keeps the family cash. Deposits go to his HDFC account.",
    },
    { userId, name: "Amit Verma", relation: "friend", phone: "9876500002" },
    { userId, name: "Neha Gupta", relation: "friend", phone: "9876500003" },
    {
      userId,
      name: "Kapoor Traders",
      relation: "business",
      phone: "9876500004",
    },
    { userId, name: "Pooja Singh", relation: "colleague" },
  ])
  .returning();
const [ravi, amit, neha, kapoor, pooja] = people.map((p) => p.id) as [
  number,
  number,
  number,
  number,
  number,
];

const e = (
  connectionId: number,
  type: "gave" | "got",
  amount: number,
  date: string,
  reason: string,
  mode: "cash" | "upi" | "bank" = "cash",
  note?: string,
) => ({
  userId,
  connectionId,
  type,
  amount: toPaise(amount),
  date,
  reason,
  mode,
  note: note ?? null,
});

await db
  .insert(entriesTable)
  .values([
    e(ravi, "gave", 232000, "2024-01-01", "Initial funds", "bank"),
    e(ravi, "gave", 48000, "2024-01-14", "Initial funds"),
    e(ravi, "gave", 10000, "2024-04-15", "More cash in April"),
    e(ravi, "got", 10000, "2024-04-15", "Paid to Meena on my behalf"),
    e(ravi, "gave", 22000, "2024-09-18", "Cash", "cash", "Deposited in HDFC"),
    e(ravi, "gave", 20000, "2024-11-15", "Cash before Diwali"),
    e(ravi, "got", 9000, "2024-12-18", "Cash given to Lali ji"),
    e(ravi, "gave", 80000, "2025-04-04", "Cash deposit"),
    e(ravi, "gave", 40000, "2025-06-10", "Additional cash"),
    e(ravi, "got", 8000, "2025-06-20", "UPI for gold purchase", "upi"),
    e(ravi, "gave", 15000, "2025-08-08", "Before Rakhi"),
    e(ravi, "gave", 50000, "2025-10-21", "Cash deposited", "bank"),
    e(ravi, "got", 3000, "2025-11-24", "Recharge + repairs", "upi"),
    e(ravi, "gave", 50000, "2026-03-10", "Family savings", "upi"),
    e(neha, "gave", 5000, "2026-06-02", "Rent shortfall", "upi"),
    e(neha, "got", 2000, "2026-07-01", "Part payment", "upi"),
    e(pooja, "got", 1500, "2026-09-12", "Office lunch she paid", "upi"),
  ]);

// Lent out of the money Ravi holds, 1% a month, interest due on the 15th.
const [amitLoan] = await db
  .insert(loansTable)
  .values({
    userId,
    connectionId: amit,
    viaConnectionId: ravi,
    direction: "lent",
    title: "Loan to Amit",
    interestType: "simple",
    ratePercent: 1,
    ratePeriod: "month",
    basis: "months",
    interestDay: 15,
    collateral: "Signed promissory note",
    note: "Interest of 1% every month on the 15th",
  })
  .returning();
await db.insert(loanEventsTable).values([
  {
    loanId: amitLoan!.id,
    kind: "disbursement",
    amount: toPaise(200000),
    date: "2024-02-15",
    mode: "bank",
    note: "Initial amount",
  },
  {
    loanId: amitLoan!.id,
    kind: "disbursement",
    amount: toPaise(100000),
    date: "2024-11-15",
    mode: "bank",
    note: "Top-up",
  },
  {
    loanId: amitLoan!.id,
    kind: "principal",
    amount: toPaise(100000),
    date: "2026-01-01",
    mode: "bank",
    note: "Returned to Ravi",
  },
  {
    loanId: amitLoan!.id,
    kind: "interest",
    amount: toPaise(2000),
    date: "2026-09-15",
    mode: "upi",
  },
]);

// Borrowed for the shop, 12% a year, daily interest, due in 18 months.
const [kapoorLoan] = await db
  .insert(loansTable)
  .values({
    userId,
    connectionId: kapoor,
    direction: "borrowed",
    title: "Shop stock loan",
    interestType: "simple",
    ratePercent: 12,
    ratePeriod: "year",
    basis: "days",
    interestDay: 1,
    dueDate: "2026-11-01",
  })
  .returning();
await db.insert(loanEventsTable).values([
  {
    loanId: kapoorLoan!.id,
    kind: "disbursement",
    amount: toPaise(50000),
    date: "2025-05-01",
    mode: "bank",
    note: "Initial amount",
  },
  {
    loanId: kapoorLoan!.id,
    kind: "principal",
    amount: toPaise(20000),
    date: "2026-02-01",
    mode: "bank",
  },
  {
    loanId: kapoorLoan!.id,
    kind: "interest",
    amount: toPaise(4500),
    date: "2026-02-01",
    mode: "bank",
  },
]);

// Demo tagged "Ravi Sharma" as @ravi and Ravi accepted: Ravi sees that
// ledger mirrored ("owed by you").
await db.insert(connectionLinksTable).values({
  connectionId: ravi,
  ownerUserId: userId,
  targetUserId: raviUser!.id,
  status: "accepted",
  respondedAt: new Date(),
});

// Ravi keeps his own small book and has invited @demo (pending).
const [demoInRavi] = await db
  .insert(connectionsTable)
  .values({ userId: raviUser!.id, name: "Demo User", relation: "family" })
  .returning();
await db.insert(entriesTable).values([
  {
    userId: raviUser!.id,
    connectionId: demoInRavi!.id,
    type: "gave",
    amount: toPaise(3500),
    date: "2026-09-02",
    reason: "Paid electricity bill for you",
    mode: "upi",
  },
]);
await db.insert(connectionLinksTable).values({
  connectionId: demoInRavi!.id,
  ownerUserId: raviUser!.id,
  targetUserId: userId,
});

console.info(
  "Seeded @demo, @ravi (Demo@1234) and @admin (Admin@1234) — *@khataconnect.local",
);
process.exit(0);

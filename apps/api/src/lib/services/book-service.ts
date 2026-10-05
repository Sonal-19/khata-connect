import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "$/db";
import {
  connectionsTable,
  entriesTable,
  loanEventsTable,
  loansTable,
  type SelectConnection,
  type SelectEntry,
  type SelectLoan,
  type SelectLoanEvent,
} from "$/db/schema";
import {
  addMonths,
  interestByFinancialYear,
  type LoanSummary,
  monthlyRate,
  nextOnDay,
  summarizeLoan,
} from "$/lib/utils/interest";
import { toRupees } from "$/lib/utils/money";

/**
 * Everything a user has recorded. Personal ledgers are small (hundreds of
 * rows), so every summary is computed from the full book in memory — one
 * source of truth for balances, interest and charts.
 */
export type Book = {
  connections: SelectConnection[];
  entries: SelectEntry[];
  loans: SelectLoan[];
  events: SelectLoanEvent[];
};

export async function loadBook(userId: number): Promise<Book> {
  const [connections, entries, loans] = await Promise.all([
    db
      .select()
      .from(connectionsTable)
      .where(eq(connectionsTable.userId, userId))
      .orderBy(asc(connectionsTable.name)),
    db
      .select()
      .from(entriesTable)
      .where(eq(entriesTable.userId, userId))
      .orderBy(asc(entriesTable.date), asc(entriesTable.id)),
    db
      .select()
      .from(loansTable)
      .where(eq(loansTable.userId, userId))
      .orderBy(asc(loansTable.id)),
  ]);
  const events = loans.length
    ? await db
        .select()
        .from(loanEventsTable)
        .where(
          inArray(
            loanEventsTable.loanId,
            loans.map((l) => l.id),
          ),
        )
        .orderBy(asc(loanEventsTable.date), asc(loanEventsTable.id))
    : [];
  return { connections, entries, loans, events };
}

export async function ownedConnection(userId: number, id: number) {
  const [row] = await db
    .select()
    .from(connectionsTable)
    .where(
      and(eq(connectionsTable.id, id), eq(connectionsTable.userId, userId)),
    )
    .limit(1);
  return row;
}

export async function ownedLoan(userId: number, id: number) {
  const [row] = await db
    .select()
    .from(loansTable)
    .where(and(eq(loansTable.id, id), eq(loansTable.userId, userId)))
    .limit(1);
  return row;
}

/** + when the user's money ends up with the connection. */
export const entrySigned = (e: Pick<SelectEntry, "type" | "amount">) =>
  e.type === "gave" ? e.amount : -e.amount;

/**
 * Effect of a loan event on the balance of the connection the money moved
 * through. Lending out of funds someone holds for you lowers what they hold;
 * repayments collected by them raise it. Borrowed money is the mirror image.
 */
export function viaEffect(
  loan: Pick<SelectLoan, "viaConnectionId" | "direction">,
  e: Pick<SelectLoanEvent, "kind" | "amount">,
) {
  if (!loan.viaConnectionId || e.kind === "waiver") return 0;
  const out = e.kind === "disbursement";
  const sign = loan.direction === "lent" ? (out ? -1 : 1) : out ? 1 : -1;
  return sign * e.amount;
}

const round = (n: number) => Math.round(n);

export type ConnectionSummary = {
  /** Plain entries + money moved through them for loans. */
  ledger: number;
  lentPrincipal: number;
  lentInterest: number;
  borrowedPrincipal: number;
  borrowedInterest: number;
  /** + = they have / owe you this much, − = you owe them. */
  net: number;
  activeLoans: number;
  lastActivity: string | null;
};

const emptySummary = (): ConnectionSummary => ({
  ledger: 0,
  lentPrincipal: 0,
  lentInterest: 0,
  borrowedPrincipal: 0,
  borrowedInterest: 0,
  net: 0,
  activeLoans: 0,
  lastActivity: null,
});

export function summarizeBook(book: Book, asOf: string) {
  const byConn = new Map<number, ConnectionSummary>(
    book.connections.map((c) => [c.id, emptySummary()]),
  );
  const touch = (id: number | null, date: string) => {
    const s = id === null ? undefined : byConn.get(id);
    if (s && (!s.lastActivity || date > s.lastActivity)) s.lastActivity = date;
    return s;
  };

  for (const e of book.entries) {
    if (e.date > asOf) continue;
    const s = touch(e.connectionId, e.date);
    if (s) s.ledger += entrySigned(e);
  }

  const eventsByLoan = new Map<number, SelectLoanEvent[]>();
  for (const e of book.events) {
    const list = eventsByLoan.get(e.loanId) ?? [];
    list.push(e);
    eventsByLoan.set(e.loanId, list);
  }

  const loans = new Map<
    number,
    {
      loan: SelectLoan;
      events: SelectLoanEvent[];
      summary: ReturnType<typeof summarizeLoan<SelectLoanEvent>>;
    }
  >();
  for (const loan of book.loans) {
    const events = eventsByLoan.get(loan.id) ?? [];
    const summary = summarizeLoan(loan, events, asOf);
    loans.set(loan.id, { loan, events, summary });

    for (const e of events) {
      if (e.date > asOf) continue;
      touch(loan.connectionId, e.date);
      const via = touch(loan.viaConnectionId, e.date);
      if (via) via.ledger += viaEffect(loan, e);
    }
    const s = byConn.get(loan.connectionId);
    if (!s) continue;
    if (loan.direction === "lent") {
      s.lentPrincipal += summary.principalOut;
      s.lentInterest += summary.interestDue;
    } else {
      s.borrowedPrincipal += summary.principalOut;
      s.borrowedInterest += summary.interestDue;
    }
    if (loan.status === "active") s.activeLoans += 1;
  }

  const totals = {
    /** Sum of positive plain balances: money other people hold for you. */
    heldByOthers: 0,
    /** Sum of negative plain balances: money you hold / owe without interest. */
    heldForOthers: 0,
    lentPrincipal: 0,
    lentInterest: 0,
    borrowedPrincipal: 0,
    borrowedInterest: 0,
    toReceive: 0,
    toPay: 0,
    net: 0,
  };
  for (const s of byConn.values()) {
    for (const k of [
      "ledger",
      "lentPrincipal",
      "lentInterest",
      "borrowedPrincipal",
      "borrowedInterest",
    ] as const)
      s[k] = round(s[k]);
    s.net =
      s.ledger +
      s.lentPrincipal +
      s.lentInterest -
      s.borrowedPrincipal -
      s.borrowedInterest;
    if (s.ledger > 0) totals.heldByOthers += s.ledger;
    else totals.heldForOthers -= s.ledger;
    totals.lentPrincipal += s.lentPrincipal;
    totals.lentInterest += s.lentInterest;
    totals.borrowedPrincipal += s.borrowedPrincipal;
    totals.borrowedInterest += s.borrowedInterest;
    if (s.net > 0) totals.toReceive += s.net;
    else totals.toPay -= s.net;
    totals.net += s.net;
  }
  return { byConn, loans, totals };
}

/* ---------- API shapes (paise → rupees) ---------- */

export const connectionSummaryDto = (s: ConnectionSummary) => ({
  ...s,
  ledger: toRupees(s.ledger),
  lentPrincipal: toRupees(s.lentPrincipal),
  lentInterest: toRupees(s.lentInterest),
  borrowedPrincipal: toRupees(s.borrowedPrincipal),
  borrowedInterest: toRupees(s.borrowedInterest),
  net: toRupees(s.net),
});

export function totalsDto(t: ReturnType<typeof summarizeBook>["totals"]) {
  return Object.fromEntries(
    Object.entries(t).map(([k, v]) => [k, toRupees(v)]),
  ) as typeof t;
}

export function loanSummaryDto(s: LoanSummary) {
  return {
    startDate: s.startDate,
    lastPaymentDate: s.lastPaymentDate,
    disbursed: toRupees(round(s.disbursed)),
    principalRepaid: toRupees(round(s.principalRepaid)),
    principalOut: toRupees(round(s.principalOut)),
    accrued: toRupees(round(s.accrued)),
    interestPaid: toRupees(round(s.interestPaid)),
    waived: toRupees(round(s.waived)),
    interestDue: toRupees(round(s.interestDue)),
    totalDue: toRupees(round(s.totalDue)),
    monthlyInterest: toRupees(round(s.monthlyInterest)),
    monthsPending: Math.round(s.monthsPending * 10) / 10,
  };
}

export function loanDto(
  loan: SelectLoan,
  summary: LoanSummary,
  names: Map<number, string>,
) {
  const { userId: _userId, createdAt: _createdAt, ...rest } = loan;
  return {
    ...rest,
    connectionName: names.get(loan.connectionId) ?? "Unknown",
    viaName: loan.viaConnectionId
      ? (names.get(loan.viaConnectionId) ?? null)
      : null,
    summary: loanSummaryDto(summary),
  };
}

export const connectionNames = (book: Book) =>
  new Map(book.connections.map((c) => [c.id, c.name]));

/* ---------- shared builders (owner pages + shared/mirrored views) ---------- */

const EVENT_LABEL = {
  disbursement: "Loan paid out",
  principal: "Principal repaid",
  interest: "Interest paid",
  waiver: "Interest waived",
} as const;

/**
 * Statement for one connection: their plain entries plus loan money that
 * moved through them, oldest first with a running balance.
 */
export function ledgerFor(book: Book, connectionId: number) {
  const names = connectionNames(book);
  const loans = new Map(book.loans.map((l) => [l.id, l]));
  const rows: {
    key: string;
    source: "entry" | "loan";
    id: number;
    loanId: number | null;
    date: string;
    /** Signed: + = their balance with you went up. */
    amount: number;
    reason: string;
    note: string | null;
    mode: string;
    createdAt: Date;
  }[] = [];

  for (const e of book.entries) {
    if (e.connectionId !== connectionId) continue;
    rows.push({
      key: `e${e.id}`,
      source: "entry",
      id: e.id,
      loanId: null,
      date: e.date,
      amount: entrySigned(e),
      reason: e.reason,
      note: e.note,
      mode: e.mode,
      createdAt: e.createdAt,
    });
  }
  for (const e of book.events) {
    const loan = loans.get(e.loanId);
    if (!loan || loan.viaConnectionId !== connectionId) continue;
    const effect = viaEffect(loan, e);
    if (!effect) continue;
    const party = names.get(loan.connectionId) ?? "Unknown";
    rows.push({
      key: `l${e.id}`,
      source: "loan",
      id: e.id,
      loanId: loan.id,
      date: e.date,
      amount: effect,
      reason: `${EVENT_LABEL[e.kind]} · ${loan.direction === "lent" ? "to" : "from"} ${party}`,
      note: e.note,
      mode: e.mode,
      createdAt: e.createdAt,
    });
  }

  rows.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
  let balance = 0;
  return rows.map(({ createdAt: _c, ...r }) => {
    balance += r.amount;
    return { ...r, amount: toRupees(r.amount), balance: toRupees(balance) };
  });
}

export type LedgerRowDto = ReturnType<typeof ledgerFor>[number];

/** Full loan page payload, or null when the loan isn't in this book. */
export function loanDetail(book: Book, loanId: number, asOf: string) {
  const { loans } = summarizeBook(book, asOf);
  const found = loans.get(loanId);
  if (!found) return null;
  const { loan, events, summary } = found;
  const names = connectionNames(book);

  // Next few expected interest dates at today's principal.
  const upcoming: { date: string; amount: number }[] = [];
  if (
    loan.status === "active" &&
    loan.interestDay &&
    summary.principalOut > 0 &&
    monthlyRate(loan) > 0
  ) {
    let d = nextOnDay(loan.interestDay, asOf);
    for (let i = 0; i < 6; i++) {
      upcoming.push({
        date: d,
        amount: toRupees(Math.round(summary.monthlyInterest)),
      });
      d = addMonths(d, 1, loan.interestDay);
    }
  }

  return {
    ...loanDto(loan, summary, names),
    events: summary.rows
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        date: r.date,
        mode: r.mode,
        note: r.note,
        amount: toRupees(r.amount),
        counted: r.counted,
        elapsed: Math.round(r.elapsed * 100) / 100,
        interest: toRupees(Math.round(r.interest)),
      }))
      .reverse(),
    byYear: interestByFinancialYear(loan, events, asOf).map((y) => ({
      ...y,
      accrued: toRupees(Math.round(y.accrued)),
      paid: toRupees(y.paid),
    })),
    upcoming,
  };
}

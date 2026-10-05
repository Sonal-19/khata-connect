import Elysia from "elysia";
import {
  type Book,
  connectionNames,
  connectionSummaryDto,
  loadBook,
  summarizeBook,
  totalsDto,
} from "$/lib/services/book-service";
import { sharedOverview } from "$/lib/services/share-service";
import { ok } from "$/lib/utils";
import {
  addDays,
  addMonths,
  monthEnd,
  monthlyRate,
  nextOnDay,
} from "$/lib/utils/interest";
import { toRupees } from "$/lib/utils/money";
import { today } from "$/lib/utils/period";
import { protectedUser } from "$/pre-processor";

const CHART_MONTHS = 24;

/** Every money movement as one list, newest first. */
function activity(book: Book) {
  const names = connectionNames(book);
  const loans = new Map(book.loans.map((l) => [l.id, l]));
  const rows = [
    ...book.entries.map((e) => ({
      key: `e${e.id}`,
      source: "entry" as const,
      id: e.id,
      loanId: null as number | null,
      connectionId: e.connectionId,
      connectionName: names.get(e.connectionId) ?? "Unknown",
      viaName: null as string | null,
      direction: null as "lent" | "borrowed" | null,
      kind: e.type as string,
      date: e.date,
      amount: toRupees(e.amount),
      title: e.reason,
      note: e.note,
      mode: e.mode,
      createdAt: e.createdAt,
    })),
    ...book.events.flatMap((e) => {
      const loan = loans.get(e.loanId);
      if (!loan) return [];
      return [
        {
          key: `l${e.id}`,
          source: "loan" as const,
          id: e.id,
          loanId: loan.id,
          connectionId: loan.connectionId,
          connectionName: names.get(loan.connectionId) ?? "Unknown",
          viaName: loan.viaConnectionId
            ? (names.get(loan.viaConnectionId) ?? null)
            : null,
          direction: loan.direction,
          kind: e.kind as string,
          date: e.date,
          amount: toRupees(e.amount),
          title: loan.title,
          note: e.note,
          mode: e.mode,
          createdAt: e.createdAt,
        },
      ];
    }),
  ];
  rows.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );
  return rows.map(({ createdAt: _c, ...r }) => r);
}

function firstDate(book: Book) {
  let first: string | null = null;
  for (const d of [
    ...book.entries.map((e) => e.date),
    ...book.events.map((e) => e.date),
  ])
    if (!first || d < first) first = d;
  return first;
}

/** Month-end snapshots of the whole book (net position over time). */
function chart(book: Book, asOf: string) {
  const first = firstDate(book);
  if (!first) return [];
  let start = `${first.slice(0, 7)}-01`;
  const earliest = addMonths(`${asOf.slice(0, 7)}-01`, -(CHART_MONTHS - 1));
  if (start < earliest) start = earliest;
  const points: string[] = [];
  for (let m = start; m <= asOf; m = addMonths(m, 1)) {
    const end = monthEnd(m);
    points.push(end < asOf ? end : asOf);
  }
  return points.map((date) => {
    const { totals: t } = summarizeBook(book, date);
    return {
      date,
      held: toRupees(t.heldByOthers - t.heldForOthers),
      loans: toRupees(t.lentPrincipal - t.borrowedPrincipal),
      interest: toRupees(t.lentInterest - t.borrowedInterest),
      net: toRupees(t.net),
    };
  });
}

export const dashboardController = new Elysia({ name: "dashboard_controller" })
  .use(protectedUser)
  .get("/dashboard", async ({ user }) => {
    const [book, shared] = await Promise.all([
      loadBook(user.id),
      sharedOverview(user.id),
    ]);
    const asOf = today();
    const { byConn, loans, totals } = summarizeBook(book, asOf);
    const names = connectionNames(book);

    // Interest dates in the next 45 days, loans due within 30 days, overdue loans.
    const soon = addDays(asOf, 45);
    const upcoming: {
      key: string;
      type: "interest" | "due" | "overdue";
      date: string;
      loanId: number;
      title: string;
      connectionName: string;
      direction: "lent" | "borrowed";
      amount: number;
    }[] = [];
    for (const { loan, summary } of loans.values()) {
      if (loan.status !== "active" || summary.totalDue <= 0) continue;
      const base = {
        loanId: loan.id,
        title: loan.title,
        connectionName: names.get(loan.connectionId) ?? "Unknown",
        direction: loan.direction,
      };
      if (
        loan.interestDay &&
        monthlyRate(loan) > 0 &&
        summary.principalOut > 0
      ) {
        for (
          let d = nextOnDay(loan.interestDay, asOf);
          d <= soon;
          d = addMonths(d, 1, loan.interestDay)
        )
          upcoming.push({
            ...base,
            key: `i${loan.id}-${d}`,
            type: "interest",
            date: d,
            amount: toRupees(Math.round(summary.monthlyInterest)),
          });
      }
      if (loan.dueDate && loan.dueDate <= addDays(asOf, 30))
        upcoming.push({
          ...base,
          key: `d${loan.id}`,
          type: loan.dueDate < asOf ? "overdue" : "due",
          date: loan.dueDate,
          amount: toRupees(Math.round(summary.totalDue)),
        });
    }
    upcoming.sort(
      (a, b) =>
        (a.type === "overdue" ? 0 : 1) - (b.type === "overdue" ? 0 : 1) ||
        a.date.localeCompare(b.date),
    );

    const people = book.connections
      .map((c) => ({
        id: c.id,
        name: c.name,
        relation: c.relation,
        summary: connectionSummaryDto(byConn.get(c.id)!),
      }))
      .filter((c) => c.summary.net !== 0)
      .sort((a, b) => Math.abs(b.summary.net) - Math.abs(a.summary.net));

    return ok({
      asOf,
      totals: totalsDto(totals),
      counts: {
        connections: book.connections.length,
        activeLoans: book.loans.filter((l) => l.status === "active").length,
        entries: book.entries.length + book.events.length,
      },
      monthlyInterestIncome: toRupees(
        Math.round(
          [...loans.values()]
            .filter(
              (l) => l.loan.direction === "lent" && l.loan.status === "active",
            )
            .reduce((s, l) => s + l.summary.monthlyInterest, 0),
        ),
      ),
      chart: chart(book, asOf),
      upcoming: upcoming.slice(0, 8),
      people: people.slice(0, 6),
      recent: activity(book).slice(0, 8),
      /** Ledgers other users shared with me (kept separate from my own totals). */
      shared: {
        pendingInvites: shared.invites.length,
        ledgers: shared.shared.length,
        ...shared.totals,
      },
    });
  })
  .get("/activity", async ({ user }) => ok(activity(await loadBook(user.id))));

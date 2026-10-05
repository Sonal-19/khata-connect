import { and, count, eq } from "drizzle-orm";
import Elysia, { t } from "elysia";
import { db } from "$/db";
import {
  interestBases,
  interestTypes,
  loanDirections,
  loanEventKinds,
  loanEventsTable,
  loansTable,
  paymentModes,
  ratePeriods,
} from "$/db/schema";
import {
  connectionNames,
  loadBook,
  loanDetail,
  loanDto,
  ownedConnection,
  ownedLoan,
  summarizeBook,
} from "$/lib/services/book-service";
import { fail, ok } from "$/lib/utils";
import { money } from "$/lib/utils/format";
import { toPaise, toRupees } from "$/lib/utils/money";
import { today } from "$/lib/utils/period";
import { tAmount, tDate, tEnum, tId, tNote } from "$/lib/utils/schema";
import { protectedUser } from "$/pre-processor";

const termsBody = {
  title: t.Optional(t.String({ maxLength: 80 })),
  interestType: tEnum(interestTypes),
  ratePercent: t.Number({ minimum: 0, maximum: 100 }),
  ratePeriod: tEnum(ratePeriods),
  basis: tEnum(interestBases),
  interestDay: t.Optional(t.Nullable(t.Integer({ minimum: 1, maximum: 31 }))),
  dueDate: t.Optional(t.Nullable(tDate)),
  viaConnectionId: t.Optional(t.Nullable(t.Integer())),
  collateral: t.Optional(tNote),
  note: t.Optional(tNote),
};

const eventBody = t.Object({
  kind: tEnum(loanEventKinds),
  amount: tAmount,
  date: tDate,
  mode: tEnum(paymentModes),
  note: t.Optional(tNote),
});

const EVENT_DONE = {
  disbursement: "Top-up of",
  principal: "Principal repayment of",
  interest: "Interest payment of",
  waiver: "Interest waiver of",
} as const;

async function ownedEvent(userId: number, eventId: number) {
  const [row] = await db
    .select({ event: loanEventsTable, loan: loansTable })
    .from(loanEventsTable)
    .innerJoin(loansTable, eq(loansTable.id, loanEventsTable.loanId))
    .where(and(eq(loanEventsTable.id, eventId), eq(loansTable.userId, userId)))
    .limit(1);
  return row;
}

async function checkVia(
  userId: number,
  connectionId: number,
  via: number | null | undefined,
) {
  if (via === null || via === undefined) return null;
  if (via === connectionId)
    return "The person holding the money can't be the borrower/lender too";
  return (await ownedConnection(userId, via))
    ? null
    : "Connection holding the money not found";
}

export const loansController = new Elysia({
  name: "loans_controller",
  prefix: "/loans",
})
  .use(protectedUser)
  .get("/", async ({ user }) => {
    const book = await loadBook(user.id);
    const { loans, totals } = summarizeBook(book, today());
    const names = connectionNames(book);
    return ok({
      loans: [...loans.values()]
        .map((l) => loanDto(l.loan, l.summary, names))
        .sort(
          (a, b) =>
            (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1) ||
            (b.summary.startDate ?? "").localeCompare(
              a.summary.startDate ?? "",
            ),
        ),
      totals: {
        lentPrincipal: toRupees(totals.lentPrincipal),
        lentInterest: toRupees(totals.lentInterest),
        borrowedPrincipal: toRupees(totals.borrowedPrincipal),
        borrowedInterest: toRupees(totals.borrowedInterest),
        /** Interest that active lent loans earn per month at today's principal. */
        monthlyIncome: toRupees(
          Math.round(
            [...loans.values()]
              .filter(
                (l) =>
                  l.loan.direction === "lent" && l.loan.status === "active",
              )
              .reduce((s, l) => s + l.summary.monthlyInterest, 0),
          ),
        ),
        monthlyCost: toRupees(
          Math.round(
            [...loans.values()]
              .filter(
                (l) =>
                  l.loan.direction === "borrowed" && l.loan.status === "active",
              )
              .reduce((s, l) => s + l.summary.monthlyInterest, 0),
          ),
        ),
      },
    });
  })
  .get(
    "/:id",
    async ({ user, params, status }) => {
      const detail = loanDetail(await loadBook(user.id), params.id, today());
      return detail ? ok(detail) : status(404, fail("Loan not found"));
    },
    { params: tId },
  )
  .post(
    "/",
    async ({ user, body, status }) => {
      const c = await ownedConnection(user.id, body.connectionId);
      if (!c) return status(404, fail("Connection not found"));
      const viaError = await checkVia(
        user.id,
        body.connectionId,
        body.viaConnectionId,
      );
      if (viaError) return status(400, fail(viaError));
      const { amount, date, mode, connectionId, direction, ...terms } = body;
      const loan = await db.transaction(async (tx) => {
        const [l] = await tx
          .insert(loansTable)
          .values({
            ...terms,
            title:
              terms.title?.trim() ||
              (direction === "lent"
                ? `Loan to ${c.name}`
                : `Loan from ${c.name}`),
            connectionId,
            direction,
            userId: user.id,
          })
          .returning();
        await tx.insert(loanEventsTable).values({
          loanId: l!.id,
          kind: "disbursement",
          amount: toPaise(amount),
          date,
          mode,
          note: "Initial amount",
        });
        return l!;
      });
      return ok(
        { id: loan.id },
        direction === "lent"
          ? `Loan of ${money(amount)} to ${c.name} recorded`
          : `Loan of ${money(amount)} from ${c.name} recorded`,
      );
    },
    {
      body: t.Object({
        ...termsBody,
        connectionId: t.Integer(),
        direction: tEnum(loanDirections),
        amount: tAmount,
        date: tDate,
        mode: tEnum(paymentModes),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ user, params, body, status }) => {
      const loan = await ownedLoan(user.id, params.id);
      if (!loan) return status(404, fail("Loan not found"));
      if (
        body.connectionId !== undefined &&
        !(await ownedConnection(user.id, body.connectionId))
      )
        return status(404, fail("Connection not found"));
      const viaError = await checkVia(
        user.id,
        body.connectionId ?? loan.connectionId,
        body.viaConnectionId === undefined
          ? loan.viaConnectionId
          : body.viaConnectionId,
      );
      if (viaError) return status(400, fail(viaError));
      await db
        .update(loansTable)
        .set({
          ...body,
          ...(body.title !== undefined && {
            title: body.title.trim() || loan.title,
          }),
        })
        .where(eq(loansTable.id, loan.id));
      return ok(null, "Loan updated");
    },
    {
      params: tId,
      body: t.Partial(
        t.Object({
          ...termsBody,
          connectionId: t.Integer(),
          direction: tEnum(loanDirections),
        }),
      ),
    },
  )
  .delete(
    "/:id",
    async ({ user, params, status }) => {
      const loan = await ownedLoan(user.id, params.id);
      if (!loan) return status(404, fail("Loan not found"));
      await db.delete(loansTable).where(eq(loansTable.id, loan.id));
      return ok(null, `${loan.title} deleted`);
    },
    { params: tId },
  )
  .post(
    "/:id/close",
    async ({ user, params, body, status }) => {
      const loan = await ownedLoan(user.id, params.id);
      if (!loan) return status(404, fail("Loan not found"));
      await db
        .update(loansTable)
        .set({ status: "closed", closedOn: body.date })
        .where(eq(loansTable.id, loan.id));
      return ok(
        null,
        `${loan.title} closed — interest stopped on ${body.date}`,
      );
    },
    { params: tId, body: t.Object({ date: tDate }) },
  )
  .post(
    "/:id/reopen",
    async ({ user, params, status }) => {
      const loan = await ownedLoan(user.id, params.id);
      if (!loan) return status(404, fail("Loan not found"));
      await db
        .update(loansTable)
        .set({ status: "active", closedOn: null })
        .where(eq(loansTable.id, loan.id));
      return ok(null, `${loan.title} reopened`);
    },
    { params: tId },
  )
  .post(
    "/:id/events",
    async ({ user, params, body, status }) => {
      const loan = await ownedLoan(user.id, params.id);
      if (!loan) return status(404, fail("Loan not found"));
      await db.insert(loanEventsTable).values({
        ...body,
        amount: toPaise(body.amount),
        loanId: loan.id,
      });
      return ok(
        null,
        `${EVENT_DONE[body.kind]} ${money(body.amount)} recorded`,
      );
    },
    { params: tId, body: eventBody },
  )
  .patch(
    "/events/:id",
    async ({ user, params, body, status }) => {
      const found = await ownedEvent(user.id, params.id);
      if (!found) return status(404, fail("Payment not found"));
      await db
        .update(loanEventsTable)
        .set({
          ...body,
          ...(body.amount !== undefined && { amount: toPaise(body.amount) }),
        })
        .where(eq(loanEventsTable.id, found.event.id));
      return ok(null, "Updated");
    },
    { params: tId, body: t.Partial(eventBody) },
  )
  .delete(
    "/events/:id",
    async ({ user, params, status }) => {
      const found = await ownedEvent(user.id, params.id);
      if (!found) return status(404, fail("Payment not found"));
      if (found.event.kind === "disbursement") {
        const [n] = await db
          .select({ n: count() })
          .from(loanEventsTable)
          .where(
            and(
              eq(loanEventsTable.loanId, found.loan.id),
              eq(loanEventsTable.kind, "disbursement"),
            ),
          );
        if ((n?.n ?? 0) <= 1)
          return status(
            400,
            fail("This is the loan's only payout — delete the loan instead"),
          );
      }
      await db
        .delete(loanEventsTable)
        .where(eq(loanEventsTable.id, found.event.id));
      return ok(null, "Deleted");
    },
    { params: tId },
  );

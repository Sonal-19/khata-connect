import { and, count, eq } from "drizzle-orm";
import Elysia, { t } from "elysia";
import { db } from "$/db";
import { connectionsTable, loansTable, relations } from "$/db/schema";
import {
  connectionNames,
  connectionSummaryDto,
  ledgerFor,
  loadBook,
  loanDto,
  ownedConnection,
  summarizeBook,
  totalsDto,
} from "$/lib/services/book-service";
import { liveLinksForOwner } from "$/lib/services/share-service";
import { fail, ok } from "$/lib/utils";
import { today } from "$/lib/utils/period";
import { tEnum, tId, tNote } from "$/lib/utils/schema";
import { protectedUser } from "$/pre-processor";

const connectionBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 80 }),
  phone: t.Optional(t.Nullable(t.String({ maxLength: 20 }))),
  email: t.Optional(t.Nullable(t.String({ maxLength: 254 }))),
  relation: tEnum(relations),
  note: t.Optional(tNote),
});

export const connectionsController = new Elysia({
  name: "connections_controller",
  prefix: "/connections",
})
  .use(protectedUser)
  .get("/", async ({ user }) => {
    const [book, links] = await Promise.all([
      loadBook(user.id),
      liveLinksForOwner(user.id),
    ]);
    const { byConn, totals } = summarizeBook(book, today());
    return ok({
      connections: book.connections.map((c) => ({
        ...c,
        summary: connectionSummaryDto(byConn.get(c.id)!),
        link: links.get(c.id) ?? null,
      })),
      totals: totalsDto(totals),
    });
  })
  .get(
    "/:id",
    async ({ user, params, status }) => {
      const [book, links] = await Promise.all([
        loadBook(user.id),
        liveLinksForOwner(user.id),
      ]);
      const connection = book.connections.find((c) => c.id === params.id);
      if (!connection) return status(404, fail("Connection not found"));
      const { byConn, loans } = summarizeBook(book, today());
      const names = connectionNames(book);
      return ok({
        connection,
        /** Registered user this person is tagged as (pending or accepted). */
        link: links.get(connection.id) ?? null,
        summary: connectionSummaryDto(byConn.get(connection.id)!),
        ledger: ledgerFor(book, connection.id).reverse(),
        loans: [...loans.values()]
          .filter((l) => l.loan.connectionId === connection.id)
          .map((l) => loanDto(l.loan, l.summary, names)),
        /** Loans funded through this person (they hold the money). */
        viaLoans: [...loans.values()]
          .filter((l) => l.loan.viaConnectionId === connection.id)
          .map((l) => loanDto(l.loan, l.summary, names)),
      });
    },
    { params: tId },
  )
  .post(
    "/",
    async ({ user, body }) => {
      const [row] = await db
        .insert(connectionsTable)
        .values({ ...body, name: body.name.trim(), userId: user.id })
        .returning();
      return ok(row!, `${row!.name} added`);
    },
    { body: connectionBody },
  )
  .patch(
    "/:id",
    async ({ user, params, body, status }) => {
      const c = await ownedConnection(user.id, params.id);
      if (!c) return status(404, fail("Connection not found"));
      const [row] = await db
        .update(connectionsTable)
        .set({ ...body, ...(body.name && { name: body.name.trim() }) })
        .where(eq(connectionsTable.id, c.id))
        .returning();
      return ok(row!, "Connection updated");
    },
    { params: tId, body: t.Partial(connectionBody) },
  )
  .delete(
    "/:id",
    async ({ user, params, status }) => {
      const c = await ownedConnection(user.id, params.id);
      if (!c) return status(404, fail("Connection not found"));
      const [via] = await db
        .select({ n: count() })
        .from(loansTable)
        .where(
          and(
            eq(loansTable.userId, user.id),
            eq(loansTable.viaConnectionId, c.id),
            eq(loansTable.status, "active"),
          ),
        );
      if (via && via.n > 0)
        return status(
          400,
          fail(
            `${c.name} holds money for ${via.n} active loan(s). Close or edit those loans first.`,
          ),
        );
      // Entries and loans with this person cascade.
      await db.delete(connectionsTable).where(eq(connectionsTable.id, c.id));
      return ok(null, `${c.name} deleted`);
    },
    { params: tId },
  );

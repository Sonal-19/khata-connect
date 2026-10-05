import { and, eq, inArray } from "drizzle-orm";
import Elysia, { t } from "elysia";
import { db } from "$/db";
import { connectionLinksTable } from "$/db/schema";
import {
  connectionNames,
  connectionSummaryDto,
  ledgerFor,
  loadBook,
  loanDetail,
  loanDto,
  ownedConnection,
  summarizeBook,
} from "$/lib/services/book-service";
import { clientIp, rateLimitService } from "$/lib/services/rate-limit-service";
import {
  incomingLinks,
  LIVE_LINK,
  mirrorLedger,
  mirrorLoan,
  mirrorSummary,
  sharedOverview,
} from "$/lib/services/share-service";
import { findUserByUsername } from "$/lib/services/user-service";
import { fail, isUniqueViolation, ok } from "$/lib/utils";
import { today } from "$/lib/utils/period";
import { tId, tUsername } from "$/lib/utils/schema";
import { protectedUser } from "$/pre-processor";

async function incomingLink(userId: number, linkId: number) {
  const [link] = (await incomingLinks(userId, [...LIVE_LINK])).filter(
    (l) => l.id === linkId,
  );
  return link;
}

export const linksController = new Elysia({ name: "links_controller" })
  .use(protectedUser)
  /* ---------- owner side ---------- */
  .get(
    "/users/lookup",
    async ({ user, query, status, request, server }) => {
      if (
        !rateLimitService.hit(
          `lookup:${clientIp(request, server)}`,
          60,
          600_000,
        )
      )
        return status(429, fail("Too many lookups. Try again later."));
      const found = await findUserByUsername(query.username);
      if (!found)
        return status(404, fail("No Khata Connect user with that username"));
      if (found.id === user.id)
        return status(400, fail("That's your own username"));
      return ok({ username: found.username, name: found.name });
    },
    { query: t.Object({ username: tUsername }) },
  )
  .post(
    "/connections/:id/link",
    async ({ user, params, body, status }) => {
      const c = await ownedConnection(user.id, params.id);
      if (!c) return status(404, fail("Connection not found"));
      const target = await findUserByUsername(body.username);
      if (!target)
        return status(404, fail("No Khata Connect user with that username"));
      if (target.id === user.id)
        return status(400, fail("You can't tag yourself"));
      try {
        await db.insert(connectionLinksTable).values({
          connectionId: c.id,
          ownerUserId: user.id,
          targetUserId: target.id,
        });
      } catch (e) {
        if (isUniqueViolation(e))
          return status(
            409,
            fail(
              `${c.name} is already linked, or @${target.username} is already linked to another person in your book`,
            ),
          );
        throw e;
      }
      return ok(
        { username: target.username, name: target.name },
        `Invite sent to @${target.username}`,
      );
    },
    { params: tId, body: t.Object({ username: tUsername }) },
  )
  .delete(
    "/connections/:id/link",
    async ({ user, params, status }) => {
      const c = await ownedConnection(user.id, params.id);
      if (!c) return status(404, fail("Connection not found"));
      const removed = await db
        .update(connectionLinksTable)
        .set({ status: "removed", respondedAt: new Date() })
        .where(
          and(
            eq(connectionLinksTable.connectionId, c.id),
            eq(connectionLinksTable.ownerUserId, user.id),
            inArray(connectionLinksTable.status, [...LIVE_LINK]),
          ),
        )
        .returning();
      return removed.length
        ? ok(null, `${c.name} is no longer linked`)
        : status(404, fail("Not linked"));
    },
    { params: tId },
  )
  /* ---------- tagged side ---------- */
  .get("/shared", async ({ user }) => {
    return ok(await sharedOverview(user.id));
  })
  .post(
    "/shared/:id/accept",
    async ({ user, params, status }) => {
      const link = await incomingLink(user.id, params.id);
      if (link?.status !== "pending")
        return status(404, fail("Invite not found"));
      await db
        .update(connectionLinksTable)
        .set({ status: "accepted", respondedAt: new Date() })
        .where(eq(connectionLinksTable.id, link.id));
      return ok(null, `You can now see ${link.ownerName}'s records with you`);
    },
    { params: tId },
  )
  .post(
    "/shared/:id/decline",
    async ({ user, params, status }) => {
      const link = await incomingLink(user.id, params.id);
      if (link?.status !== "pending")
        return status(404, fail("Invite not found"));
      await db
        .update(connectionLinksTable)
        .set({ status: "declined", respondedAt: new Date() })
        .where(eq(connectionLinksTable.id, link.id));
      return ok(null, "Invite declined");
    },
    { params: tId },
  )
  .delete(
    "/shared/:id",
    async ({ user, params, status }) => {
      const link = await incomingLink(user.id, params.id);
      if (!link) return status(404, fail("Not found"));
      await db
        .update(connectionLinksTable)
        .set({ status: "removed", respondedAt: new Date() })
        .where(eq(connectionLinksTable.id, link.id));
      return ok(null, `Stopped seeing ${link.ownerName}'s records`);
    },
    { params: tId },
  )
  .get(
    "/shared/:id",
    async ({ user, params, status }) => {
      const link = await incomingLink(user.id, params.id);
      if (link?.status !== "accepted")
        return status(404, fail("Shared ledger not found"));
      const book = await loadBook(link.ownerUserId);
      const { byConn, loans } = summarizeBook(book, today());
      const s = byConn.get(link.connectionId);
      if (!s) return status(404, fail("Shared ledger not found"));
      const names = connectionNames(book);
      const { ownerUserId: _o, ...info } = link;
      return ok({
        link: info,
        summary: mirrorSummary(connectionSummaryDto(s)),
        ledger: mirrorLedger(ledgerFor(book, link.connectionId)).reverse(),
        loans: [...loans.values()]
          .filter((l) => l.loan.connectionId === link.connectionId)
          .map((l) =>
            mirrorLoan(loanDto(l.loan, l.summary, names), link.ownerName),
          ),
      });
    },
    { params: tId },
  )
  .get(
    "/shared/:id/loans/:loanId",
    async ({ user, params, status }) => {
      const link = await incomingLink(user.id, params.id);
      if (link?.status !== "accepted")
        return status(404, fail("Shared ledger not found"));
      const detail = loanDetail(
        await loadBook(link.ownerUserId),
        params.loanId,
        today(),
      );
      if (!detail || detail.connectionId !== link.connectionId)
        return status(404, fail("Loan not found"));
      const { ownerUserId: _o, ...info } = link;
      return ok({ link: info, loan: mirrorLoan(detail, link.ownerName) });
    },
    { params: t.Object({ id: t.Numeric(), loanId: t.Numeric() }) },
  );

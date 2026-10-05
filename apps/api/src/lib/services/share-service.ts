import { and, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "$/db";
import {
  connectionLinksTable,
  connectionsTable,
  usersTable,
} from "$/db/schema";
import { today } from "$/lib/utils/period";
import {
  connectionSummaryDto,
  type LedgerRowDto,
  loadBook,
  type loanDetail,
  type loanDto,
  summarizeBook,
} from "./book-service";

const owner = alias(usersTable, "owner");

export const LIVE_LINK = ["pending", "accepted"] as const;

/** Owner side: who each of my connections is linked to (pending or accepted). */
export async function liveLinksForOwner(ownerUserId: number) {
  const rows = await db
    .select({
      id: connectionLinksTable.id,
      connectionId: connectionLinksTable.connectionId,
      status: connectionLinksTable.status,
      username: usersTable.username,
      name: usersTable.name,
    })
    .from(connectionLinksTable)
    .innerJoin(usersTable, eq(usersTable.id, connectionLinksTable.targetUserId))
    .where(
      and(
        eq(connectionLinksTable.ownerUserId, ownerUserId),
        inArray(connectionLinksTable.status, [...LIVE_LINK]),
      ),
    );
  return new Map(
    rows.map(({ connectionId, ...link }) => [connectionId, link] as const),
  );
}
/*
 * Mirroring: the tagged user sees the owner's records from the other side.
 * Every signed amount flips (what the owner "gave" they "got"), and lent
 * loans become borrowed ones. Absolute amounts (principal, interest) stay.
 */

type SummaryDto = ReturnType<typeof connectionSummaryDto>;

export const mirrorSummary = (s: SummaryDto): SummaryDto => ({
  ...s,
  ledger: -s.ledger || 0,
  lentPrincipal: s.borrowedPrincipal,
  lentInterest: s.borrowedInterest,
  borrowedPrincipal: s.lentPrincipal,
  borrowedInterest: s.lentInterest,
  net: -s.net || 0,
});

export const mirrorLedger = (rows: LedgerRowDto[]) =>
  rows.map((r) => ({
    ...r,
    amount: -r.amount || 0,
    balance: -r.balance || 0,
  }));

const flip = (d: "lent" | "borrowed") => (d === "lent" ? "borrowed" : "lent");

/** The other party of a mirrored loan is the owner, not the tagged user. */
export function mirrorLoan<
  L extends
    | ReturnType<typeof loanDto>
    | NonNullable<ReturnType<typeof loanDetail>>,
>(l: L, ownerName: string): L {
  return {
    ...l,
    direction: flip(l.direction),
    connectionName: ownerName,
    title:
      l.direction === "lent"
        ? `Loan from ${ownerName}`
        : `Loan to ${ownerName}`,
  };
}

/** Tagged side: links addressed to `userId`, with owner + connection name. */
export async function incomingLinks(userId: number, statuses: string[]) {
  return db
    .select({
      id: connectionLinksTable.id,
      status: connectionLinksTable.status,
      connectionId: connectionLinksTable.connectionId,
      connectionName: connectionsTable.name,
      ownerUserId: connectionLinksTable.ownerUserId,
      ownerName: owner.name,
      ownerUsername: owner.username,
      createdAt: connectionLinksTable.createdAt,
      respondedAt: connectionLinksTable.respondedAt,
    })
    .from(connectionLinksTable)
    .innerJoin(owner, eq(owner.id, connectionLinksTable.ownerUserId))
    .innerJoin(
      connectionsTable,
      eq(connectionsTable.id, connectionLinksTable.connectionId),
    )
    .where(
      and(
        eq(connectionLinksTable.targetUserId, userId),
        inArray(
          connectionLinksTable.status,
          statuses as (typeof LIVE_LINK)[number][],
        ),
      ),
    )
    .orderBy(desc(connectionLinksTable.createdAt));
}

/** Pending invites + accepted shared ledgers (mirrored) for the tagged user. */
export async function sharedOverview(userId: number) {
  const links = await incomingLinks(userId, [...LIVE_LINK]);
  // One book load per owner, however many of their people link to me.
  const books = new Map(
    await Promise.all(
      [...new Set(links.map((l) => l.ownerUserId))].map(
        async (id) => [id, summarizeBook(await loadBook(id), today())] as const,
      ),
    ),
  );
  const items = links.map(({ ownerUserId, ...l }) => {
    const s = books.get(ownerUserId)?.byConn.get(l.connectionId);
    return {
      ...l,
      summary: s ? mirrorSummary(connectionSummaryDto(s)) : null,
    };
  });
  const accepted = items.filter((i) => i.status === "accepted");
  return {
    invites: items.filter((i) => i.status === "pending"),
    shared: accepted,
    totals: {
      /** You have to give these people (net, incl. interest). */
      owedByYou: accepted.reduce(
        (s, i) => s + Math.max(0, -(i.summary?.net ?? 0)),
        0,
      ),
      /** These people have to give you. */
      owedToYou: accepted.reduce(
        (s, i) => s + Math.max(0, i.summary?.net ?? 0),
        0,
      ),
    },
  };
}

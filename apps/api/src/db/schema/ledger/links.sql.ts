import { sql } from "drizzle-orm";
import { index, pgEnum, pgTable, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "../users/users.sql";
import { connectionsTable } from "./connections.sql";

/**
 * A connection tagged with another registered user. Once the target
 * accepts, they get a read-only, mirrored view of that connection's ledger.
 */
export const linkStatuses = [
  "pending",
  "accepted",
  "declined",
  "removed",
] as const;
export type LinkStatus = (typeof linkStatuses)[number];
export const linkStatusEnum = pgEnum("link_status", linkStatuses);

export const connectionLinksTable = pgTable(
  "connection_links",
  (pg) => ({
    id: pg.serial().primaryKey(),
    connectionId: pg
      .integer("connection_id")
      .notNull()
      .references(() => connectionsTable.id, { onDelete: "cascade" }),
    ownerUserId: pg
      .integer("owner_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    targetUserId: pg
      .integer("target_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    status: linkStatusEnum("status").notNull().default("pending"),
    createdAt: pg
      .timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    respondedAt: pg.timestamp("responded_at", { withTimezone: true }),
  }),
  (t) => [
    uniqueIndex("connection_links_live_connection_uq")
      .on(t.connectionId)
      .where(sql`status in ('pending', 'accepted')`),
    uniqueIndex("connection_links_live_pair_uq")
      .on(t.ownerUserId, t.targetUserId)
      .where(sql`status in ('pending', 'accepted')`),
    index("connection_links_target_idx").on(t.targetUserId),
  ],
);

export type SelectConnectionLink = typeof connectionLinksTable.$inferSelect;

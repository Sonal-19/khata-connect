import { index, pgTable } from "drizzle-orm/pg-core";
import { usersTable } from "../users/users.sql";
import { connectionsTable } from "./connections.sql";
import { entryTypeEnum, paymentModeEnum } from "./enums.sql";

/** Plain money movement with a connection (no interest). Amount in paise. */
export const entriesTable = pgTable(
  "entries",
  (pg) => ({
    id: pg.serial().primaryKey(),
    userId: pg
      .integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    connectionId: pg
      .integer("connection_id")
      .notNull()
      .references(() => connectionsTable.id, { onDelete: "cascade" }),
    type: entryTypeEnum("type").notNull(),
    amount: pg.bigint({ mode: "number" }).notNull(),
    date: pg.date({ mode: "string" }).notNull(),
    reason: pg.text().notNull(),
    mode: paymentModeEnum("mode").notNull().default("cash"),
    note: pg.text(),
    createdAt: pg
      .timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (t) => [
    index("entries_user_date_idx").on(t.userId, t.date),
    index("entries_connection_idx").on(t.connectionId),
  ],
);

export type SelectEntry = typeof entriesTable.$inferSelect;

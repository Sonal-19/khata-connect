import { index, pgTable } from "drizzle-orm/pg-core";
import { usersTable } from "../users/users.sql";
import { relationEnum } from "./enums.sql";

/** A person the user exchanges money with. They don't need an account. */
export const connectionsTable = pgTable(
  "connections",
  (pg) => ({
    id: pg.serial().primaryKey(),
    userId: pg
      .integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    name: pg.text().notNull(),
    phone: pg.text(),
    email: pg.text(),
    relation: relationEnum("relation").notNull().default("friend"),
    note: pg.text(),
    createdAt: pg
      .timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (t) => [index("connections_user_idx").on(t.userId)],
);

export type SelectConnection = typeof connectionsTable.$inferSelect;

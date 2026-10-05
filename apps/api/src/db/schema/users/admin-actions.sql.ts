import { index, pgEnum, pgTable } from "drizzle-orm/pg-core";
import { usersTable } from "./users.sql";

/**
 * Audit log of what admins did to accounts. Usernames are snapshotted so
 * the row still reads correctly after either account is deleted.
 */
export const adminActionKinds = [
  "user_created",
  "role_granted",
  "role_revoked",
  "user_deleted",
] as const;
export type AdminActionKind = (typeof adminActionKinds)[number];
export const adminActionKindEnum = pgEnum(
  "admin_action_kind",
  adminActionKinds,
);

export const adminActionsTable = pgTable(
  "admin_actions",
  (pg) => ({
    id: pg.serial().primaryKey(),
    kind: adminActionKindEnum("kind").notNull(),
    /** Null when done from the command line (`db:make-admin`). */
    actorUserId: pg
      .integer("actor_user_id")
      .references(() => usersTable.id, { onDelete: "set null" }),
    actorUsername: pg.text("actor_username"),
    targetUserId: pg
      .integer("target_user_id")
      .references(() => usersTable.id, { onDelete: "set null" }),
    targetUsername: pg.text("target_username").notNull(),
    targetName: pg.text("target_name").notNull(),
    createdAt: pg
      .timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (t) => [index("admin_actions_created_idx").on(t.createdAt)],
);

export type InsertAdminAction = typeof adminActionsTable.$inferInsert;

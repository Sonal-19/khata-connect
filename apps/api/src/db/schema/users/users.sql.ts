import { pgEnum, pgTable } from "drizzle-orm/pg-core";

export const roles = ["user", "admin"] as const;
export type Role = (typeof roles)[number];
export const roleEnum = pgEnum("role", roles);

export const usersTable = pgTable("users", (pg) => ({
  id: pg.serial().primaryKey(),
  name: pg.text().notNull(),
  email: pg.text().notNull().unique(),
  /** Lowercase, 3–16 chars of a-z 0-9 _ . — see `USERNAME_PATTERN`. */
  username: pg.text().notNull().unique(),
  role: roleEnum("role").notNull().default("user"),
  passwordHash: pg.text("password_hash").notNull(),
  createdAt: pg
    .timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: pg
    .timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
}));

export type InsertUser = typeof usersTable.$inferInsert;
export type SelectUser = typeof usersTable.$inferSelect;

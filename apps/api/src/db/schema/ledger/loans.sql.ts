import { index, pgTable } from "drizzle-orm/pg-core";
import { usersTable } from "../users/users.sql";
import { connectionsTable } from "./connections.sql";
import {
  interestBasisEnum,
  interestTypeEnum,
  loanDirectionEnum,
  loanEventKindEnum,
  loanStatusEnum,
  paymentModeEnum,
  ratePeriodEnum,
} from "./enums.sql";

/**
 * A loan with (optional) interest. The principal is not stored here: it is
 * the sum of `disbursement` events minus `principal` repayments.
 * `viaConnectionId` = the money moved through someone who holds the user's
 * funds (e.g. lent out of the cash kept with a relative); every event then
 * also moves that holder's balance.
 */
export const loansTable = pgTable(
  "loans",
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
    viaConnectionId: pg
      .integer("via_connection_id")
      .references(() => connectionsTable.id, { onDelete: "set null" }),
    direction: loanDirectionEnum("direction").notNull(),
    title: pg.text().notNull(),
    interestType: interestTypeEnum("interest_type").notNull().default("simple"),
    /** Percent per `ratePeriod`, e.g. 1 = 1% a month ("1 rupaya sainkda"). */
    ratePercent: pg.doublePrecision("rate_percent").notNull().default(0),
    ratePeriod: ratePeriodEnum("rate_period").notNull().default("month"),
    basis: interestBasisEnum("basis").notNull().default("months"),
    /** Day of month interest is expected (1–31), null = not tracked. */
    interestDay: pg.integer("interest_day"),
    dueDate: pg.date("due_date", { mode: "string" }),
    collateral: pg.text(),
    note: pg.text(),
    status: loanStatusEnum("status").notNull().default("active"),
    /** Interest stops accruing on this date. */
    closedOn: pg.date("closed_on", { mode: "string" }),
    createdAt: pg
      .timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (t) => [
    index("loans_user_idx").on(t.userId),
    index("loans_connection_idx").on(t.connectionId),
  ],
);

export const loanEventsTable = pgTable(
  "loan_events",
  (pg) => ({
    id: pg.serial().primaryKey(),
    loanId: pg
      .integer("loan_id")
      .notNull()
      .references(() => loansTable.id, { onDelete: "cascade" }),
    kind: loanEventKindEnum("kind").notNull(),
    amount: pg.bigint({ mode: "number" }).notNull(),
    date: pg.date({ mode: "string" }).notNull(),
    mode: paymentModeEnum("mode").notNull().default("cash"),
    note: pg.text(),
    createdAt: pg
      .timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  }),
  (t) => [index("loan_events_loan_idx").on(t.loanId, t.date)],
);

export type SelectLoan = typeof loansTable.$inferSelect;
export type SelectLoanEvent = typeof loanEventsTable.$inferSelect;

import { pgEnum } from "drizzle-orm/pg-core";
import {
  interestBases,
  interestTypes,
  loanDirections,
  loanEventKinds,
  ratePeriods,
} from "$/lib/utils/interest";

export {
  interestBases,
  interestTypes,
  loanDirections,
  loanEventKinds,
  ratePeriods,
};

/** How a connection is related to the user (for grouping and filters). */
export const relations = [
  "family",
  "friend",
  "business",
  "colleague",
  "other",
] as const;
export type Relation = (typeof relations)[number];
export const relationEnum = pgEnum("relation", relations);

/** gave = money went from the user to the connection (they hold / owe it),
 * got = money came back to the user, or the connection paid on their behalf. */
export const entryTypes = ["gave", "got"] as const;
export type EntryType = (typeof entryTypes)[number];
export const entryTypeEnum = pgEnum("entry_type", entryTypes);

export const paymentModes = ["cash", "upi", "bank", "cheque", "other"] as const;
export type PaymentMode = (typeof paymentModes)[number];
export const paymentModeEnum = pgEnum("payment_mode", paymentModes);

export const loanDirectionEnum = pgEnum("loan_direction", loanDirections);
export const interestTypeEnum = pgEnum("interest_type", interestTypes);
export const ratePeriodEnum = pgEnum("rate_period", ratePeriods);
export const interestBasisEnum = pgEnum("interest_basis", interestBases);
export const loanEventKindEnum = pgEnum("loan_event_kind", loanEventKinds);

export const loanStatuses = ["active", "closed"] as const;
export type LoanStatus = (typeof loanStatuses)[number];
export const loanStatusEnum = pgEnum("loan_status", loanStatuses);

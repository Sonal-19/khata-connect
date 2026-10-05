import { format, parseISO } from "date-fns";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const inrPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const inrCompact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** ₹1,23,456 or ₹1,23,456.50 */
export const money = (n: number) =>
  (Number.isInteger(Math.round(n * 100) / 100) ? inr : inrPaise).format(n);
/** ₹1.2L / ₹12K */
export const moneyShort = (n: number) => inrCompact.format(n);
/** +₹500 / −₹500 */
export const signedMoney = (n: number) =>
  `${n > 0 ? "+" : n < 0 ? "−" : ""}${money(Math.abs(n))}`;

/** Date-only value → "yyyy-MM-dd". */
export function ymd(d: string | Date) {
  return d instanceof Date ? d.toISOString().slice(0, 10) : d.slice(0, 10);
}

/** Local "today" as yyyy-MM-dd. */
export const todayStr = () => format(new Date(), "yyyy-MM-dd");

export const parseDay = (d: string | Date) => parseISO(ymd(d));

export function dayLabel(d: string | Date) {
  const s = ymd(d);
  const today = todayStr();
  const yest = format(new Date(Date.now() - 86_400_000), "yyyy-MM-dd");
  if (s === today) return "Today";
  if (s === yest) return "Yesterday";
  return format(parseDay(s), "EEE, d MMM yyyy");
}

export const shortDate = (d: string | Date) =>
  format(parseDay(d), "d MMM yyyy");
export const monthLabel = (d: string | Date) => format(parseDay(d), "MMM yy");

export const RELATIONS = [
  { value: "family", label: "Family", emoji: "🏠" },
  { value: "friend", label: "Friend", emoji: "🤝" },
  { value: "business", label: "Business", emoji: "🏪" },
  { value: "colleague", label: "Colleague", emoji: "💼" },
  { value: "other", label: "Other", emoji: "👤" },
] as const;
export type Relation = (typeof RELATIONS)[number]["value"];
export const relationLabel = (v: string) =>
  RELATIONS.find((r) => r.value === v)?.label ?? v;

export const MODES = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank", label: "Bank" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
] as const;
export type PaymentMode = (typeof MODES)[number]["value"];
export const modeLabel = (v: string) =>
  MODES.find((m) => m.value === v)?.label ?? v;

export const EVENT_KINDS = {
  disbursement: { label: "Top-up / payout", short: "Paid out" },
  principal: { label: "Principal repaid", short: "Principal" },
  interest: { label: "Interest paid", short: "Interest" },
  waiver: { label: "Interest waived", short: "Waived" },
} as const;
export type LoanEventKind = keyof typeof EVENT_KINDS;

/** "1% / month (12% a year)" */
export function rateLabel(l: {
  interestType: string;
  ratePercent: number;
  ratePeriod: string;
}) {
  if (l.interestType === "none" || !l.ratePercent) return "No interest";
  const r = +l.ratePercent.toFixed(4);
  return l.ratePeriod === "month"
    ? `${r}% / month · ${+(r * 12).toFixed(2)}% p.a.`
    : `${r}% p.a. · ${+(r / 12).toFixed(3)}% / month`;
}

/** Whole-word balance sentence for a connection. */
export function balanceSentence(name: string, net: number) {
  const first = name.split(" ")[0];
  if (net > 0) return `${first} will give you`;
  if (net < 0) return `You will give ${first}`;
  return "All settled";
}

/** Shared (mirrored) ledgers, from the viewer's side. */
export function owedLabel(net: number) {
  return net < 0 ? "Owed by you" : net > 0 ? "Owed to you" : "All settled";
}

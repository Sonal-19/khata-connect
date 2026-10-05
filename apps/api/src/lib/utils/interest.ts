/**
 * Loan & interest maths. Pure (no env / db imports) so the web app imports
 * this same file for the calculator and previews — server and client can
 * never disagree on a number.
 *
 * Amounts are unit-agnostic: the server passes paise, the web passes rupees.
 * Dates are date-only "yyyy-MM-dd" strings.
 */

export const loanDirections = ["lent", "borrowed"] as const;
export type LoanDirection = (typeof loanDirections)[number];

export const interestTypes = ["simple", "none"] as const;
export type InterestType = (typeof interestTypes)[number];

/** Rate is quoted per month (Indian "1 rupaya sainkda" = 1%/month) or per year. */
export const ratePeriods = ["month", "year"] as const;
export type RatePeriod = (typeof ratePeriods)[number];

/** months = only completed months count (like Excel DATEDIF "M" / a khata);
 * days = pro-rata for every day. */
export const interestBases = ["months", "days"] as const;
export type InterestBasis = (typeof interestBases)[number];

/** disbursement = principal handed over (first payout or a top-up),
 * principal = principal repaid, interest = interest paid,
 * waiver = interest forgiven / settled for less. */
export const loanEventKinds = [
  "disbursement",
  "principal",
  "interest",
  "waiver",
] as const;
export type LoanEventKind = (typeof loanEventKinds)[number];

export type LoanTerms = {
  interestType: InterestType;
  ratePercent: number;
  ratePeriod: RatePeriod;
  basis: InterestBasis;
  closedOn?: string | null;
};

export type LoanEventInput = {
  date: string;
  kind: LoanEventKind;
  amount: number;
};

/* ---------- date helpers (UTC, no DST drift) ---------- */

const parse = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);

function ymdParts(s: string) {
  const [y = 0, m = 1, d = 1] = s.slice(0, 10).split("-").map(Number);
  return { y, m, d };
}

/** Completed months between two dates — Excel's DATEDIF(from, to, "M"). */
export function fullMonthsBetween(from: string, to: string) {
  if (to <= from) return 0;
  const a = ymdParts(from);
  const b = ymdParts(to);
  let months = (b.y - a.y) * 12 + (b.m - a.m);
  if (b.d < a.d) months -= 1;
  return Math.max(0, months);
}

export function daysBetween(from: string, to: string) {
  if (to <= from) return 0;
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000);
}

/** Adds months, clamping the day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(s: string, n: number, anchorDay?: number) {
  const { y, m, d } = ymdParts(s);
  const day = anchorDay ?? d;
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return fmt(new Date(Date.UTC(y, m - 1 + n, Math.min(day, last))));
}

export function addDays(s: string, n: number) {
  const d = parse(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}

/** Last day of the month containing `s`. */
export function monthEnd(s: string) {
  const { y, m } = ymdParts(s);
  return fmt(new Date(Date.UTC(y, m, 0)));
}

/* ---------- rates ---------- */

/** Rate as a fraction per month (0.01 for 1%/month or 12%/year). */
export function monthlyRate(
  t: Pick<LoanTerms, "interestType" | "ratePercent" | "ratePeriod">,
) {
  if (t.interestType === "none" || !t.ratePercent) return 0;
  return t.ratePeriod === "month" ? t.ratePercent / 100 : t.ratePercent / 1200;
}

/** Elapsed time in months for the basis (days are converted at 12/365). */
export function elapsedMonths(from: string, to: string, basis: InterestBasis) {
  return basis === "months"
    ? fullMonthsBetween(from, to)
    : (daysBetween(from, to) * 12) / 365;
}

/** Simple interest on `amount` from `from` to `to`. */
export function simpleInterest(
  amount: number,
  from: string,
  to: string,
  t: LoanTerms,
) {
  return amount * monthlyRate(t) * elapsedMonths(from, to, t.basis);
}

/** Interest stops at the close date. */
export function accrualEnd(t: LoanTerms, asOf: string) {
  return t.closedOn && t.closedOn < asOf ? t.closedOn : asOf;
}

/* ---------- loan summary ---------- */

const KIND_ORDER: Record<LoanEventKind, number> = {
  disbursement: 0,
  principal: 1,
  interest: 2,
  waiver: 3,
};

export function sortEvents<E extends LoanEventInput>(events: E[]) {
  return [...events].sort(
    (a, b) =>
      a.date.localeCompare(b.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind],
  );
}

export type LoanSummary = ReturnType<typeof summarizeLoan>;

/**
 * Every principal movement earns (or stops earning) interest from its own
 * date: interest = Σ ±amount × monthly rate × elapsed months. A repayment
 * therefore stops interest only on the part that was repaid — exactly how
 * the "Interest accumulation" column of a typical khata spreadsheet works.
 */
export function summarizeLoan<E extends LoanEventInput>(
  t: LoanTerms,
  events: E[],
  asOf: string,
) {
  const end = accrualEnd(t, asOf);
  let disbursed = 0;
  let principalRepaid = 0;
  let accrued = 0;
  let interestPaid = 0;
  let waived = 0;
  let startDate: string | null = null;
  let lastPaymentDate: string | null = null;

  const rows = sortEvents(events).map((e) => {
    const counted = e.date <= asOf;
    let elapsed = 0;
    let interest = 0;
    if (counted) {
      if (e.kind === "disbursement" || e.kind === "principal") {
        const sign = e.kind === "disbursement" ? 1 : -1;
        elapsed = elapsedMonths(e.date, end, t.basis);
        interest = sign * simpleInterest(e.amount, e.date, end, t);
        accrued += interest;
      }
      if (e.kind === "disbursement") {
        disbursed += e.amount;
        startDate ??= e.date;
      } else if (e.kind === "principal") principalRepaid += e.amount;
      else if (e.kind === "interest") interestPaid += e.amount;
      else waived += e.amount;
      if (e.kind === "principal" || e.kind === "interest")
        lastPaymentDate = e.date;
    }
    return { ...e, counted, elapsed, interest };
  });

  const principalOut = disbursed - principalRepaid;
  const interestDue = accrued - interestPaid - waived;
  const monthlyInterest = principalOut * monthlyRate(t);
  return {
    startDate: startDate as string | null,
    lastPaymentDate: lastPaymentDate as string | null,
    disbursed,
    principalRepaid,
    principalOut,
    accrued,
    interestPaid,
    waived,
    interestDue,
    totalDue: principalOut + interestDue,
    monthlyInterest,
    /** Whole months of interest outstanding at the current principal. */
    monthsPending: monthlyInterest > 0 ? interestDue / monthlyInterest : 0,
    rows,
  };
}

/** Next date (on or after `from`) that falls on `day` of a month. */
export function nextOnDay(day: number, from: string) {
  const thisMonth = addMonths(`${from.slice(0, 7)}-01`, 0, day);
  return thisMonth >= from
    ? thisMonth
    : addMonths(`${from.slice(0, 7)}-01`, 1, day);
}

/* ---------- financial year (India: April → March) ---------- */

export function financialYear(date: string) {
  const { y, m } = ymdParts(date);
  const start = m >= 4 ? y : y - 1;
  return {
    label: `FY ${start}-${String((start + 1) % 100).padStart(2, "0")}`,
    from: `${start}-04-01`,
    to: `${start + 1}-03-31`,
  };
}

/** Interest earned/charged and actually paid in each financial year. */
export function interestByFinancialYear<E extends LoanEventInput>(
  t: LoanTerms,
  events: E[],
  today: string,
) {
  const sorted = sortEvents(events).filter((e) => e.date <= today);
  const first = sorted[0];
  if (!first) return [];
  const out: {
    label: string;
    from: string;
    to: string;
    accrued: number;
    paid: number;
  }[] = [];
  let fy = financialYear(first.date);
  while (fy.from <= today) {
    const upto = fy.to < today ? fy.to : today;
    const before = summarizeLoan(t, sorted, addDays(fy.from, -1)).accrued;
    const after = summarizeLoan(t, sorted, upto).accrued;
    const paid = sorted
      .filter(
        (e) => e.kind === "interest" && e.date >= fy.from && e.date <= fy.to,
      )
      .reduce((s, e) => s + e.amount, 0);
    out.push({ ...fy, accrued: after - before, paid });
    fy = financialYear(addDays(fy.to, 1));
  }
  return out;
}

/* ---------- calculator ---------- */

/** Month-by-month simple-interest schedule for a single amount. */
export function interestSchedule(input: {
  principal: number;
  ratePercent: number;
  ratePeriod: RatePeriod;
  basis: InterestBasis;
  from: string;
  to: string;
}) {
  const t: LoanTerms = { interestType: "simple", ...input };
  const total = simpleInterest(input.principal, input.from, input.to, t);
  const monthly = input.principal * monthlyRate(t);
  const rows: { date: string; interest: number; cumulative: number }[] = [];
  const months = fullMonthsBetween(input.from, input.to);
  const day = ymdParts(input.from).d;
  for (let i = 1; i <= Math.min(months, 600); i++) {
    const date = addMonths(input.from, i, day);
    rows.push({
      date,
      interest: monthly,
      cumulative: simpleInterest(input.principal, input.from, date, t),
    });
  }
  return {
    months,
    days: daysBetween(input.from, input.to),
    monthly,
    yearlyPercent:
      input.ratePeriod === "month" ? input.ratePercent * 12 : input.ratePercent,
    interest: total,
    total: input.principal + total,
    rows,
  };
}

import {
  type InterestBasis,
  type RatePeriod,
  summarizeLoan,
} from "@api/lib/utils/interest";
import { type Cell, serialToDate } from "./xlsx";

/**
 * Turns spreadsheet rows into an import payload. Built around the common
 * khata layout: one sheet per person holding your money, signed amounts
 * (+ given to them, − paid out by them), and an "Interest" flag + "Rate"
 * on rows where part of that money was lent out at interest.
 */

export type ColumnMap = {
  date: number;
  amount: number;
  reason: number;
  note: number;
  interest: number;
  rate: number;
};

export const COLUMN_FIELDS: {
  key: keyof ColumnMap;
  label: string;
  required?: boolean;
  match: RegExp;
}[] = [
  {
    key: "date",
    label: "Date",
    required: true,
    match: /date|dated|day|tarikh/i,
  },
  {
    key: "amount",
    label: "Amount",
    required: true,
    match: /^(amount|amt|value|rs|₹|rupees|sum)/i,
  },
  {
    key: "reason",
    label: "Reason / details",
    match: /reason|particular|detail|description|purpose|narration|name/i,
  },
  { key: "note", label: "Notes", match: /note|remark|comment|additional/i },
  {
    key: "interest",
    label: "Interest? (yes/no)",
    match: /^interest\??$|byaj|byaaj/i,
  },
  { key: "rate", label: "Rate", match: /^rate|%/i },
];

export function guessColumns(header: Cell[]): ColumnMap {
  const used = new Set<number>();
  const map = {} as ColumnMap;
  for (const f of COLUMN_FIELDS) {
    const idx = header.findIndex(
      (h, i) => !used.has(i) && typeof h === "string" && f.match.test(h.trim()),
    );
    map[f.key] = idx;
    if (idx >= 0) used.add(idx);
  }
  return map;
}

/** Index of the first row that looks like a header (has a "date" cell). */
export function findHeaderRow(rows: Cell[][]) {
  const i = rows.findIndex((r) =>
    r.some((c) => typeof c === "string" && /date/i.test(c)),
  );
  return i === -1 ? 0 : i;
}

export function toNumber(v: Cell): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.replace(/[₹,\s]|rs\.?|inr/gi, "");
  const neg = /^\(.*\)$/.test(s);
  const n = Number(s.replace(/[()]/g, ""));
  return Number.isFinite(n) && s !== "" ? (neg ? -n : n) : null;
}

export function toDate(v: Cell): string | null {
  if (typeof v === "number")
    return v > 20000 && v < 80000 ? serialToDate(v) : null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  // Indian order: dd/mm/yyyy or dd-mm-yy
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s);
  if (m) {
    const y = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
    return `${y}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  }
  return null;
}

export function toBool(v: Cell) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  return typeof v === "string" && /^(true|yes|y|1|haan|ha)$/i.test(v.trim());
}

const text = (v: Cell) =>
  v === null || v === undefined ? "" : String(v).trim();

export type ParsedRow = {
  line: number;
  date: string;
  /** Signed: + = money went to the holder. */
  amount: number;
  reason: string;
  note: string | null;
  interest: boolean;
  rate: number | null;
};

export function parseRows(rows: Cell[][], headerRow: number, map: ColumnMap) {
  const ok: ParsedRow[] = [];
  const skipped: { line: number; reason: string }[] = [];
  const at = (r: Cell[], i: number) => (i >= 0 ? (r[i] ?? null) : null);
  for (const [i, r] of rows.slice(headerRow + 1).entries()) {
    const line = headerRow + i + 2;
    const rawDate = at(r, map.date);
    const rawAmount = at(r, map.amount);
    if (rawDate === null && rawAmount === null) continue; // blank / totals area
    const date = toDate(rawDate);
    const amount = toNumber(rawAmount);
    if (!date) {
      skipped.push({ line, reason: "No valid date" });
      continue;
    }
    if (amount === null || amount === 0) {
      skipped.push({ line, reason: "No amount" });
      continue;
    }
    ok.push({
      line,
      date,
      amount: Math.round(amount * 100) / 100,
      reason: text(at(r, map.reason)).slice(0, 120),
      note: text(at(r, map.note)).slice(0, 500) || null,
      interest: toBool(at(r, map.interest)),
      rate: toNumber(at(r, map.rate)),
    });
  }
  return { rows: ok, skipped };
}

type Ref = { id?: number; name?: string };

export type ImportOptions = {
  holder: Ref;
  /** Person the interest rows were lent to. */
  borrower: Ref | null;
  /** true when + in the sheet means "I gave". */
  positiveIsGave: boolean;
  ratePeriod: RatePeriod;
  basis: InterestBasis;
  /** Used when no rate column / value is present. */
  defaultRate: number;
  loanTitle: string;
  today: string;
};

export function buildImport(rows: ParsedRow[], o: ImportOptions) {
  const signed = (n: number) => (o.positiveIsGave ? n : -n);
  // Without a borrower, interest rows stay plain entries so the holder's
  // balance still matches the sheet.
  const plain = o.borrower ? rows.filter((r) => !r.interest) : rows;
  const interestRows = o.borrower ? rows.filter((r) => r.interest) : [];

  const entries = plain.map((r) => ({
    type: signed(r.amount) > 0 ? ("gave" as const) : ("got" as const),
    amount: Math.abs(r.amount),
    date: r.date,
    reason: r.reason || "Imported",
    note: r.note,
  }));

  const rawRate = interestRows.find((r) => r.rate !== null)?.rate ?? null;
  // A sheet "Rate" of 0.01 is a fraction (1%); 1 or 12 is already a percent.
  const ratePercent =
    rawRate === null ? o.defaultRate : rawRate <= 1 ? rawRate * 100 : rawRate;

  const loanEvents = interestRows.map((r) => ({
    // Money leaving the holder at interest = loan paid out; coming back = repaid.
    kind:
      signed(r.amount) < 0 ? ("disbursement" as const) : ("principal" as const),
    amount: Math.abs(r.amount),
    date: r.date,
    note: [r.reason, r.note].filter(Boolean).join(" — ").slice(0, 500) || null,
  }));

  const loans =
    loanEvents.length && o.borrower
      ? [
          {
            party: o.borrower,
            viaHolder: true,
            direction: "lent" as const,
            title: o.loanTitle,
            interestType: "simple" as const,
            ratePercent: Math.round(ratePercent * 10000) / 10000,
            ratePeriod: o.ratePeriod,
            basis: o.basis,
            events: loanEvents,
          },
        ]
      : [];

  // Preview numbers, computed with the same maths the server will use.
  const holderBalance =
    entries.reduce(
      (s, e) => s + (e.type === "gave" ? e.amount : -e.amount),
      0,
    ) +
    (loans.length
      ? loanEvents.reduce(
          (s, e) => s + (e.kind === "disbursement" ? -e.amount : e.amount),
          0,
        )
      : 0);
  const loan = loans[0]
    ? summarizeLoan(loans[0], loans[0].events, o.today)
    : null;

  return {
    payload: { holder: o.holder, entries, loans },
    preview: {
      entries: entries.length,
      loanEvents: loans.length ? loanEvents.length : 0,
      interestRowsWithoutBorrower: o.borrower
        ? 0
        : rows.filter((r) => r.interest).length,
      holderBalance,
      principalOut: loan?.principalOut ?? 0,
      interestDue: loan?.interestDue ?? 0,
      ratePercent,
      net: holderBalance + (loan?.principalOut ?? 0) + (loan?.interestDue ?? 0),
    },
  };
}

import { CalendarClock, ShieldCheck, Wallet } from "lucide-react";
import type * as React from "react";
import { SectionCard } from "@/components/app/section-card";
import { PersonAvatar } from "@/components/common/person-avatar";
import { eventLabels } from "@/components/ledger/loan-event-sheet";
import type { LoanDetail, LoanEventRow } from "@/hooks/use-ledger";
import {
  dayLabel,
  modeLabel,
  money,
  rateLabel,
  shortDate,
  todayStr,
} from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Loan summary, payments with their interest effect, upcoming dates and
 * interest per financial year. Used by the owner's loan page (with actions)
 * and read-only by people the ledger is shared with.
 */
export function LoanView({
  l,
  party,
  actions,
  onEventClick,
}: {
  l: LoanDetail;
  /** Rendered as the borrower/lender name (e.g. a link). */
  party?: React.ReactNode;
  actions?: React.ReactNode;
  onEventClick?: (e: LoanEventRow) => void;
}) {
  const sum = l.summary;
  const lent = l.direction === "lent";
  const closed = l.status === "closed";
  const labels = eventLabels(l.direction);
  return (
    <>
      <section className="rounded-3xl border bg-card p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <PersonAvatar name={l.connectionName} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
                {l.title}
              </h1>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase",
                  closed
                    ? "bg-muted text-muted-foreground"
                    : lent
                      ? "bg-got/12 text-got"
                      : "bg-gave/12 text-gave",
                )}
              >
                {closed
                  ? `Closed ${l.closedOn ? shortDate(l.closedOn) : ""}`
                  : lent
                    ? "Lent"
                    : "Borrowed"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {lent ? "Borrower" : "Lender"}:{" "}
              {party ?? (
                <span className="font-medium text-foreground">
                  {l.connectionName}
                </span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">{rateLabel(l)}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: "Principal outstanding", v: sum.principalOut },
            {
              k: "Interest till today",
              v: sum.accrued,
              sub: `${sum.interestPaid ? `${money(sum.interestPaid)} ${lent ? "received" : "paid"}` : "nothing paid yet"}`,
            },
            {
              k: "Interest due",
              v: sum.interestDue,
              tone: "text-gold",
              sub: sum.monthsPending
                ? `≈ ${sum.monthsPending} months`
                : undefined,
            },
            {
              k: lent ? "Total to receive" : "Total to pay",
              v: sum.totalDue,
              tone: lent ? "text-got" : "text-gave",
            },
          ].map((x) => (
            <div key={x.k} className="rounded-2xl bg-muted/60 p-3">
              <p className="text-xs text-muted-foreground">{x.k}</p>
              <p
                className={cn(
                  "tabular mt-0.5 text-lg font-bold sm:text-xl",
                  x.tone,
                )}
              >
                {money(x.v)}
              </p>
              {x.sub && (
                <p className="text-[11px] text-muted-foreground">{x.sub}</p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {sum.startDate && <span>Since {shortDate(sum.startDate)}</span>}
          <span>
            {money(sum.disbursed)} given · {money(sum.principalRepaid)} repaid
          </span>
          {sum.monthlyInterest > 0 && (
            <span>{money(sum.monthlyInterest)} / month now</span>
          )}
          <span>
            {l.basis === "months" ? "Completed months only" : "Counted daily"}
          </span>
          {l.viaName && (
            <span className="inline-flex items-center gap-1">
              <Wallet className="size-3.5" /> Money held by {l.viaName}
            </span>
          )}
          {l.dueDate && (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                !closed &&
                  l.dueDate < todayStr() &&
                  sum.totalDue > 0 &&
                  "font-semibold text-destructive",
              )}
            >
              <CalendarClock className="size-3.5" /> Due {shortDate(l.dueDate)}
            </span>
          )}
          {l.collateral && (
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="size-3.5" /> {l.collateral}
            </span>
          )}
        </div>
        {l.note && (
          <p className="mt-3 rounded-xl bg-muted/70 px-3 py-2 text-sm text-muted-foreground">
            {l.note}
          </p>
        )}

        {actions && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:flex">{actions}</div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr] lg:gap-5">
        <SectionCard title="Payments & interest">
          <p className="-mt-2 mb-3 text-xs text-muted-foreground">
            Each amount given earns interest from its own date; each repayment
            stops interest on the part repaid.
          </p>
          <ul className="-mx-4 divide-y sm:-mx-5">
            {l.events.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  disabled={!onEventClick}
                  onClick={() => onEventClick?.(e)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left enabled:hover:bg-muted/50 sm:px-5",
                    !e.counted && "opacity-60",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {labels[e.kind]}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {dayLabel(e.date)}
                      {e.kind !== "waiver" ? ` · ${modeLabel(e.mode)}` : ""}
                      {e.note ? ` · ${e.note}` : ""}
                      {!e.counted ? " · future date" : ""}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="tabular block text-sm font-semibold">
                      {money(e.amount)}
                    </span>
                    {(e.kind === "disbursement" || e.kind === "principal") &&
                      e.interest !== 0 && (
                        <span
                          className={cn(
                            "tabular block text-[11px]",
                            e.interest > 0
                              ? "text-gold"
                              : "text-muted-foreground",
                          )}
                        >
                          {e.interest > 0 ? "+" : "−"}
                          {money(Math.abs(e.interest))} interest ·{" "}
                          {l.basis === "months"
                            ? `${e.elapsed} mo`
                            : `${Math.round(e.elapsed * 30.42)} d`}
                        </span>
                      )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>

        <div className="space-y-4">
          {l.upcoming.length > 0 && (
            <SectionCard title="Next interest dates">
              <ul className="space-y-2 text-sm">
                {l.upcoming.map((u) => (
                  <li key={u.date} className="flex justify-between">
                    <span className="text-muted-foreground">
                      {shortDate(u.date)}
                    </span>
                    <span className="tabular font-medium">
                      {money(u.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
          {l.byYear.length > 0 && l.interestType !== "none" && (
            <SectionCard title="Interest by financial year">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-2 text-left font-medium">Year</th>
                    <th className="pb-2 text-right font-medium">Earned</th>
                    <th className="pb-2 text-right font-medium">
                      {lent ? "Received" : "Paid"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {l.byYear.map((y) => (
                    <tr key={y.label}>
                      <td className="py-2">{y.label}</td>
                      <td className="tabular py-2 text-right">
                        {money(y.accrued)}
                      </td>
                      <td className="tabular py-2 text-right">
                        {money(y.paid)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-[11px] text-muted-foreground">
                {lent
                  ? "Interest you earn is generally taxable as “income from other sources”. Check with your CA."
                  : "Keep this for your records or tax filing."}
              </p>
            </SectionCard>
          )}
        </div>
      </div>
    </>
  );
}

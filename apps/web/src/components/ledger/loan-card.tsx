import { Link } from "@tanstack/react-router";
import { CalendarClock, Wallet } from "lucide-react";
import { PersonAvatar } from "@/components/common/person-avatar";
import { Progress } from "@/components/common/progress";
import type { LoanItem } from "@/hooks/use-ledger";
import { money, rateLabel, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function LoanCard({
  loan,
  sharedLinkId,
}: {
  loan: LoanItem;
  /** Open the read-only shared view instead of the owner's loan page. */
  sharedLinkId?: number;
}) {
  const s = loan.summary;
  const lent = loan.direction === "lent";
  const closed = loan.status === "closed";
  return (
    <Link
      {...(sharedLinkId
        ? {
            to: "/shared/$linkId/loans/$loanId" as const,
            params: { linkId: String(sharedLinkId), loanId: String(loan.id) },
          }
        : {
            to: "/loans/$loanId" as const,
            params: { loanId: String(loan.id) },
          })}
      className={cn(
        "block rounded-2xl border bg-card p-4 transition-shadow hover:shadow-md",
        closed && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <PersonAvatar name={loan.connectionName} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold">{loan.title}</p>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                closed
                  ? "bg-muted text-muted-foreground"
                  : lent
                    ? "bg-got/12 text-got"
                    : "bg-gave/12 text-gave",
              )}
            >
              {closed ? "Closed" : lent ? "Lent" : "Borrowed"}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {rateLabel(loan)}
            {s.startDate ? ` · since ${shortDate(s.startDate)}` : ""}
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-[11px] text-muted-foreground">Principal</p>
          <p className="tabular font-semibold">{money(s.principalOut)}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">Interest due</p>
          <p className="tabular font-semibold text-gold">
            {money(s.interestDue)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-muted-foreground">
            {lent ? "To receive" : "To pay"}
          </p>
          <p
            className={cn("tabular font-bold", lent ? "text-got" : "text-gave")}
          >
            {money(s.totalDue)}
          </p>
        </div>
      </div>
      {s.disbursed > 0 && (
        <Progress
          value={s.principalRepaid}
          max={s.disbursed}
          className="mt-3 h-1.5"
          color="var(--chart-loans)"
        />
      )}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {loan.viaName && (
          <span className="inline-flex items-center gap-1">
            <Wallet className="size-3" /> via {loan.viaName}
          </span>
        )}
        {s.monthlyInterest > 0 && !closed && (
          <span>{money(s.monthlyInterest)} / month</span>
        )}
        {loan.dueDate && !closed && (
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-3" /> due {shortDate(loan.dueDate)}
          </span>
        )}
      </div>
    </Link>
  );
}

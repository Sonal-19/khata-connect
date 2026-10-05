import { useNavigate } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgePercent,
  HandCoins,
} from "lucide-react";
import type { ActivityRow } from "@/hooks/use-ledger";
import {
  dayLabel,
  EVENT_KINDS,
  type LoanEventKind,
  modeLabel,
  money,
  type PaymentMode,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSheets } from "@/stores/sheets-store";

/** Did cash come to the user (in), leave them (out), or neither? */
export function flowOf(r: Pick<ActivityRow, "source" | "kind" | "direction">) {
  if (r.source === "entry") return r.kind === "gave" ? "out" : "in";
  if (r.kind === "waiver") return "none";
  const payout = r.kind === "disbursement";
  return r.direction === "lent"
    ? payout
      ? "out"
      : "in"
    : payout
      ? "in"
      : "out";
}

export function rowTitle(r: ActivityRow) {
  if (r.source === "entry") return r.title;
  const k = EVENT_KINDS[r.kind as LoanEventKind];
  if (r.kind === "disbursement")
    return r.direction === "lent"
      ? `Lent to ${r.connectionName}`
      : `Borrowed from ${r.connectionName}`;
  return `${k.label} · ${r.title}`;
}

export function ActivityItem({
  row,
  showPerson = true,
}: {
  row: ActivityRow;
  showPerson?: boolean;
}) {
  const navigate = useNavigate();
  const openEntry = useSheets((s) => s.openEntry);
  const flow = flowOf(row);
  const Icon =
    row.source === "loan"
      ? row.kind === "interest" || row.kind === "waiver"
        ? BadgePercent
        : HandCoins
      : flow === "out"
        ? ArrowUpRight
        : ArrowDownLeft;

  const open = () => {
    if (row.source === "loan" && row.loanId)
      navigate({
        to: "/loans/$loanId",
        params: { loanId: String(row.loanId) },
      });
    else
      openEntry({
        mode: "edit",
        id: row.id,
        value: {
          connectionId: row.connectionId,
          type: row.kind as "gave" | "got",
          amount: row.amount,
          date: row.date,
          reason: row.title,
          mode: row.mode as PaymentMode,
          note: row.note,
        },
      });
  };

  return (
    <button
      type="button"
      onClick={open}
      className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/60 active:bg-muted sm:px-4"
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full",
          flow === "out" && "bg-gave/12 text-gave",
          flow === "in" && "bg-got/12 text-got",
          flow === "none" && "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {rowTitle(row)}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {[
            showPerson && row.source === "entry" ? row.connectionName : null,
            row.viaName ? `via ${row.viaName}` : null,
            dayLabel(row.date),
            row.kind !== "waiver" ? modeLabel(row.mode) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {row.note && (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground/80 italic">
            {row.note}
          </span>
        )}
      </span>
      <span className="text-right">
        <span
          className={cn(
            "tabular block text-sm font-semibold",
            flow === "out" && "text-gave",
            flow === "in" && "text-got",
          )}
        >
          {money(row.amount)}
        </span>
        <span className="block text-[11px] text-muted-foreground">
          {flow === "out" ? "You gave" : flow === "in" ? "You got" : "Waived"}
        </span>
      </span>
    </button>
  );
}

export function ActivityList({
  rows,
  showPerson,
}: {
  rows: ActivityRow[];
  showPerson?: boolean;
}) {
  return (
    <div className="divide-y">
      {rows.map((r) => (
        <ActivityItem key={r.key} row={r} showPerson={showPerson} />
      ))}
    </div>
  );
}

import { ArrowDownLeft, ArrowUpRight, HandCoins } from "lucide-react";
import type { LedgerRow } from "@/hooks/use-ledger";
import { dayLabel, modeLabel, money, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Statement with a running balance: a list on phones and tablets, a table
 * from laptops up (and when printed). + amounts are "You gave", − are
 * "You got", from the viewer's side — shared (mirrored) ledgers arrive
 * already flipped.
 */
export function Statement({
  rows,
  onRowClick,
}: {
  rows: LedgerRow[];
  onRowClick?: (r: LedgerRow) => void;
}) {
  return (
    <div className="print-plain overflow-hidden rounded-2xl border bg-card">
      {/* Phones: list */}
      <ul className="divide-y lg:hidden print:hidden">
        {rows.map((r) => (
          <li key={r.key}>
            <button
              type="button"
              disabled={!onRowClick}
              onClick={() => onRowClick?.(r)}
              className="flex w-full items-center gap-3 px-3 py-3 text-left enabled:active:bg-muted"
            >
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full",
                  r.amount > 0 ? "bg-gave/12 text-gave" : "bg-got/12 text-got",
                )}
              >
                {r.source === "loan" ? (
                  <HandCoins className="size-4" />
                ) : r.amount > 0 ? (
                  <ArrowUpRight className="size-4" />
                ) : (
                  <ArrowDownLeft className="size-4" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {r.reason}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {dayLabel(r.date)} · {modeLabel(r.mode)}
                  {r.note ? ` · ${r.note}` : ""}
                </span>
              </span>
              <span className="text-right">
                <span
                  className={cn(
                    "tabular block text-sm font-semibold",
                    r.amount > 0 ? "text-gave" : "text-got",
                  )}
                >
                  {money(Math.abs(r.amount))}
                </span>
                <span className="tabular block text-[11px] text-muted-foreground">
                  Bal {money(r.balance)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {/* Tablet / desktop / print: table */}
      <div className="hidden overflow-x-auto lg:block print:block">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/70 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Date</th>
              <th className="px-4 py-2.5 text-left font-medium">Details</th>
              <th className="px-4 py-2.5 text-right font-medium">You gave</th>
              <th className="px-4 py-2.5 text-right font-medium">You got</th>
              <th className="px-4 py-2.5 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr
                key={r.key}
                onClick={() => onRowClick?.(r)}
                className={
                  onRowClick ? "cursor-pointer hover:bg-muted/50" : undefined
                }
              >
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {shortDate(r.date)}
                </td>
                <td className="max-w-80 px-4 py-2.5">
                  <p className="truncate font-medium">{r.reason}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {modeLabel(r.mode)}
                    {r.note ? ` · ${r.note}` : ""}
                  </p>
                </td>
                <td className="tabular px-4 py-2.5 text-right text-gave">
                  {r.amount > 0 ? money(r.amount) : ""}
                </td>
                <td className="tabular px-4 py-2.5 text-right text-got">
                  {r.amount < 0 ? money(-r.amount) : ""}
                </td>
                <td className="tabular px-4 py-2.5 text-right font-semibold">
                  {money(r.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

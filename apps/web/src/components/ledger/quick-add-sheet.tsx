import { useNavigate } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  HandCoins,
  Landmark,
  UserPlus,
} from "lucide-react";
import { ResponsiveSheet } from "@/components/common/responsive-sheet";
import { useSheets } from "@/stores/sheets-store";

/** What do you want to record? — opened by the FAB / "New entry". */
export function QuickAddSheet() {
  const s = useSheets();
  const navigate = useNavigate();
  const tiles = [
    {
      label: "You gave",
      sub: "Cash / UPI to someone",
      icon: ArrowUpRight,
      tone: "bg-gave/12 text-gave",
      onClick: () => s.openEntry({ mode: "new", prefill: { type: "gave" } }),
    },
    {
      label: "You got",
      sub: "Money back or paid for you",
      icon: ArrowDownLeft,
      tone: "bg-got/12 text-got",
      onClick: () => s.openEntry({ mode: "new", prefill: { type: "got" } }),
    },
    {
      label: "Lend at interest",
      sub: "Loan with monthly interest",
      icon: HandCoins,
      tone: "bg-accent text-accent-foreground",
      onClick: () =>
        s.openLoan({ mode: "new", prefill: { direction: "lent" } }),
    },
    {
      label: "Borrow",
      sub: "Loan you have to repay",
      icon: Landmark,
      tone: "bg-gold/15 text-gold",
      onClick: () =>
        s.openLoan({ mode: "new", prefill: { direction: "borrowed" } }),
    },
  ];
  return (
    <ResponsiveSheet
      open={s.quickAdd}
      onOpenChange={(o) => !o && s.close("quickAdd")}
      title="New entry"
      description="What do you want to record?"
    >
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={t.onClick}
            className="flex flex-col items-start gap-3 rounded-2xl border bg-card p-4 text-left transition-colors hover:bg-muted active:scale-[0.98]"
          >
            <span
              className={`grid size-11 place-items-center rounded-xl ${t.tone}`}
            >
              <t.icon className="size-5.5" />
            </span>
            <span>
              <span className="block font-semibold">{t.label}</span>
              <span className="block text-xs text-muted-foreground">
                {t.sub}
              </span>
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() =>
          s.openConnection(undefined, (c) =>
            navigate({
              to: "/connections/$connectionId",
              params: { connectionId: String(c.id) },
            }),
          )
        }
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed p-3 text-sm font-medium text-muted-foreground hover:bg-muted"
      >
        <UserPlus className="size-4" /> Add a person
      </button>
    </ResponsiveSheet>
  );
}

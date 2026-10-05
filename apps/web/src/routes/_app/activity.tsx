import { createFileRoute } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { Download, History, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/common/page-header";
import { Segmented } from "@/components/common/segmented";
import { EmptyState, ErrorState, PageLoader } from "@/components/common/states";
import {
  ActivityItem,
  flowOf,
  rowTitle,
} from "@/components/ledger/activity-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActivity } from "@/hooks/use-ledger";
import { downloadCsv } from "@/lib/csv";
import { modeLabel, money, todayStr } from "@/lib/format";

export const Route = createFileRoute("/_app/activity")({
  component: ActivityPage,
});

type Filter = "all" | "out" | "in" | "loans";

function ActivityPage() {
  const { data, isLoading, error } = useActivity();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (filter === "loans" && r.source !== "loan") return false;
      if ((filter === "in" || filter === "out") && flowOf(r) !== filter)
        return false;
      if (!needle) return true;
      return [r.title, r.connectionName, r.note, r.viaName]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(needle));
    });
  }, [data, q, filter]);

  const months = useMemo(() => {
    const groups: {
      key: string;
      label: string;
      rows: typeof rows;
      out: number;
      inn: number;
    }[] = [];
    for (const r of rows) {
      const key = r.date.slice(0, 7);
      let g = groups.at(-1);
      if (!g || g.key !== key) {
        g = {
          key,
          label: format(parseISO(r.date), "MMMM yyyy"),
          rows: [],
          out: 0,
          inn: 0,
        };
        groups.push(g);
      }
      g.rows.push(r);
      const f = flowOf(r);
      if (f === "out") g.out += r.amount;
      if (f === "in") g.inn += r.amount;
    }
    return groups;
  }, [rows]);

  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorState error={error} />;

  return (
    <div>
      <PageHeader
        title="Activity"
        description="Every entry and loan payment, newest first."
        actions={
          <Button
            variant="outline"
            disabled={!rows.length}
            onClick={() =>
              downloadCsv(
                `khata-connect-activity-${todayStr()}.csv`,
                [
                  "Date",
                  "Person",
                  "Details",
                  "Type",
                  "Amount",
                  "Mode",
                  "Via",
                  "Note",
                ],
                rows.map((r) => [
                  r.date,
                  r.connectionName,
                  rowTitle(r),
                  flowOf(r) === "out"
                    ? "You gave"
                    : flowOf(r) === "in"
                      ? "You got"
                      : "Waived",
                  r.amount,
                  modeLabel(r.mode),
                  r.viaName ?? "",
                  r.note ?? "",
                ]),
              )
            }
          >
            <Download /> Export CSV
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search person, reason or note"
            className="h-10 pl-9"
          />
        </div>
        <Segmented
          value={filter}
          onChange={setFilter}
          size="sm"
          options={[
            { value: "all", label: "All" },
            { value: "out", label: "You gave" },
            { value: "in", label: "You got" },
            { value: "loans", label: "Loans" },
          ]}
        />
      </div>

      {months.length === 0 ? (
        <EmptyState
          icon={<History className="size-8" />}
          title="Nothing here yet"
        />
      ) : (
        <div className="space-y-4">
          {months.map((m) => (
            <section
              key={m.key}
              className="overflow-hidden rounded-2xl border bg-card"
            >
              <div className="flex items-center justify-between gap-2 border-b bg-muted/50 px-4 py-2 text-xs">
                <span className="font-semibold">{m.label}</span>
                <span className="tabular text-muted-foreground">
                  <span className="text-gave">gave {money(m.out)}</span> ·{" "}
                  <span className="text-got">got {money(m.inn)}</span>
                </span>
              </div>
              <div className="divide-y">
                {m.rows.map((r) => (
                  <ActivityItem key={r.key} row={r} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

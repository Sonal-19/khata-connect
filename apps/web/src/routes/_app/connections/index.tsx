import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Link2, Search, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Amount } from "@/components/common/amount";
import { PageHeader } from "@/components/common/page-header";
import { PersonAvatar } from "@/components/common/person-avatar";
import { Segmented } from "@/components/common/segmented";
import { EmptyState, ErrorState, PageLoader } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConnections } from "@/hooks/use-ledger";
import { dayLabel, money, relationLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSheets } from "@/stores/sheets-store";

export const Route = createFileRoute("/_app/connections/")({
  component: ConnectionsPage,
});

type Filter = "all" | "get" | "give" | "settled";

function ConnectionsPage() {
  const { data, isLoading, error } = useConnections();
  const openConnection = useSheets((s) => s.openConnection);
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.connections ?? [])
      .filter(
        (c) =>
          !needle ||
          c.name.toLowerCase().includes(needle) ||
          c.phone?.includes(needle),
      )
      .filter((c) =>
        filter === "get"
          ? c.summary.net > 0
          : filter === "give"
            ? c.summary.net < 0
            : filter === "settled"
              ? c.summary.net === 0
              : true,
      )
      .sort(
        (a, b) =>
          Math.abs(b.summary.net) - Math.abs(a.summary.net) ||
          a.name.localeCompare(b.name),
      );
  }, [data, q, filter]);

  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorState error={error} />;

  const add = () =>
    openConnection(undefined, (c) =>
      navigate({
        to: "/connections/$connectionId",
        params: { connectionId: String(c.id) },
      }),
    );

  return (
    <div>
      <PageHeader
        title="People"
        description="Everyone you give money to, take from, or who keeps cash for you."
        actions={
          <Button onClick={add}>
            <UserPlus /> Add person
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            You will get
          </p>
          <p className="tabular mt-1 text-lg font-bold text-got sm:text-2xl">
            {money(data.totals.toReceive)}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            You will give
          </p>
          <p className="tabular mt-1 text-lg font-bold text-gave sm:text-2xl">
            {money(data.totals.toPay)}
          </p>
        </div>
      </div>

      {data.connections.length === 0 ? (
        <EmptyState icon={<Users className="size-8" />} title="No people yet">
          Add someone to start recording money with them.
          <div className="mt-4">
            <Button onClick={add}>
              <UserPlus /> Add person
            </Button>
          </div>
        </EmptyState>
      ) : (
        <>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name or phone"
                className="h-10 pl-9"
              />
            </div>
            <Segmented
              value={filter}
              onChange={setFilter}
              size="sm"
              options={[
                { value: "all", label: "All" },
                { value: "get", label: "Will give you" },
                { value: "give", label: "You owe" },
                { value: "settled", label: "Settled" },
              ]}
            />
          </div>

          {list.length === 0 ? (
            <EmptyState title="No one matches" />
          ) : (
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
              {list.map((c) => (
                <li key={c.id}>
                  <Link
                    to="/connections/$connectionId"
                    params={{ connectionId: String(c.id) }}
                    className="flex items-center gap-3 px-3 py-3 hover:bg-muted/60 active:bg-muted sm:px-4"
                  >
                    <PersonAvatar name={c.name} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className="truncate">{c.name}</span>
                        {c.link && (
                          <span
                            title={
                              c.link.status === "accepted"
                                ? `Linked with @${c.link.username}`
                                : `Invite sent to @${c.link.username}`
                            }
                            className={cn(
                              "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                              c.link.status === "accepted"
                                ? "bg-got/12 text-got"
                                : "bg-gold/15 text-gold",
                            )}
                          >
                            <Link2 className="size-3" />@{c.link.username}
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[
                          relationLabel(c.relation),
                          c.summary.activeLoans
                            ? `${c.summary.activeLoans} loan${c.summary.activeLoans > 1 ? "s" : ""}`
                            : null,
                          c.summary.lastActivity
                            ? dayLabel(c.summary.lastActivity)
                            : "No entries",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="text-right">
                      <Amount
                        value={c.summary.net}
                        className="block font-semibold"
                      />
                      <span className="block text-[11px] text-muted-foreground">
                        {c.summary.net > 0
                          ? "will give you"
                          : c.summary.net < 0
                            ? "you will give"
                            : "settled"}
                      </span>
                    </span>
                    <ChevronRight className="hidden size-4 text-muted-foreground sm:block" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

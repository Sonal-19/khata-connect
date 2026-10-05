import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Eye, LogOut } from "lucide-react";
import { useState } from "react";
import { confirm } from "@/components/common/confirm-dialog";
import { PersonAvatar } from "@/components/common/person-avatar";
import { Segmented } from "@/components/common/segmented";
import { EmptyState, ErrorState, PageLoader } from "@/components/common/states";
import { LoanCard } from "@/components/ledger/loan-card";
import { Statement } from "@/components/ledger/statement";
import { Button } from "@/components/ui/button";
import { useLeaveShared, useSharedLedger } from "@/hooks/use-shared";
import { money, owedLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/shared/$linkId/")({
  component: SharedLedgerPage,
});

/** Read-only, mirrored view of someone else's khata with you. */
function SharedLedgerPage() {
  const { linkId } = Route.useParams();
  const id = Number(linkId);
  const { data, isLoading, error } = useSharedLedger(id);
  const leave = useLeaveShared();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"statement" | "loans">("statement");
  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorState error={error} />;
  const { link, summary: s, ledger, loans } = data;
  const net = s.net;
  const first = link.ownerName.split(" ")[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/shared"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Shared with me
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            if (
              await confirm({
                title: `Stop seeing ${first}'s records?`,
                description: `${link.ownerName} keeps their khata; it just won't be shared with you any more.`,
                confirmText: "Leave",
                destructive: true,
              })
            )
              leave.mutate(id, {
                onSuccess: () => navigate({ to: "/shared", replace: true }),
              });
          }}
        >
          <LogOut /> Leave
        </Button>
      </div>

      <section className="rounded-3xl border bg-card p-4 sm:p-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <PersonAvatar name={link.ownerName} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
              {link.ownerName}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              @{link.ownerUsername} · saved you as “{link.connectionName}”
            </p>
          </div>
        </div>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          <Eye className="size-3.5" /> Read-only · recorded by {first}, shown
          from your side
        </p>

        <div
          className={cn(
            "mt-4 rounded-2xl p-4",
            net > 0 ? "bg-got/10" : net < 0 ? "bg-gave/10" : "bg-muted",
          )}
        >
          <p className="text-sm text-muted-foreground">{owedLabel(net)}</p>
          <p
            className={cn(
              "tabular text-3xl font-extrabold tracking-tight",
              net > 0 ? "text-got" : net < 0 ? "text-gave" : "",
            )}
          >
            {money(Math.abs(net))}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {s.ledger !== 0 && (
              <span>
                Without interest:{" "}
                {s.ledger < 0
                  ? `you owe ${first} ${money(-s.ledger)}`
                  : `${first} owes you ${money(s.ledger)}`}
              </span>
            )}
            {s.borrowedPrincipal > 0 && (
              <span>
                Borrowed from {first}: {money(s.borrowedPrincipal)} + interest{" "}
                {money(s.borrowedInterest)}
              </span>
            )}
            {s.lentPrincipal > 0 && (
              <span>
                Lent to {first}: {money(s.lentPrincipal)} + interest{" "}
                {money(s.lentInterest)}
              </span>
            )}
          </div>
        </div>
      </section>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "statement", label: `Statement (${ledger.length})` },
          { value: "loans", label: `Loans (${loans.length})` },
        ]}
      />

      {tab === "statement" ? (
        ledger.length ? (
          <Statement rows={ledger} />
        ) : (
          <EmptyState title="No entries yet" />
        )
      ) : loans.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {loans.map((l) => (
            <LoanCard key={l.id} loan={l} sharedLinkId={id} />
          ))}
        </div>
      ) : (
        <EmptyState title="No loans between you" />
      )}
    </div>
  );
}

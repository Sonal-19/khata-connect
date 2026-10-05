import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ChevronRight, Copy, UserCheck, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { PersonAvatar } from "@/components/common/person-avatar";
import { EmptyState, ErrorState, PageLoader } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useRespondInvite, useShared } from "@/hooks/use-shared";
import { BRAND } from "@/lib/brand";
import { dayLabel, money, owedLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/shared/")({
  component: SharedPage,
});

function MyUsername() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed bg-card p-4">
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">Your username</p>
        <p className="truncate text-lg font-bold">@{user.username}</p>
        <p className="text-xs text-muted-foreground">
          Give it to people who keep a khata with you on {BRAND.name}.
        </p>
      </div>
      <Button
        variant="outline"
        onClick={() =>
          navigator.clipboard
            ?.writeText(`@${user.username}`)
            .then(() => toast.success("Username copied"))
            .catch(() => toast.error("Couldn't copy"))
        }
      >
        <Copy /> Copy
      </Button>
    </div>
  );
}

function SharedPage() {
  const { data, isLoading, error } = useShared();
  const respond = useRespondInvite();
  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorState error={error} />;
  const { invites, shared, totals } = data;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Shared with me"
        description="Ledgers other people keep with you. Read-only — they record, you see it from your side."
      />

      {shared.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground sm:text-sm">
              Owed by you
            </p>
            <p className="tabular mt-1 text-lg font-bold text-gave sm:text-2xl">
              {money(totals.owedByYou)}
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground sm:text-sm">
              Owed to you
            </p>
            <p className="tabular mt-1 text-lg font-bold text-got sm:text-2xl">
              {money(totals.owedToYou)}
            </p>
          </div>
        </div>
      )}

      {invites.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Invites ({invites.length})
          </h2>
          {invites.map((i) => (
            <div
              key={i.id}
              className="rounded-2xl border border-gold/40 bg-gold/5 p-4"
            >
              <div className="flex items-start gap-3">
                <PersonAvatar name={i.ownerName} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {i.ownerName}{" "}
                    <span className="font-normal text-muted-foreground">
                      @{i.ownerUsername}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    wants to share their records with you · saved you as “
                    {i.connectionName}” · {dayLabel(String(i.createdAt))}
                  </p>
                  {i.summary && i.summary.net !== 0 && (
                    <p className="mt-1 text-sm">
                      Their records say:{" "}
                      <b
                        className={i.summary.net < 0 ? "text-gave" : "text-got"}
                      >
                        {owedLabel(i.summary.net).toLowerCase()}{" "}
                        {money(Math.abs(i.summary.net))}
                      </b>
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                <Button
                  variant="outline"
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ id: i.id, accept: false })}
                >
                  <X /> Decline
                </Button>
                <Button
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ id: i.id, accept: true })}
                >
                  <Check /> Accept
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        {invites.length > 0 && shared.length > 0 && (
          <h2 className="text-sm font-semibold text-muted-foreground">
            Shared ledgers
          </h2>
        )}
        {shared.length === 0 && invites.length === 0 ? (
          <EmptyState
            icon={<UserCheck className="size-8" />}
            title="Nothing shared with you yet"
          >
            When someone tags your username on {BRAND.name}, their invite shows
            up here.
          </EmptyState>
        ) : (
          shared.length > 0 && (
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
              {shared.map((i) => {
                const net = i.summary?.net ?? 0;
                return (
                  <li key={i.id}>
                    <Link
                      to="/shared/$linkId"
                      params={{ linkId: String(i.id) }}
                      className="flex items-center gap-3 px-3 py-3 hover:bg-muted/60 active:bg-muted sm:px-4"
                    >
                      <PersonAvatar name={i.ownerName} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {i.ownerName}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          @{i.ownerUsername} · their khata with you
                        </span>
                      </span>
                      <span className="text-right">
                        <span
                          className={cn(
                            "tabular block font-semibold",
                            net < 0 && "text-gave",
                            net > 0 && "text-got",
                          )}
                        >
                          {money(Math.abs(net))}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {owedLabel(net).toLowerCase()}
                        </span>
                      </span>
                      <ChevronRight className="hidden size-4 text-muted-foreground sm:block" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )
        )}
      </section>

      <MyUsername />
    </div>
  );
}

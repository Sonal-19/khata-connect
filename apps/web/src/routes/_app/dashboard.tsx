import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  BadgePercent,
  CalendarClock,
  ChevronRight,
  FileSpreadsheet,
  HandCoins,
  Landmark,
  Plus,
  UserCheck,
  UserPlus,
  Wallet,
} from "lucide-react";
import { SectionCard } from "@/components/app/section-card";
import { Amount } from "@/components/common/amount";
import { PersonAvatar } from "@/components/common/person-avatar";
import { ErrorState, PageLoader } from "@/components/common/states";
import { ActivityList } from "@/components/ledger/activity-list";
import { NetChart } from "@/components/ledger/net-chart";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { type Dashboard, useDashboard } from "@/hooks/use-ledger";
import { dayLabel, money, relationLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSheets } from "@/stores/sheets-store";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function Tile({
  label,
  value,
  icon: Icon,
  tone,
  sub,
}: {
  label: string;
  value: number;
  icon: typeof Wallet;
  tone: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground sm:text-sm">
          {label}
        </p>
        <span
          className={cn("grid size-8 place-items-center rounded-full", tone)}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <p className="tabular mt-2 truncate text-lg font-bold sm:text-2xl">
        {money(value)}
      </p>
      {sub && (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}

/** Invites waiting + balances from ledgers others share with me. */
function SharedBanner({ shared }: { shared: Dashboard["shared"] }) {
  if (!shared.pendingInvites && !shared.ledgers) return null;
  return (
    <Link
      to="/shared"
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-3 transition-colors hover:bg-muted/60 sm:p-4",
        shared.pendingInvites ? "border-gold/40 bg-gold/5" : "bg-card",
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
        <UserCheck className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">
          {shared.pendingInvites
            ? `${shared.pendingInvites} invite${shared.pendingInvites > 1 ? "s" : ""} waiting for you`
            : "Shared with me"}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {shared.ledgers
            ? `Owed by you ${money(shared.owedByYou)} · owed to you ${money(shared.owedToYou)}`
            : "Someone tagged your username — accept to see their records"}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function Welcome({ shared }: { shared: Dashboard["shared"] }) {
  const s = useSheets();
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-2xl py-6 text-center sm:py-12">
      <div className="mb-6 text-left">
        <SharedBanner shared={shared} />
      </div>
      <img src="/favicon.svg" alt="" className="mx-auto size-16 rounded-2xl" />
      <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">
        Welcome{user ? `, ${user.name.split(" ")[0]}` : ""}! Let's set up your
        khata
      </h1>
      <p className="mt-2 text-muted-foreground">
        Add the people you exchange money with, or bring your existing Excel
        sheet.
      </p>
      <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
        {[
          {
            icon: UserPlus,
            t: "Add a person",
            d: "Family, friend or shop",
            on: () => s.openConnection(),
          },
          {
            icon: HandCoins,
            t: "Record a loan",
            d: "With monthly interest",
            on: () => s.openLoan({ mode: "new", prefill: {} }),
          },
        ].map((a) => (
          <button
            key={a.t}
            type="button"
            onClick={a.on}
            className="rounded-2xl border bg-card p-4 transition-colors hover:bg-muted"
          >
            <a.icon className="size-5 text-primary" />
            <p className="mt-3 font-semibold">{a.t}</p>
            <p className="text-xs text-muted-foreground">{a.d}</p>
          </button>
        ))}
        <Link
          to="/import"
          className="rounded-2xl border bg-card p-4 transition-colors hover:bg-muted"
        >
          <FileSpreadsheet className="size-5 text-primary" />
          <p className="mt-3 font-semibold">Import Excel</p>
          <p className="text-xs text-muted-foreground">.xlsx or .csv khata</p>
        </Link>
      </div>
    </div>
  );
}

function DashboardPage() {
  const { data, isLoading, error } = useDashboard();
  const openQuickAdd = useSheets((s) => s.openQuickAdd);
  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorState error={error} />;
  if (!data.counts.connections) return <Welcome shared={data.shared} />;
  const t = data.totals;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Net position */}
      <section className="relative overflow-hidden rounded-3xl bg-linear-135 from-(--hero-from) to-(--hero-to) p-5 text-(--hero-foreground) shadow-xl shadow-black/15 ring-1 ring-white/10 sm:p-7">
        <div className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-white/12 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-12 size-48 rounded-full bg-gold/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm opacity-80">Net position with everyone</p>
            <p className="tabular mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t.net < 0 ? "−" : ""}
              {money(Math.abs(t.net))}
            </p>
            <p className="mt-1 text-xs opacity-75">
              Including interest till {dayLabel(data.asOf).toLowerCase()}
            </p>
          </div>
          <Button
            onClick={openQuickAdd}
            className="hidden rounded-full bg-white text-(--hero-to) shadow-sm hover:bg-white/90 md:inline-flex"
          >
            <Plus /> New entry
          </Button>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/12 p-3 ring-1 ring-white/10 backdrop-blur-sm">
            <p className="text-xs opacity-80">You will get</p>
            <p className="tabular text-lg font-bold sm:text-xl">
              {money(t.toReceive)}
            </p>
          </div>
          <div className="rounded-2xl bg-white/12 p-3 ring-1 ring-white/10 backdrop-blur-sm">
            <p className="text-xs opacity-80">You will give</p>
            <p className="tabular text-lg font-bold sm:text-xl">
              {money(t.toPay)}
            </p>
          </div>
        </div>
      </section>

      <SharedBanner shared={data.shared} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Held by people"
          value={t.heldByOthers}
          icon={Wallet}
          tone="bg-accent text-accent-foreground"
          sub={
            t.heldForOthers
              ? `You hold ${money(t.heldForOthers)} of theirs`
              : "Cash & udhaar"
          }
        />
        <Tile
          label="Lent out"
          value={t.lentPrincipal}
          icon={HandCoins}
          tone="bg-got/12 text-got"
          sub={`${data.counts.activeLoans} active loan${data.counts.activeLoans === 1 ? "" : "s"}`}
        />
        <Tile
          label="Interest due to you"
          value={t.lentInterest}
          icon={BadgePercent}
          tone="bg-gold/15 text-gold"
          sub={
            data.monthlyInterestIncome
              ? `${money(data.monthlyInterestIncome)} every month`
              : undefined
          }
        />
        <Tile
          label="You owe (loans)"
          value={t.borrowedPrincipal + t.borrowedInterest}
          icon={Landmark}
          tone="bg-gave/12 text-gave"
          sub={
            t.borrowedInterest
              ? `incl. ${money(t.borrowedInterest)} interest`
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr] lg:gap-5">
        <SectionCard title="Over time">
          {data.chart.length > 1 ? (
            <NetChart data={data.chart} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              The chart fills in as you add entries over a few months.
            </p>
          )}
        </SectionCard>

        <SectionCard
          title="Coming up"
          action={
            <Link to="/loans" className="text-sm font-medium text-primary">
              Loans
            </Link>
          }
        >
          {data.upcoming.length ? (
            <ul className="-mx-1 space-y-1">
              {data.upcoming.map((u) => (
                <li key={u.key}>
                  <Link
                    to="/loans/$loanId"
                    params={{ loanId: String(u.loanId) }}
                    className="flex items-center gap-3 rounded-xl px-1 py-2 hover:bg-muted"
                  >
                    <span
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-xl",
                        u.type === "overdue"
                          ? "bg-destructive/10 text-destructive"
                          : u.type === "due"
                            ? "bg-gold/15 text-gold"
                            : "bg-accent text-accent-foreground",
                      )}
                    >
                      {u.type === "overdue" ? (
                        <AlertTriangle className="size-4" />
                      ) : (
                        <CalendarClock className="size-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {u.type === "interest"
                          ? `Interest ${u.direction === "lent" ? "from" : "to"} ${u.connectionName}`
                          : `${u.title} ${u.type === "overdue" ? "overdue" : "due"}`}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {dayLabel(u.date)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "tabular text-sm font-semibold",
                        u.direction === "lent" ? "text-got" : "text-gave",
                      )}
                    >
                      {money(u.amount)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing due soon. Set an interest day or due date on a loan to see
              reminders here.
            </p>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        <SectionCard
          title="Balances"
          action={
            <Link
              to="/connections"
              className="text-sm font-medium text-primary"
            >
              All people
            </Link>
          }
        >
          {data.people.length ? (
            <ul className="-mx-1">
              {data.people.map((p) => (
                <li key={p.id}>
                  <Link
                    to="/connections/$connectionId"
                    params={{ connectionId: String(p.id) }}
                    className="flex items-center gap-3 rounded-xl px-1 py-2 hover:bg-muted"
                  >
                    <PersonAvatar name={p.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {p.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {p.summary.net > 0 ? "Will give you" : "You will give"}{" "}
                        · {relationLabel(p.relation)}
                      </span>
                    </span>
                    <Amount
                      value={p.summary.net}
                      className="text-sm font-semibold"
                    />
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Everyone is settled up.
            </p>
          )}
        </SectionCard>

        <SectionCard
          title="Recent activity"
          action={
            <Link to="/activity" className="text-sm font-medium text-primary">
              See all
            </Link>
          }
        >
          {data.recent.length ? (
            <div className="-mx-4 -mb-4 sm:-mx-5 sm:-mb-5">
              <ActivityList rows={data.recent} showPerson />
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No entries yet.
            </p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

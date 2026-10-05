import { createFileRoute, Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { ArrowRight, History } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ActionList } from "@/components/admin/action-list";
import { SectionCard } from "@/components/app/section-card";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, ErrorState, PageLoader } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import {
  type AdminStats,
  useAdminActions,
  useAdminStats,
} from "@/hooks/use-admin";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/admin/")({
  component: AdminOverviewPage,
});

const nf = new Intl.NumberFormat("en-IN");

function Tile({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: number;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border bg-card p-4", className)}>
      <p className="text-xs font-medium text-muted-foreground sm:text-sm">
        {label}
      </p>
      <p className="tabular mt-1 text-2xl font-bold sm:text-3xl">
        {nf.format(value)}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function SignupChart({ data }: { data: AdminStats["signups"] }) {
  return (
    <div className="h-52 sm:h-60">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -16, right: 4, top: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="month"
            tickFormatter={(m: string) => format(parseISO(`${m}-01`), "MMM")}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={4}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <div className="rounded-xl border bg-popover px-3 py-2 text-xs shadow-lg">
                  <p className="font-semibold">
                    {format(
                      parseISO(`${payload[0].payload.month}-01`),
                      "MMMM yyyy",
                    )}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="tabular font-medium text-foreground">
                      {payload[0].value}
                    </span>{" "}
                    new users
                  </p>
                </div>
              ) : null
            }
          />
          <Bar
            dataKey="users"
            fill="var(--chart-held)"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AdminOverviewPage() {
  const stats = useAdminStats();
  const recent = useAdminActions(undefined, 6);

  if (stats.isLoading) return <PageLoader />;
  if (stats.error || !stats.data) return <ErrorState error={stats.error} />;
  const s = stats.data;

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Accounts and usage. Admins never see anyone's people or amounts."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Total users"
          value={s.total}
          sub={`${s.admins} admin${s.admins === 1 ? "" : "s"}`}
          className="bg-primary text-primary-foreground [&_p]:text-primary-foreground/90"
        />
        <Tile label="New this week" value={s.last7} sub="last 7 days" />
        <Tile label="New this month" value={s.last30} sub="last 30 days" />
        <Tile
          label="Shared ledgers"
          value={s.links}
          sub="accepted @username links"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr] lg:gap-5">
        <SectionCard title="New users per month">
          <SignupChart data={s.signups} />
        </SectionCard>
        <SectionCard title="Records across all users">
          <dl className="divide-y text-sm">
            {[
              ["People added", s.people],
              ["Gave / got entries", s.entries],
              ["Loans", s.loans],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="tabular font-semibold">
                  {nf.format(Number(v))}
                </dd>
              </div>
            ))}
          </dl>
        </SectionCard>
      </div>

      <SectionCard
        className="mt-4"
        title={
          <span className="flex items-center gap-2">
            <History className="size-4" /> Recent admin activity
          </span>
        }
        action={
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/activity">
              View all <ArrowRight />
            </Link>
          </Button>
        }
      >
        {recent.data?.length ? (
          <ActionList actions={recent.data} />
        ) : (
          <EmptyState
            title={recent.isLoading ? "Loading…" : "No admin actions yet"}
          />
        )}
      </SectionCard>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { HandCoins, Plus } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/common/page-header";
import { Segmented } from "@/components/common/segmented";
import { EmptyState, ErrorState, PageLoader } from "@/components/common/states";
import { LoanCard } from "@/components/ledger/loan-card";
import { Button } from "@/components/ui/button";
import { useLoans } from "@/hooks/use-ledger";
import { money } from "@/lib/format";
import { useSheets } from "@/stores/sheets-store";

export const Route = createFileRoute("/_app/loans/")({
  component: LoansPage,
});

type Tab = "lent" | "borrowed" | "closed";

function LoansPage() {
  const { data, isLoading, error } = useLoans();
  const openLoan = useSheets((s) => s.openLoan);
  const [tab, setTab] = useState<Tab>("lent");
  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorState error={error} />;
  const t = data.totals;
  const list = data.loans.filter((l) =>
    tab === "closed"
      ? l.status === "closed"
      : l.status === "active" && l.direction === tab,
  );
  const count = (x: Tab) =>
    data.loans.filter((l) =>
      x === "closed"
        ? l.status === "closed"
        : l.status === "active" && l.direction === x,
    ).length;

  return (
    <div>
      <PageHeader
        title="Loans & interest"
        description="Money lent or borrowed with interest, worked out till today."
        actions={
          <Button
            onClick={() =>
              openLoan({
                mode: "new",
                prefill: {
                  direction: tab === "borrowed" ? "borrowed" : "lent",
                },
              })
            }
          >
            <Plus /> New loan
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">Lent out</p>
          <p className="tabular mt-1 text-lg font-bold sm:text-2xl">
            {money(t.lentPrincipal)}
          </p>
          <p className="text-xs text-muted-foreground">
            + {money(t.lentInterest)} interest due
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Interest income
          </p>
          <p className="tabular mt-1 text-lg font-bold text-got sm:text-2xl">
            {money(t.monthlyIncome)}
          </p>
          <p className="text-xs text-muted-foreground">every month</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">Borrowed</p>
          <p className="tabular mt-1 text-lg font-bold sm:text-2xl">
            {money(t.borrowedPrincipal)}
          </p>
          <p className="text-xs text-muted-foreground">
            + {money(t.borrowedInterest)} interest due
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground sm:text-sm">
            Interest cost
          </p>
          <p className="tabular mt-1 text-lg font-bold text-gave sm:text-2xl">
            {money(t.monthlyCost)}
          </p>
          <p className="text-xs text-muted-foreground">every month</p>
        </div>
      </div>

      <Segmented
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: "lent", label: `Lent (${count("lent")})` },
          { value: "borrowed", label: `Borrowed (${count("borrowed")})` },
          { value: "closed", label: `Closed (${count("closed")})` },
        ]}
      />

      {list.length === 0 ? (
        <EmptyState
          icon={<HandCoins className="size-8" />}
          title="No loans here"
        >
          {tab === "closed"
            ? "Loans you close appear here with their full history."
            : "Record money lent or borrowed, with or without interest."}
        </EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((l) => (
            <LoanCard key={l.id} loan={l} />
          ))}
        </div>
      )}
    </div>
  );
}

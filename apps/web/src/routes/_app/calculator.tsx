import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/page-header";
import { InterestCalculator } from "@/components/ledger/interest-calculator";

export const Route = createFileRoute("/_app/calculator")({
  component: CalculatorPage,
});

function CalculatorPage() {
  return (
    <div>
      <PageHeader
        title="Interest calculator"
        description="Quick byaaj maths — the same calculation used for your loans."
      />
      <div className="rounded-2xl border bg-card p-4 sm:p-6">
        <InterestCalculator full />
      </div>
    </div>
  );
}

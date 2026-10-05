import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Eye } from "lucide-react";
import { ErrorState, PageLoader } from "@/components/common/states";
import { LoanView } from "@/components/ledger/loan-view";
import { useSharedLoan } from "@/hooks/use-shared";

export const Route = createFileRoute("/_app/shared/$linkId/loans/$loanId")({
  component: SharedLoanPage,
});

function SharedLoanPage() {
  const { linkId, loanId } = Route.useParams();
  const { data, isLoading, error } = useSharedLoan(
    Number(linkId),
    Number(loanId),
  );
  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorState error={error} />;
  const { link, loan } = data;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to="/shared/$linkId"
          params={{ linkId }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> {link.ownerName}
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          <Eye className="size-3.5" /> Read-only · recorded by @
          {link.ownerUsername}
        </span>
      </div>
      <LoanView l={loan} />
    </div>
  );
}

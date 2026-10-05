import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  CircleCheck,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { confirm } from "@/components/common/confirm-dialog";
import { ErrorState, PageLoader } from "@/components/common/states";
import { LoanView } from "@/components/ledger/loan-view";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import {
  type LoanDetail,
  useCloseLoan,
  useConnections,
  useDeleteLoan,
  useLoan,
  useReopenLoan,
} from "@/hooks/use-ledger";
import { BRAND } from "@/lib/brand";
import {
  type LoanEventKind,
  money,
  type PaymentMode,
  rateLabel,
  shortDate,
  todayStr,
} from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";
import { useSheets } from "@/stores/sheets-store";

export const Route = createFileRoute("/_app/loans/$loanId")({
  component: LoanPage,
});

function reminder(l: LoanDetail, me: string) {
  const s = l.summary;
  const first = l.connectionName.split(" ")[0];
  const next = l.upcoming[0];
  return [
    `Namaste ${first} 🙏`,
    "",
    `${l.title} — as on ${shortDate(todayStr())}:`,
    `• Principal: ${money(s.principalOut)}`,
    `• Interest (${rateLabel(l).split(" · ")[0]}): ${money(s.interestDue)} pending`,
    `• Total: ${money(s.totalDue)}`,
    next
      ? `\nNext interest of ${money(next.amount)} is due on ${shortDate(next.date)}.`
      : "",
    "",
    `— ${me} (via ${BRAND.name})`,
  ]
    .filter((x) => x !== undefined)
    .join("\n");
}

function LoanPage() {
  const { loanId } = Route.useParams();
  const id = Number(loanId);
  const { data: l, isLoading, error } = useLoan(id);
  const { data: people } = useConnections();
  const { user } = useAuth();
  const s = useSheets();
  const close = useCloseLoan();
  const reopen = useReopenLoan();
  const del = useDeleteLoan();
  const navigate = useNavigate();

  if (isLoading) return <PageLoader />;
  if (error || !l) return <ErrorState error={error} />;
  const sum = l.summary;
  const _lent = l.direction === "lent";
  const closed = l.status === "closed";
  const phone = people?.connections.find((c) => c.id === l.connectionId)?.phone;

  const addEvent = (kind: LoanEventKind = "interest") =>
    s.openEvent({
      loanId: l.id,
      direction: l.direction,
      title: l.title,
      value: {
        kind,
        amount:
          kind === "interest" && sum.monthlyInterest
            ? sum.monthlyInterest
            : undefined,
      },
      suggest: {
        monthlyInterest: sum.monthlyInterest,
        interestDue: sum.interestDue,
        principalOut: sum.principalOut,
      },
    });

  const closeLoan = async () => {
    const outstanding = sum.totalDue > 0;
    if (
      await confirm({
        title: "Close this loan?",
        description: outstanding
          ? `${money(sum.totalDue)} is still outstanding. Interest stops from today; record the final payment or a waiver first if it's settled.`
          : "Interest stops from today. You can reopen it any time.",
        confirmText: "Close loan",
      })
    )
      close.mutate({ id: l.id, date: todayStr() });
  };

  const remove = async () => {
    if (
      await confirm({
        title: "Delete this loan?",
        description: `All ${l.events.length} payments are deleted too${l.viaName ? `, and ${l.viaName}'s balance changes back` : ""}. This can't be undone.`,
        confirmText: "Delete",
        destructive: true,
      })
    )
      del.mutate(l.id, {
        onSuccess: () => navigate({ to: "/loans", replace: true }),
      });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/loans"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Loans
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreHorizontal /> More
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem
              onClick={() =>
                s.openLoan({
                  mode: "edit",
                  id: l.id,
                  value: {
                    connectionId: l.connectionId,
                    direction: l.direction,
                    title: l.title,
                    interestType: l.interestType,
                    ratePercent: l.ratePercent,
                    ratePeriod: l.ratePeriod,
                    basis: l.basis,
                    interestDay: l.interestDay,
                    dueDate: l.dueDate,
                    viaConnectionId: l.viaConnectionId,
                    collateral: l.collateral,
                    note: l.note,
                  },
                })
              }
            >
              <Pencil /> Edit terms
            </DropdownMenuItem>
            {closed ? (
              <DropdownMenuItem onClick={() => reopen.mutate(l.id)}>
                <RotateCcw /> Reopen loan
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={closeLoan}>
                <CircleCheck /> Close loan
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={remove}>
              <Trash2 /> Delete loan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <LoanView
        l={l}
        party={
          <Link
            to="/connections/$connectionId"
            params={{ connectionId: String(l.connectionId) }}
            className="font-medium text-foreground hover:underline"
          >
            {l.connectionName}
          </Link>
        }
        actions={
          <>
            <Button
              className="h-11 sm:flex-1"
              onClick={() => addEvent("interest")}
            >
              <Plus /> Record payment
            </Button>
            <Button variant="outline" className="h-11 sm:flex-1" asChild>
              <a
                href={whatsappLink(phone, reminder(l, user?.name ?? "Me"))}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle /> WhatsApp
              </a>
            </Button>
          </>
        }
        onEventClick={(e) =>
          s.openEvent({
            loanId: l.id,
            direction: l.direction,
            title: l.title,
            id: e.id,
            value: {
              kind: e.kind,
              amount: e.amount,
              date: e.date,
              mode: e.mode as PaymentMode,
              note: e.note,
            },
          })
        }
      />
    </div>
  );
}

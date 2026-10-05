import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  AtSign,
  Clock,
  Download,
  HandCoins,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  Printer,
  Trash2,
  Unlink,
} from "lucide-react";
import { useState } from "react";
import { Amount } from "@/components/common/amount";
import { confirm } from "@/components/common/confirm-dialog";
import { PersonAvatar } from "@/components/common/person-avatar";
import { Segmented } from "@/components/common/segmented";
import { EmptyState, ErrorState, PageLoader } from "@/components/common/states";
import { LinkSheet } from "@/components/ledger/link-sheet";
import { LoanCard } from "@/components/ledger/loan-card";
import { Statement } from "@/components/ledger/statement";
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
  type ConnectionDetail,
  type LedgerRow,
  useConnection,
  useDeleteConnection,
} from "@/hooks/use-ledger";
import { useUnlinkConnection } from "@/hooks/use-shared";
import { BRAND } from "@/lib/brand";
import { downloadCsv } from "@/lib/csv";
import {
  balanceSentence,
  modeLabel,
  money,
  type PaymentMode,
  relationLabel,
  shortDate,
  todayStr,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";
import { useSheets } from "@/stores/sheets-store";

export const Route = createFileRoute("/_app/connections/$connectionId")({
  component: ConnectionPage,
});

function reminderText(d: ConnectionDetail, from: string) {
  const first = d.connection.name.split(" ")[0];
  const lines = [`Namaste ${first} 🙏`, "", "As per my records today:"];
  if (d.summary.ledger)
    lines.push(
      d.summary.ledger > 0
        ? `• You are holding ${money(d.summary.ledger)} of mine`
        : `• I am holding ${money(-d.summary.ledger)} of yours`,
    );
  for (const l of d.loans.filter((x) => x.status === "active")) {
    const s = l.summary;
    lines.push(
      `• ${l.title}: principal ${money(s.principalOut)}` +
        (s.interestDue ? ` + interest ${money(s.interestDue)}` : "") +
        ` = ${money(s.totalDue)}`,
    );
  }
  lines.push(
    "",
    d.summary.net > 0
      ? `Total: ${money(d.summary.net)} to be received.`
      : d.summary.net < 0
        ? `Total: ${money(-d.summary.net)} I have to give you.`
        : "We are all settled. 👍",
    "",
    `— ${from} (via ${BRAND.name})`,
  );
  return lines.join("\n");
}

function ConnectionPage() {
  const { connectionId } = Route.useParams();
  const id = Number(connectionId);
  const { data, isLoading, error } = useConnection(id);
  const { user } = useAuth();
  const s = useSheets();
  const del = useDeleteConnection();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"statement" | "loans">("statement");
  const [linking, setLinking] = useState(false);
  const unlinkMut = useUnlinkConnection();

  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorState error={error} />;
  const { connection: c, summary, ledger, loans, viaLoans, link } = data;

  const unlink = async () => {
    if (!link) return;
    if (
      await confirm({
        title:
          link.status === "pending"
            ? `Cancel the invite to @${link.username}?`
            : `Unlink @${link.username}?`,
        description:
          link.status === "pending"
            ? undefined
            : `${link.name} will no longer see this ledger. Your records stay as they are.`,
        confirmText: link.status === "pending" ? "Cancel invite" : "Unlink",
        destructive: true,
      })
    )
      unlinkMut.mutate(c.id);
  };

  const editEntry = (row: LedgerRow) => {
    if (row.source === "loan" && row.loanId)
      return navigate({
        to: "/loans/$loanId",
        params: { loanId: String(row.loanId) },
      });
    s.openEntry({
      mode: "edit",
      id: row.id,
      value: {
        connectionId: c.id,
        type: row.amount > 0 ? "gave" : "got",
        amount: Math.abs(row.amount),
        date: row.date,
        reason: row.reason,
        mode: row.mode as PaymentMode,
        note: row.note,
      },
    });
  };

  const exportCsv = () =>
    downloadCsv(
      `${c.name.replace(/\W+/g, "-").toLowerCase()}-statement-${todayStr()}.csv`,
      ["Date", "Details", "Mode", "You gave", "You got", "Balance", "Note"],
      [...ledger]
        .reverse()
        .map((r) => [
          r.date,
          r.reason,
          modeLabel(r.mode),
          r.amount > 0 ? r.amount : "",
          r.amount < 0 ? -r.amount : "",
          r.balance,
          r.note ?? "",
        ]),
    );

  const remove = async () => {
    if (
      await confirm({
        title: `Delete ${c.name}?`,
        description: `This also deletes ${ledger.filter((r) => r.source === "entry").length} entries and ${loans.length} loan(s) with ${c.name}. This can't be undone.`,
        confirmText: "Delete",
        destructive: true,
      })
    )
      del.mutate(c.id, {
        onSuccess: () => navigate({ to: "/connections", replace: true }),
      });
  };

  const net = summary.net;

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between gap-2">
        <Link
          to="/connections"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> People
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" aria-label="More actions">
              <MoreHorizontal /> More
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem
              onClick={() =>
                s.openConnection({
                  id: c.id,
                  name: c.name,
                  phone: c.phone,
                  email: c.email,
                  relation: c.relation,
                  note: c.note,
                })
              }
            >
              <Pencil /> Edit details
            </DropdownMenuItem>
            {link ? (
              <DropdownMenuItem onClick={unlink}>
                <Unlink />{" "}
                {link.status === "pending" ? "Cancel invite" : "Unlink user"}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => setLinking(true)}>
                <AtSign /> Link {BRAND.name} user
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => window.print()}>
              <Printer /> Print / save PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportCsv} disabled={!ledger.length}>
              <Download /> Export CSV
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={remove}>
              <Trash2 /> Delete person
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Header */}
      <section className="print-plain rounded-3xl border bg-card p-4 sm:p-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <PersonAvatar name={c.name} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
              {c.name}
            </h1>
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              {relationLabel(c.relation)}
              {c.phone && (
                <a
                  href={`tel:${c.phone}`}
                  className="no-print inline-flex items-center gap-1 hover:text-foreground"
                >
                  <Phone className="size-3.5" /> {c.phone}
                </a>
              )}
            </p>
          </div>
        </div>
        <div className="no-print mt-3">
          {link ? (
            <button
              type="button"
              onClick={unlink}
              className={cn(
                "inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                link.status === "accepted"
                  ? "bg-got/12 text-got"
                  : "bg-gold/15 text-gold",
              )}
            >
              {link.status === "accepted" ? (
                <Link2 className="size-3.5 shrink-0" />
              ) : (
                <Clock className="size-3.5 shrink-0" />
              )}
              <span className="truncate">
                {link.status === "accepted"
                  ? `Linked with @${link.username} · they can see this ledger`
                  : `Invite sent to @${link.username} · waiting`}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setLinking(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <AtSign className="size-3.5" /> Tag {c.name.split(" ")[0]}'s{" "}
              {BRAND.name} username
            </button>
          )}
        </div>
        {c.note && (
          <p className="mt-3 rounded-xl bg-muted/70 px-3 py-2 text-sm text-muted-foreground">
            {c.note}
          </p>
        )}

        <div
          className={cn(
            "mt-4 rounded-2xl p-4",
            net > 0 ? "bg-got/10" : net < 0 ? "bg-gave/10" : "bg-muted",
          )}
        >
          <p className="text-sm text-muted-foreground">
            {balanceSentence(c.name, net)}
          </p>
          <p
            className={cn(
              "tabular text-3xl font-extrabold tracking-tight",
              net > 0 ? "text-got" : net < 0 ? "text-gave" : "",
            )}
          >
            {money(Math.abs(net))}
          </p>
          {(summary.lentPrincipal ||
            summary.borrowedPrincipal ||
            summary.lentInterest ||
            summary.borrowedInterest) !== 0 && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                Plain balance: <Amount value={summary.ledger} />
              </span>
              {summary.lentPrincipal > 0 && (
                <span>
                  Lent: {money(summary.lentPrincipal)} + interest{" "}
                  {money(summary.lentInterest)}
                </span>
              )}
              {summary.borrowedPrincipal > 0 && (
                <span>
                  Borrowed: {money(summary.borrowedPrincipal)} + interest{" "}
                  {money(summary.borrowedInterest)}
                </span>
              )}
            </div>
          )}
          <p className="mt-1 hidden text-xs text-muted-foreground print:block">
            Statement as on {shortDate(todayStr())} · {BRAND.name}
          </p>
        </div>

        <div className="no-print mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button
            variant="outline"
            className="h-11 border-gave/30 text-gave hover:bg-gave/10 hover:text-gave"
            onClick={() =>
              s.openEntry({
                mode: "new",
                prefill: { connectionId: c.id, type: "gave" },
              })
            }
          >
            <ArrowUpRight /> You gave
          </Button>
          <Button
            variant="outline"
            className="h-11 border-got/30 text-got hover:bg-got/10 hover:text-got"
            onClick={() =>
              s.openEntry({
                mode: "new",
                prefill: { connectionId: c.id, type: "got" },
              })
            }
          >
            <ArrowDownLeft /> You got
          </Button>
          <Button
            variant="outline"
            className="h-11"
            onClick={() =>
              s.openLoan({ mode: "new", prefill: { connectionId: c.id } })
            }
          >
            <HandCoins /> New loan
          </Button>
          <Button variant="outline" className="h-11" asChild>
            <a
              href={whatsappLink(
                c.phone,
                reminderText(data, user?.name ?? "Me"),
              )}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle /> Remind
            </a>
          </Button>
        </div>
      </section>

      <Segmented
        className="no-print"
        value={tab}
        onChange={setTab}
        options={[
          { value: "statement", label: `Statement (${ledger.length})` },
          {
            value: "loans",
            label: `Loans (${loans.length + viaLoans.length})`,
          },
        ]}
      />

      {tab === "statement" ? (
        ledger.length === 0 ? (
          <EmptyState title="No entries yet">
            Use “You gave” or “You got” to start this person's statement.
          </EmptyState>
        ) : (
          <Statement rows={ledger} onRowClick={editEntry} />
        )
      ) : null}

      {tab === "loans" && (
        <div className="space-y-5">
          {loans.length === 0 && viaLoans.length === 0 ? (
            <EmptyState title="No loans with this person">
              <Button
                className="mt-3"
                onClick={() =>
                  s.openLoan({ mode: "new", prefill: { connectionId: c.id } })
                }
              >
                <HandCoins /> New loan
              </Button>
            </EmptyState>
          ) : (
            <>
              {loans.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2">
                  {loans.map((l) => (
                    <LoanCard key={l.id} loan={l} />
                  ))}
                </div>
              )}
              {viaLoans.length > 0 && (
                <div>
                  <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
                    Lent out of money {c.name.split(" ")[0]} holds
                  </h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    {viaLoans.map((l) => (
                      <LoanCard key={l.id} loan={l} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
      <LinkSheet
        connection={linking ? { id: c.id, name: c.name } : null}
        onClose={() => setLinking(false)}
      />
    </div>
  );
}

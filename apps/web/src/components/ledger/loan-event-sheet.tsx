import { Trash2 } from "lucide-react";
import { useState } from "react";
import { confirm } from "@/components/common/confirm-dialog";
import { Field } from "@/components/common/field";
import { ResponsiveSheet } from "@/components/common/responsive-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDeleteLoanEvent, useSaveLoanEvent } from "@/hooks/use-ledger";
import {
  type LoanEventKind,
  money,
  type PaymentMode,
  todayStr,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSheets } from "@/stores/sheets-store";
import { AmountInput, chip, chipOn, ModePicker } from "./form-bits";

/** Labels from the user's side of the loan. */
export function eventLabels(direction: "lent" | "borrowed") {
  return direction === "lent"
    ? {
        interest: "Interest received",
        principal: "Principal received",
        disbursement: "Gave more (top-up)",
        waiver: "Waive interest",
      }
    : {
        interest: "Interest paid",
        principal: "Principal repaid",
        disbursement: "Borrowed more",
        waiver: "Interest waived",
      };
}

const KINDS: LoanEventKind[] = [
  "interest",
  "principal",
  "disbursement",
  "waiver",
];

export function LoanEventSheet() {
  const state = useSheets((s) => s.event);
  const close = useSheets((s) => s.close);
  const save = useSaveLoanEvent();
  const del = useDeleteLoanEvent();
  const [kind, setKind] = useState<LoanEventKind>("interest");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [mode, setMode] = useState<PaymentMode>("upi");
  const [note, setNote] = useState("");
  const [last, setLast] = useState(state);
  if (state !== last) {
    setLast(state);
    if (state) {
      setKind(state.value.kind ?? "interest");
      setAmount(state.value.amount ? String(state.value.amount) : "");
      setDate(state.value.date ?? todayStr());
      setMode(state.value.mode ?? "upi");
      setNote(state.value.note ?? "");
    }
  }
  if (!state)
    return (
      <ResponsiveSheet open={false} onOpenChange={() => {}} title="Payment">
        {null}
      </ResponsiveSheet>
    );

  const labels = eventLabels(state.direction);
  const s = state.suggest;
  const quick =
    s && !state.id
      ? kind === "interest"
        ? [
            s.monthlyInterest > 0 && { l: "1 month", v: s.monthlyInterest },
            s.interestDue > 0 && { l: "All interest due", v: s.interestDue },
          ]
        : kind === "principal"
          ? [s.principalOut > 0 && { l: "Full principal", v: s.principalOut }]
          : kind === "waiver"
            ? [s.interestDue > 0 && { l: "All interest due", v: s.interestDue }]
            : []
      : [];

  return (
    <ResponsiveSheet
      open
      onOpenChange={(o) => !o && close("event")}
      title={state.id ? "Edit payment" : "Record payment"}
      description={state.title}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(
            {
              loanId: state.loanId,
              id: state.id,
              kind,
              amount: Number(amount),
              date,
              mode,
              note: note.trim() || null,
            },
            { onSuccess: () => close("event") },
          );
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(chip, kind === k ? chipOn : "hover:bg-muted")}
            >
              {labels[k]}
            </button>
          ))}
        </div>

        <Field label="Amount" htmlFor="event-amount" required>
          <AmountInput
            id="event-amount"
            autoFocus={!state.id}
            value={amount}
            onChange={setAmount}
          />
        </Field>
        {quick.some(Boolean) && (
          <div className="-mt-2 flex flex-wrap gap-1.5">
            {quick.map(
              (q) =>
                q && (
                  <button
                    key={q.l}
                    type="button"
                    onClick={() => setAmount(String(q.v))}
                    className="rounded-full border px-2.5 py-1 text-xs hover:bg-muted"
                  >
                    {q.l}: <b className="tabular">{money(q.v)}</b>
                  </button>
                ),
            )}
          </div>
        )}

        <Field label="Date" htmlFor="event-date" required>
          <Input
            id="event-date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-11"
          />
        </Field>

        {kind !== "waiver" && <ModePicker value={mode} onChange={setMode} />}

        <Field label="Note (optional)" htmlFor="event-note">
          <Textarea
            id="event-note"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Interest for September, paid to Shivam"
          />
        </Field>

        <div className="flex gap-2">
          {state.id && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              aria-label="Delete payment"
              className="text-destructive"
              onClick={async () => {
                if (
                  await confirm({
                    title: "Delete this payment?",
                    description: "Interest and balances are recalculated.",
                    confirmText: "Delete",
                    destructive: true,
                  })
                )
                  del.mutate(state.id!, { onSuccess: () => close("event") });
              }}
            >
              <Trash2 />
            </Button>
          )}
          <Button
            type="submit"
            size="lg"
            className="flex-1"
            disabled={save.isPending}
          >
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </ResponsiveSheet>
  );
}

import { interestSchedule } from "@api/lib/utils/interest";
import { ChevronDown, Info } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/common/field";
import { ResponsiveSheet } from "@/components/common/responsive-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type LoanTermsInput,
  useCreateLoan,
  useUpdateLoan,
} from "@/hooks/use-ledger";
import { money, type PaymentMode, todayStr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSheets } from "@/stores/sheets-store";
import {
  AmountInput,
  chip,
  chipOn,
  ModePicker,
  type PersonChoice,
  PersonPicker,
  person,
  resolvePerson,
} from "./form-bits";

type Form = {
  direction: "lent" | "borrowed";
  amount: string;
  date: string;
  mode: PaymentMode;
  title: string;
  interestType: "simple" | "none";
  ratePercent: string;
  ratePeriod: "month" | "year";
  basis: "months" | "days";
  interestDay: string;
  dueDate: string;
  collateral: string;
  note: string;
};

const blank = (): Form => ({
  direction: "lent",
  amount: "",
  date: todayStr(),
  mode: "cash",
  title: "",
  interestType: "simple",
  ratePercent: "1",
  ratePeriod: "month",
  basis: "months",
  interestDay: "",
  dueDate: "",
  collateral: "",
  note: "",
});

function Toggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            chip,
            "flex-1",
            value === o.value ? chipOn : "hover:bg-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** New loan (lent or borrowed) or edit an existing loan's terms. */
export function LoanSheet() {
  const state = useSheets((s) => s.loan);
  const close = useSheets((s) => s.close);
  const create = useCreateLoan();
  const update = useUpdateLoan();
  const [form, setForm] = useState<Form>(blank());
  const [who, setWho] = useState<PersonChoice>(person());
  const [via, setVia] = useState<PersonChoice>(person());
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(state);
  if (state !== last) {
    setLast(state);
    if (state?.mode === "new") {
      setForm({ ...blank(), direction: state.prefill.direction ?? "lent" });
      setWho(person(state.prefill.connectionId));
      setVia(person());
      setMore(false);
    } else if (state?.mode === "edit") {
      const v = state.value;
      setForm({
        ...blank(),
        direction: v.direction,
        title: v.title ?? "",
        interestType: v.interestType,
        ratePercent: String(v.ratePercent),
        ratePeriod: v.ratePeriod,
        basis: v.basis,
        interestDay: v.interestDay ? String(v.interestDay) : "",
        dueDate: v.dueDate ?? "",
        collateral: v.collateral ?? "",
        note: v.note ?? "",
      });
      setWho(person(v.connectionId));
      setVia(person(v.viaConnectionId));
      setMore(true);
    }
  }

  const editing = state?.mode === "edit" ? state : null;
  const lent = form.direction === "lent";
  const set = <K extends keyof Form>(k: K, v: Form[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const amount = Number(form.amount) || 0;
  const rate = Number(form.ratePercent) || 0;
  const preview =
    !editing && amount > 0 && form.interestType === "simple" && rate > 0
      ? interestSchedule({
          principal: amount,
          ratePercent: rate,
          ratePeriod: form.ratePeriod,
          basis: form.basis,
          from: form.date,
          to:
            form.dueDate && form.dueDate > form.date
              ? form.dueDate
              : `${Number(form.date.slice(0, 4)) + 1}${form.date.slice(4)}`,
        })
      : null;

  async function submit() {
    setBusy(true);
    try {
      const connectionId = await resolvePerson(who);
      if (!connectionId) return toast.error("Choose a person");
      const viaConnectionId = await resolvePerson(via);
      const terms: LoanTermsInput = {
        title: form.title.trim() || undefined,
        interestType: form.interestType,
        ratePercent: form.interestType === "none" ? 0 : rate,
        ratePeriod: form.ratePeriod,
        basis: form.basis,
        interestDay: form.interestDay ? Number(form.interestDay) : null,
        dueDate: form.dueDate || null,
        viaConnectionId,
        collateral: form.collateral.trim() || null,
        note: form.note.trim() || null,
      };
      if (editing)
        await update.mutateAsync({
          id: editing.id,
          ...terms,
          connectionId,
          direction: form.direction,
        });
      else
        await create.mutateAsync({
          ...terms,
          connectionId,
          direction: form.direction,
          amount,
          date: form.date,
          mode: form.mode,
        });
      close("loan");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResponsiveSheet
      open={!!state}
      onOpenChange={(o) => !o && close("loan")}
      title={editing ? "Edit loan" : "New loan"}
      description={
        editing
          ? "Changing the rate recalculates all interest from the start."
          : "Money lent or borrowed with (or without) interest."
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Toggle
          value={form.direction}
          onChange={(v) => set("direction", v)}
          options={[
            { value: "lent", label: "I lent money" },
            { value: "borrowed", label: "I borrowed money" },
          ]}
        />

        {!editing && (
          <Field label="Amount" htmlFor="loan-amount" required>
            <AmountInput
              id="loan-amount"
              autoFocus
              value={form.amount}
              onChange={(v) => set("amount", v)}
            />
          </Field>
        )}

        <PersonPicker
          label={lent ? "Lent to (borrower)" : "Borrowed from (lender)"}
          value={who}
          onChange={setWho}
          exclude={via.id}
        />

        {!editing && (
          <Field label="Date given" htmlFor="loan-date" required>
            <Input
              id="loan-date"
              type="date"
              required
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              className="h-11"
            />
          </Field>
        )}

        <div className="space-y-2 rounded-2xl border p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <Label>Interest</Label>
            <div className="flex gap-1 rounded-lg bg-muted p-0.5 text-xs">
              {(["simple", "none"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => set("interestType", v)}
                  className={cn(
                    "rounded-md px-2.5 py-1 font-medium",
                    form.interestType === v
                      ? "bg-card shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  {v === "simple" ? "Simple interest" : "No interest"}
                </button>
              ))}
            </div>
          </div>
          {form.interestType === "simple" && (
            <>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    aria-label="Interest rate"
                    value={form.ratePercent}
                    onChange={(e) => set("ratePercent", e.target.value)}
                    className="h-11 pr-8"
                  />
                  <span className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
                    %
                  </span>
                </div>
                <div className="flex gap-1 rounded-lg bg-muted p-1">
                  {(["month", "year"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => set("ratePeriod", p)}
                      className={cn(
                        "rounded-md px-3 text-sm font-medium",
                        form.ratePeriod === p
                          ? "bg-card shadow-sm"
                          : "text-muted-foreground",
                      )}
                    >
                      per {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
                {[
                  { r: "1", p: "month", l: "₹1 sainkda (1%/mo)" },
                  { r: "1.5", p: "month", l: "1.5%/mo" },
                  { r: "2", p: "month", l: "₹2 sainkda (2%/mo)" },
                  { r: "12", p: "year", l: "12% p.a." },
                ].map((q) => (
                  <button
                    key={q.l}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        ratePercent: q.r,
                        ratePeriod: q.p as "month" | "year",
                      }))
                    }
                    className="shrink-0 rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                  >
                    {q.l}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5 pt-1">
                <p className="text-xs font-medium text-muted-foreground">
                  How is time counted?
                </p>
                <Toggle
                  value={form.basis}
                  onChange={(v) => set("basis", v)}
                  options={[
                    { value: "months", label: "Completed months" },
                    { value: "days", label: "Every day" },
                  ]}
                />
                <p className="flex gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  {form.basis === "months"
                    ? 'Interest is added once a full month passes (like Excel DATEDIF "M" and most khatas).'
                    : "Interest grows daily, pro-rata (like banks)."}
                </p>
              </div>
              {preview && (
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-accent/60 p-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Every month</p>
                    <p className="tabular font-semibold">
                      {money(Math.round(preview.monthly))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {form.dueDate && form.dueDate > form.date
                        ? "Till due date"
                        : "In 1 year"}
                    </p>
                    <p className="tabular font-semibold">
                      {money(Math.round(preview.interest))}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <PersonPicker
          label="Money held by (optional)"
          optional="Nobody — it's my own money"
          value={via}
          onChange={setVia}
          exclude={who.id}
          hint={
            lent
              ? "Lent out of cash someone keeps for you? Their balance goes down by the loan and up with every repayment."
              : "Borrowed money went to someone who keeps cash for you? Their balance goes up."
          }
        />

        {!editing && (
          <ModePicker value={form.mode} onChange={(v) => set("mode", v)} />
        )}

        <button
          type="button"
          onClick={() => setMore((m) => !m)}
          className="flex w-full items-center justify-between rounded-xl px-1 py-1 text-sm font-medium text-primary"
        >
          Due date, interest day, security & notes
          <ChevronDown
            className={cn("size-4 transition-transform", more && "rotate-180")}
          />
        </button>
        {more && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Interest due on day"
                htmlFor="loan-day"
                hint="e.g. 15 = every 15th"
              >
                <Input
                  id="loan-day"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="31"
                  value={form.interestDay}
                  onChange={(e) => set("interestDay", e.target.value)}
                  placeholder="—"
                  className="h-11"
                />
              </Field>
              <Field label="Repay by (due date)" htmlFor="loan-due">
                <Input
                  id="loan-due"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => set("dueDate", e.target.value)}
                  className="h-11"
                />
              </Field>
            </div>
            <Field label="Title" htmlFor="loan-title">
              <Input
                id="loan-title"
                maxLength={80}
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder={lent ? "Loan to …" : "Loan from …"}
                className="h-11"
              />
            </Field>
            <Field label="Security / guarantee" htmlFor="loan-collateral">
              <Input
                id="loan-collateral"
                maxLength={500}
                value={form.collateral}
                onChange={(e) => set("collateral", e.target.value)}
                placeholder="e.g. Gold chain, cheque, witness: Piyush"
                className="h-11"
              />
            </Field>
            <Field label="Note" htmlFor="loan-note">
              <Textarea
                id="loan-note"
                rows={2}
                maxLength={500}
                value={form.note}
                onChange={(e) => set("note", e.target.value)}
                placeholder="e.g. Will receive ₹2,000 interest on the 15th"
              />
            </Field>
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Saving…" : editing ? "Save changes" : "Save loan"}
        </Button>
      </form>
    </ResponsiveSheet>
  );
}

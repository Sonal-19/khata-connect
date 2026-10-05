import { ArrowDownLeft, ArrowUpRight, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { confirm } from "@/components/common/confirm-dialog";
import { Field } from "@/components/common/field";
import { ResponsiveSheet } from "@/components/common/responsive-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  type EntryInput,
  useDeleteEntry,
  useSaveEntry,
} from "@/hooks/use-ledger";
import type { PaymentMode } from "@/lib/format";
import { todayStr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSheets } from "@/stores/sheets-store";
import {
  AmountInput,
  ModePicker,
  type PersonChoice,
  PersonPicker,
  person,
  resolvePerson,
} from "./form-bits";

type Form = {
  type: "gave" | "got";
  amount: string;
  date: string;
  reason: string;
  mode: PaymentMode;
  note: string;
};

const blank = (p: Partial<EntryInput> = {}): Form => ({
  type: p.type ?? "gave",
  amount: p.amount ? String(p.amount) : "",
  date: p.date ?? todayStr(),
  reason: p.reason ?? "",
  mode: p.mode ?? "cash",
  note: p.note ?? "",
});

const SUGGESTIONS = {
  gave: ["Cash given", "Kept with them", "Udhaar", "Paid for them"],
  got: ["Returned", "Paid on my behalf", "Part payment", "Cash received"],
};

/** "You gave" / "You got" — plain money with a person, no interest. */
export function EntrySheet() {
  const state = useSheets((s) => s.entry);
  const close = useSheets((s) => s.close);
  const save = useSaveEntry();
  const del = useDeleteEntry();
  const [form, setForm] = useState<Form>(blank());
  const [who, setWho] = useState<PersonChoice>(person());
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(state);
  if (state !== last) {
    setLast(state);
    if (state) {
      const v = state.mode === "edit" ? state.value : state.prefill;
      setForm(blank(v));
      setWho(person(v.connectionId));
    }
  }

  const editing = state?.mode === "edit" ? state : null;
  const gave = form.type === "gave";

  async function submit() {
    setBusy(true);
    try {
      const connectionId = await resolvePerson(who);
      if (!connectionId) return toast.error("Choose a person");
      await save.mutateAsync({
        id: editing?.id,
        connectionId,
        type: form.type,
        amount: Number(form.amount),
        date: form.date,
        reason: form.reason.trim() || (gave ? "Cash given" : "Cash received"),
        mode: form.mode,
        note: form.note.trim() || null,
      });
      close("entry");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResponsiveSheet
      open={!!state}
      onOpenChange={(o) => !o && close("entry")}
      title={editing ? "Edit entry" : gave ? "You gave" : "You got"}
      description="Money handed over or received, without interest. For loans with interest use New loan."
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
          {(
            [
              {
                v: "gave",
                label: "You gave",
                sub: "Money went to them",
                icon: ArrowUpRight,
                on: "bg-gave text-white",
              },
              {
                v: "got",
                label: "You got",
                sub: "Money came back to you",
                icon: ArrowDownLeft,
                on: "bg-got text-white dark:text-background",
              },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setForm({ ...form, type: o.v })}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-all",
                form.type === o.v
                  ? `${o.on} shadow-sm`
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <o.icon className="size-5 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{o.label}</span>
                <span className="block truncate text-[11px] opacity-80">
                  {o.sub}
                </span>
              </span>
            </button>
          ))}
        </div>

        <Field label="Amount" htmlFor="entry-amount" required>
          <AmountInput
            id="entry-amount"
            autoFocus={!editing}
            value={form.amount}
            onChange={(amount) => setForm({ ...form, amount })}
            className={gave ? "text-gave" : "text-got"}
          />
        </Field>

        <PersonPicker
          label={gave ? "Given to" : "Received from"}
          value={who}
          onChange={setWho}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date" htmlFor="entry-date" required>
            <Input
              id="entry-date"
              type="date"
              required
              max="2100-12-31"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="h-11"
            />
          </Field>
          <Field label="Reason" htmlFor="entry-reason">
            <Input
              id="entry-reason"
              maxLength={120}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder={gave ? "e.g. Cash kept with him" : "e.g. Returned"}
              className="h-11"
            />
          </Field>
        </div>
        {!form.reason && (
          <div className="no-scrollbar -mt-2 flex gap-1.5 overflow-x-auto">
            {SUGGESTIONS[form.type].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setForm({ ...form, reason: s })}
                className="shrink-0 rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <ModePicker
          value={form.mode}
          onChange={(mode) => setForm({ ...form, mode })}
        />

        <Field label="Note (optional)" htmlFor="entry-note">
          <Textarea
            id="entry-note"
            rows={2}
            maxLength={500}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Anything to remember — notes, who was there, where it was deposited…"
          />
        </Field>

        <div className="flex gap-2 pt-1">
          {editing && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              aria-label="Delete entry"
              className="text-destructive"
              onClick={async () => {
                if (
                  await confirm({
                    title: "Delete this entry?",
                    description: "You can undo right after deleting.",
                    confirmText: "Delete",
                    destructive: true,
                  })
                ) {
                  del.mutate(editing.id);
                  close("entry");
                }
              }}
            >
              <Trash2 />
            </Button>
          )}
          <Button type="submit" size="lg" className="flex-1" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Save entry"}
          </Button>
        </div>
      </form>
    </ResponsiveSheet>
  );
}

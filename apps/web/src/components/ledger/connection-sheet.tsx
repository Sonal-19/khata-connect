import { useState } from "react";
import { Field } from "@/components/common/field";
import { ResponsiveSheet } from "@/components/common/responsive-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type ConnectionInput, useSaveConnection } from "@/hooks/use-ledger";
import { RELATIONS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSheets } from "@/stores/sheets-store";
import { chip, chipOn } from "./form-bits";

const blank: ConnectionInput = {
  name: "",
  phone: "",
  email: "",
  relation: "friend",
  note: "",
};

/** Add / edit a person (no account needed on their side). */
export function ConnectionSheet() {
  const value = useSheets((s) => s.connection);
  const onSaved = useSheets((s) => s.onConnectionSaved);
  const close = useSheets((s) => s.close);
  const save = useSaveConnection();
  const [form, setForm] = useState<ConnectionInput>(blank);
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    if (value) setForm({ ...blank, ...value });
  }

  return (
    <ResponsiveSheet
      open={!!value}
      onOpenChange={(o) => !o && close("connection")}
      title={value?.id ? "Edit person" : "Add person"}
      description="Family, friends, shopkeepers — anyone you give money to, take from, or who keeps cash for you."
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(
            {
              id: value?.id,
              name: form.name,
              relation: form.relation,
              phone: form.phone?.trim() || null,
              email: form.email?.trim() || null,
              note: form.note?.trim() || null,
            },
            {
              onSuccess: ({ data }) => {
                if (data && !value?.id)
                  onSaved?.({ id: data.id, name: data.name });
                close("connection");
              },
            },
          );
        }}
      >
        <Field label="Name" htmlFor="conn-name" required>
          <Input
            id="conn-name"
            required
            maxLength={80}
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Shivam"
            className="h-11"
          />
        </Field>
        <div className="space-y-2">
          <Label>Relation</Label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {RELATIONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setForm({ ...form, relation: r.value })}
                className={cn(
                  chip,
                  "flex-col gap-0.5 px-2 py-2 text-xs",
                  form.relation === r.value ? chipOn : "hover:bg-muted",
                )}
              >
                <span className="text-lg leading-none">{r.emoji}</span>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Phone"
            htmlFor="conn-phone"
            hint="For WhatsApp reminders"
          >
            <Input
              id="conn-phone"
              type="tel"
              inputMode="tel"
              maxLength={20}
              value={form.phone ?? ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="98765 43210"
              className="h-11"
            />
          </Field>
          <Field label="Email" htmlFor="conn-email">
            <Input
              id="conn-email"
              type="email"
              maxLength={254}
              value={form.email ?? ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="optional"
              className="h-11"
            />
          </Field>
        </div>
        <Field label="Note" htmlFor="conn-note">
          <Textarea
            id="conn-note"
            rows={2}
            maxLength={500}
            value={form.note ?? ""}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="e.g. Keeps the family cash, deposits in HDFC"
          />
        </Field>
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={save.isPending}
        >
          {save.isPending
            ? "Saving…"
            : value?.id
              ? "Save changes"
              : "Add person"}
        </Button>
      </form>
    </ResponsiveSheet>
  );
}

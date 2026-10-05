import { IndianRupee } from "lucide-react";
import type * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConnections } from "@/hooks/use-ledger";
import { api, call } from "@/lib/api";
import { MODES, money, type PaymentMode } from "@/lib/format";
import { cn } from "@/lib/utils";

export const chip =
  "flex shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors";
export const chipOn = "border-primary bg-accent text-accent-foreground";

/** Big ₹ amount field. */
export function AmountInput({
  id,
  value,
  onChange,
  autoFocus,
  className,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <div className="relative">
      <IndianRupee className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0.01"
        required
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className={cn(
          "tabular h-14 pl-10 text-2xl font-bold md:text-2xl",
          className,
        )}
      />
    </div>
  );
}

export function ModePicker({
  value,
  onChange,
}: {
  value: PaymentMode;
  onChange: (m: PaymentMode) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Paid by</Label>
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(m.value)}
            className={cn(chip, value === m.value ? chipOn : "hover:bg-muted")}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export const NEW_PERSON = "new";

/** An existing person (id) or a new name to create on save. */
export type PersonChoice = {
  id: number | null;
  newName: string;
  creating: boolean;
};
export const person = (id?: number | null): PersonChoice => ({
  id: id ?? null,
  newName: "",
  creating: false,
});

export function PersonPicker({
  label,
  value,
  onChange,
  exclude,
  optional,
  hint,
}: {
  label: string;
  value: PersonChoice;
  onChange: (v: PersonChoice) => void;
  exclude?: number | null;
  /** Allows "nobody" (id null, no new name). */
  optional?: string;
  hint?: React.ReactNode;
}) {
  const { data } = useConnections();
  const people = (data?.connections ?? []).filter((c) => c.id !== exclude);
  const creating = value.creating || (!people.length && !optional);
  const selectValue = creating
    ? NEW_PERSON
    : value.id !== null
      ? String(value.id)
      : optional
        ? "none"
        : "";
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <Select
        value={selectValue}
        onValueChange={(v) =>
          onChange(
            v === NEW_PERSON
              ? { id: null, newName: value.newName, creating: true }
              : v === "none"
                ? person(null)
                : person(Number(v)),
          )
        }
      >
        <SelectTrigger className="h-11 w-full">
          <SelectValue placeholder="Choose a person" />
        </SelectTrigger>
        <SelectContent>
          {optional && <SelectItem value="none">{optional}</SelectItem>}
          {people.map((c) => (
            <SelectItem key={c.id} value={String(c.id)}>
              <span className="truncate">{c.name}</span>
              {c.summary.net !== 0 && (
                <span
                  className={cn(
                    "tabular ml-auto pl-3 text-xs",
                    c.summary.net > 0 ? "text-got" : "text-gave",
                  )}
                >
                  {money(Math.abs(c.summary.net))}
                </span>
              )}
            </SelectItem>
          ))}
          {(people.length > 0 || optional) && <SelectSeparator />}
          <SelectItem value={NEW_PERSON}>＋ Add a new person…</SelectItem>
        </SelectContent>
      </Select>
      {creating && (
        <Input
          required
          autoFocus={value.creating}
          maxLength={80}
          value={value.newName}
          onChange={(e) =>
            onChange({ id: null, newName: e.target.value, creating: true })
          }
          placeholder="New person's name, e.g. Sourav"
          className="h-11"
        />
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Creates the person first when a new name was typed. Returns the id (or null). */
export async function resolvePerson(p: PersonChoice) {
  if (p.id !== null) return p.id;
  const name = p.newName.trim();
  if (!name) return null;
  const created = await call(
    api.connections.post({ name, relation: "friend" }),
  );
  return created.id;
}

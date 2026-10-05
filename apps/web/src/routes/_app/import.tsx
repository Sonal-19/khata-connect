import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, FileSpreadsheet, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { SectionCard } from "@/components/app/section-card";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { Segmented } from "@/components/common/segmented";
import {
  type PersonChoice,
  PersonPicker,
  person,
} from "@/components/ledger/form-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConnections, useImport } from "@/hooks/use-ledger";
import { money, shortDate, todayStr } from "@/lib/format";
import {
  buildImport,
  COLUMN_FIELDS,
  type ColumnMap,
  findHeaderRow,
  guessColumns,
  parseRows,
} from "@/lib/import-mapping";
import { cn } from "@/lib/utils";
import { readSpreadsheet, type Sheet } from "@/lib/xlsx";

export const Route = createFileRoute("/_app/import")({
  component: ImportPage,
});

const colName = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

const toRef = (p: PersonChoice) =>
  p.id !== null
    ? { id: p.id }
    : p.newName.trim()
      ? { name: p.newName.trim() }
      : null;

function ImportPage() {
  const navigate = useNavigate();
  const doImport = useImport();
  const { data: people } = useConnections();
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [map, setMap] = useState<ColumnMap | null>(null);
  const [positiveIsGave, setPositiveIsGave] = useState(true);
  const [holder, setHolder] = useState<PersonChoice>({
    ...person(),
    creating: true,
  });
  const [borrower, setBorrower] = useState<PersonChoice>({
    ...person(),
    creating: true,
  });
  const [ratePeriod, setRatePeriod] = useState<"month" | "year">("month");
  const [basis, setBasis] = useState<"months" | "days">("months");
  const [loanTitle, setLoanTitle] = useState("");

  const sheet = sheets[sheetIdx];
  const headerRow = sheet ? findHeaderRow(sheet.rows) : 0;
  const header = sheet?.rows[headerRow] ?? [];
  const width = Math.max(0, ...(sheet?.rows.map((r) => r.length) ?? [0]));

  const selectSheet = (i: number, list = sheets) => {
    setSheetIdx(i);
    const s = list[i];
    if (s) setMap(guessColumns(s.rows[findHeaderRow(s.rows)] ?? []));
  };

  const parsed = useMemo(
    () => (sheet && map ? parseRows(sheet.rows, headerRow, map) : null),
    [sheet, map, headerRow],
  );
  const hasInterest = !!parsed?.rows.some((r) => r.interest);
  const holderRef = toRef(holder);
  const borrowerRef = hasInterest ? toRef(borrower) : null;
  const borrowerName =
    borrower.id !== null
      ? (people?.connections.find((c) => c.id === borrower.id)?.name ??
        "borrower")
      : borrower.newName.trim() || "borrower";
  const built =
    parsed && holderRef
      ? buildImport(parsed.rows, {
          holder: holderRef,
          borrower: borrowerRef,
          positiveIsGave,
          ratePeriod,
          basis,
          defaultRate: 1,
          loanTitle: loanTitle.trim() || `Loan to ${borrowerName}`,
          today: todayStr(),
        })
      : null;

  async function onFile(f: File | undefined) {
    if (!f) return;
    try {
      const list = (await readSpreadsheet(f)).filter((s) => s.rows.length > 1);
      if (!list.length) return toast.error("No rows found in this file");
      setSheets(list);
      setFileName(f.name);
      selectSheet(0, list);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const missing = !map || map.date < 0 || map.amount < 0;
  const canImport =
    !!built &&
    !missing &&
    !!holderRef &&
    built.payload.entries.length + built.payload.loans.length > 0;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Import from Excel"
        description="Bring in a khata sheet you already keep — one sheet per person who holds or owes the money."
      />

      <div className="space-y-4">
        <label
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-card p-6 text-center transition-colors hover:bg-muted/60 sm:p-8",
            fileName && "border-primary/40",
          )}
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
            {fileName ? (
              <FileSpreadsheet className="size-6" />
            ) : (
              <Upload className="size-6" />
            )}
          </span>
          <span className="font-semibold">
            {fileName || "Choose an .xlsx or .csv file"}
          </span>
          <span className="text-xs text-muted-foreground">
            Needs at least a Date and an Amount column. The file is read on your
            device.
          </span>
          <input
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>

        {sheet && map && (
          <>
            {sheets.length > 1 && (
              <SectionCard title="1 · Sheet">
                <Segmented
                  value={String(sheetIdx)}
                  onChange={(v) => selectSheet(Number(v))}
                  options={sheets.map((s, i) => ({
                    value: String(i),
                    label: `${s.name} (${s.rows.length - 1})`,
                  }))}
                />
              </SectionCard>
            )}

            <SectionCard title={`${sheets.length > 1 ? 2 : 1} · Columns`}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {COLUMN_FIELDS.map((f) => (
                  <Field key={f.key} label={f.label} required={f.required}>
                    <Select
                      value={String(map[f.key])}
                      onValueChange={(v) =>
                        setMap({ ...map, [f.key]: Number(v) })
                      }
                    >
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="-1">— Not in my sheet —</SelectItem>
                        {Array.from({ length: width }, (_, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {colName(i)}
                            {header[i] !== null && header[i] !== undefined
                              ? ` · ${String(header[i])}`
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                ))}
              </div>
              <div className="mt-4 space-y-1.5">
                <p className="text-sm font-medium">A positive amount means…</p>
                <Segmented
                  value={positiveIsGave ? "gave" : "got"}
                  onChange={(v) => setPositiveIsGave(v === "gave")}
                  options={[
                    { value: "gave", label: "I gave money to them" },
                    { value: "got", label: "I got money from them" },
                  ]}
                />
              </div>
            </SectionCard>

            <SectionCard title={`${sheets.length > 1 ? 3 : 2} · People`}>
              <div className="grid gap-4 md:grid-cols-2">
                <PersonPicker
                  label="Whose sheet is this?"
                  value={holder}
                  onChange={setHolder}
                  exclude={borrower.id}
                  hint="The person who holds this money / you exchanged it with."
                />
                {hasInterest && (
                  <PersonPicker
                    label="Interest rows were lent to"
                    value={borrower}
                    onChange={setBorrower}
                    exclude={holder.id}
                    hint="Rows with Interest = yes become one loan, paid out of the holder's money."
                  />
                )}
              </div>
              {hasInterest && (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Field label="Rate column is">
                    <Segmented
                      value={ratePeriod}
                      onChange={setRatePeriod}
                      size="sm"
                      className="w-full"
                      options={[
                        { value: "month", label: "per month" },
                        { value: "year", label: "per year" },
                      ]}
                    />
                  </Field>
                  <Field label="Count time by">
                    <Segmented
                      value={basis}
                      onChange={setBasis}
                      size="sm"
                      className="w-full"
                      options={[
                        { value: "months", label: "Full months" },
                        { value: "days", label: "Days" },
                      ]}
                    />
                  </Field>
                  <Field label="Loan title" htmlFor="imp-title">
                    <Input
                      id="imp-title"
                      maxLength={80}
                      value={loanTitle}
                      onChange={(e) => setLoanTitle(e.target.value)}
                      placeholder="Loan to …"
                      className="h-10"
                    />
                  </Field>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Preview">
              {missing ? (
                <p className="text-sm text-destructive">
                  Choose the Date and Amount columns.
                </p>
              ) : !built ? (
                <p className="text-sm text-muted-foreground">
                  Choose whose sheet this is to see the totals.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ["Plain entries", String(built.preview.entries)],
                      ["Holder's balance", money(built.preview.holderBalance)],
                      ...(built.payload.loans.length
                        ? [
                            [
                              "Loan principal",
                              money(built.preview.principalOut),
                            ],
                            [
                              `Interest @ ${+built.preview.ratePercent.toFixed(4)}%/${ratePeriod === "month" ? "mo" : "yr"}`,
                              money(Math.round(built.preview.interestDue)),
                            ],
                          ]
                        : []),
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-xl bg-muted/60 p-3">
                        <p className="text-xs text-muted-foreground">{k}</p>
                        <p className="tabular font-bold">{v}</p>
                      </div>
                    ))}
                  </div>
                  {built.payload.loans.length > 0 && (
                    <p className="mt-3 text-sm">
                      Net value with interest:{" "}
                      <b className="tabular">
                        {money(Math.round(built.preview.net))}
                      </b>{" "}
                      <span className="text-muted-foreground">
                        — compare with your sheet's total.
                      </span>
                    </p>
                  )}
                  {built.preview.interestRowsWithoutBorrower > 0 && (
                    <p className="mt-3 flex gap-2 rounded-xl bg-warning/10 p-3 text-sm text-warning">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                      {built.preview.interestRowsWithoutBorrower} interest
                      row(s) will be imported as plain entries until you choose
                      who they were lent to.
                    </p>
                  )}
                  {parsed && parsed.skipped.length > 0 && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Skipped rows:{" "}
                      {parsed.skipped
                        .map((s) => `${s.line} (${s.reason.toLowerCase()})`)
                        .join(", ")}
                    </p>
                  )}

                  <div className="mt-4 overflow-x-auto rounded-xl border">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead className="bg-muted/70 text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">
                            Row
                          </th>
                          <th className="px-3 py-2 text-left font-medium">
                            Date
                          </th>
                          <th className="px-3 py-2 text-left font-medium">
                            Details
                          </th>
                          <th className="px-3 py-2 text-left font-medium">
                            Becomes
                          </th>
                          <th className="px-3 py-2 text-right font-medium">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {parsed?.rows.slice(0, 50).map((r) => {
                          const plus = positiveIsGave
                            ? r.amount > 0
                            : r.amount < 0;
                          const asLoan = r.interest && !!borrowerRef;
                          return (
                            <tr key={r.line}>
                              <td className="px-3 py-2 text-muted-foreground">
                                {r.line}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {shortDate(r.date)}
                              </td>
                              <td className="max-w-56 truncate px-3 py-2">
                                {r.reason || "—"}
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                    asLoan
                                      ? "bg-gold/15 text-gold"
                                      : plus
                                        ? "bg-gave/12 text-gave"
                                        : "bg-got/12 text-got",
                                  )}
                                >
                                  {asLoan
                                    ? plus
                                      ? "Loan repaid"
                                      : "Loan paid out"
                                    : plus
                                      ? "You gave"
                                      : "You got"}
                                </span>
                              </td>
                              <td className="tabular px-3 py-2 text-right">
                                {money(Math.abs(r.amount))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {(parsed?.rows.length ?? 0) > 50 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Showing 50 of {parsed?.rows.length} rows.
                    </p>
                  )}
                </>
              )}
            </SectionCard>

            <div className="sticky bottom-20 z-10 md:bottom-4">
              <Button
                size="lg"
                className="w-full shadow-lg shadow-primary/25"
                disabled={!canImport || doImport.isPending}
                onClick={() =>
                  built &&
                  doImport.mutate(built.payload, {
                    onSuccess: ({ data }) =>
                      navigate({
                        to: "/connections/$connectionId",
                        params: { connectionId: String(data.holderId) },
                      }),
                  })
                }
              >
                {doImport.isPending
                  ? "Importing…"
                  : built
                    ? `Import ${built.preview.entries} entries${built.payload.loans.length ? " + 1 loan" : ""}`
                    : "Import"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import {
  addMonths,
  type InterestBasis,
  interestSchedule,
  type RatePeriod,
} from "@api/lib/utils/interest";
import { useMemo, useState } from "react";
import { Field } from "@/components/common/field";
import { Input } from "@/components/ui/input";
import { money, shortDate, todayStr } from "@/lib/format";
import { cn } from "@/lib/utils";

function Pills<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex rounded-xl bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold whitespace-nowrap transition-all sm:text-sm",
            value === o.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Simple-interest calculator using the exact maths the app uses for loans.
 * `full` adds the month-by-month table (in-app page).
 */
export function InterestCalculator({ full = false }: { full?: boolean }) {
  const [principal, setPrincipal] = useState("200000");
  const [rate, setRate] = useState("1");
  const [period, setPeriod] = useState<RatePeriod>("month");
  const [basis, setBasis] = useState<InterestBasis>("months");
  const [from, setFrom] = useState(() => addMonths(todayStr(), -12));
  const [to, setTo] = useState(todayStr);

  const p = Math.max(0, Number(principal) || 0);
  const r = Math.max(0, Number(rate) || 0);
  const res = useMemo(
    () =>
      to > from
        ? interestSchedule({
            principal: p,
            ratePercent: r,
            ratePeriod: period,
            basis,
            from,
            to,
          })
        : null,
    [p, r, period, basis, from, to],
  );
  const share = res && res.total > 0 ? (p / res.total) * 100 : 100;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr] lg:gap-8">
      <div className="space-y-4">
        <Field label="Amount (₹)" htmlFor="calc-p">
          <Input
            id="calc-p"
            type="number"
            inputMode="decimal"
            min="0"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            className="tabular h-12 text-lg font-semibold"
          />
        </Field>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
          <Field label="Interest rate (%)" htmlFor="calc-r">
            <Input
              id="calc-r"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="tabular h-11"
            />
          </Field>
          <div className="w-40 sm:w-48">
            <Pills
              value={period}
              onChange={setPeriod}
              options={[
                { value: "month", label: "per month" },
                { value: "year", label: "per year" },
              ]}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From" htmlFor="calc-from">
            <Input
              id="calc-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-11"
            />
          </Field>
          <Field label="To" htmlFor="calc-to">
            <Input
              id="calc-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-11"
            />
          </Field>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Count time by</p>
          <Pills
            value={basis}
            onChange={setBasis}
            options={[
              { value: "months", label: "Completed months" },
              { value: "days", label: "Every day" },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border bg-gradient-to-br from-accent/70 via-card to-card p-4 sm:p-5">
        {res ? (
          <>
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Interest (
                {basis === "months"
                  ? `${res.months} months`
                  : `${res.days} days`}
                )
              </p>
              <p className="tabular mt-1 text-3xl font-extrabold text-primary sm:text-4xl">
                {money(Math.round(res.interest))}
              </p>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-chart-interest/80">
              <div
                className="h-full rounded-full bg-chart-held transition-all duration-500"
                style={{ width: `${share}%` }}
              />
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-2 rounded-full bg-chart-held" /> Amount
                </dt>
                <dd className="tabular font-semibold">{money(p)}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-2 rounded-full bg-chart-interest" />{" "}
                  Total to return
                </dt>
                <dd className="tabular font-semibold">
                  {money(Math.round(res.total))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Every month</dt>
                <dd className="tabular font-semibold">
                  {money(Math.round(res.monthly))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Yearly rate</dt>
                <dd className="tabular font-semibold">
                  {+res.yearlyPercent.toFixed(2)}% p.a.
                </dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">
              {period === "month"
                ? `"₹${r} sainkda" = ₹${r} interest on every ₹100, every month.`
                : `${r}% a year = ${+(r / 12).toFixed(3)}% a month.`}{" "}
              {basis === "months"
                ? "Only completed months are counted."
                : "Counted daily on a 365-day year."}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Pick a "To" date after the "From" date.
          </p>
        )}
      </div>

      {full && res && res.rows.length > 0 && (
        <div className="overflow-hidden rounded-2xl border bg-card lg:col-span-2">
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">#</th>
                  <th className="px-4 py-2 text-left font-medium">
                    Month ending
                  </th>
                  <th className="px-4 py-2 text-right font-medium">Interest</th>
                  <th className="px-4 py-2 text-right font-medium">
                    Total interest
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {res.rows.map((row, i) => (
                  <tr key={row.date}>
                    <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2">{shortDate(row.date)}</td>
                    <td className="tabular px-4 py-2 text-right">
                      {money(Math.round(row.interest))}
                    </td>
                    <td className="tabular px-4 py-2 text-right font-medium">
                      {money(Math.round(row.cumulative))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Dashboard } from "@/hooks/use-ledger";
import { money, moneyShort, monthLabel, shortDate } from "@/lib/format";

const SERIES = [
  { key: "held", label: "Held by people", color: "var(--chart-held)" },
  { key: "loans", label: "Loan principal", color: "var(--chart-loans)" },
  { key: "interest", label: "Interest due", color: "var(--chart-interest)" },
] as const;

/** Stacked month-end balances with the net position as a line. */
export function NetChart({ data }: { data: Dashboard["chart"] }) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm"
              style={{ background: s.color }}
            />
            {s.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded bg-foreground" /> Net
        </span>
      </div>
      <div className="h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ left: 0, right: 4, top: 4, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="date"
              tickFormatter={monthLabel}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              minTickGap={18}
            />
            <YAxis
              tickFormatter={(v: number) => moneyShort(v)}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={58}
            />
            <Tooltip
              cursor={{ stroke: "var(--border)" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="rounded-xl border bg-popover px-3 py-2 text-xs shadow-lg">
                    <p className="mb-1 font-semibold">
                      {shortDate(String(label))}
                    </p>
                    {payload.map((p) => (
                      <p
                        key={String(p.dataKey)}
                        className="flex justify-between gap-4"
                      >
                        <span className="text-muted-foreground">
                          {SERIES.find((s) => s.key === p.dataKey)?.label ??
                            "Net"}
                        </span>
                        <span className="tabular font-medium">
                          {money(Number(p.value))}
                        </span>
                      </p>
                    ))}
                  </div>
                ) : null
              }
            />
            {SERIES.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stackId="1"
                stroke={s.color}
                fill={s.color}
                fillOpacity={0.35}
                strokeWidth={1.5}
              />
            ))}
            <Line
              type="monotone"
              dataKey="net"
              stroke="var(--foreground)"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

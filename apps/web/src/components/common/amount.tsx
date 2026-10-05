import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Signed amount: + (teal) when the balance moves in your favour,
 * − (orange) when it moves against you. Never colour alone.
 */
export function Amount({
  value,
  className,
  plain,
}: {
  value: number;
  className?: string;
  /** No sign, neutral colour. */
  plain?: boolean;
}) {
  return (
    <span
      className={cn(
        "tabular whitespace-nowrap",
        !plain && value > 0 && "text-got",
        !plain && value < 0 && "text-gave",
        className,
      )}
    >
      {!plain && value > 0 ? "+" : !plain && value < 0 ? "−" : ""}
      {money(Math.abs(value))}
    </span>
  );
}

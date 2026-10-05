import { cn } from "@/lib/utils";

/** Small count bubble (e.g. pending invites). Renders nothing for 0. */
export function CountBadge({
  n,
  className,
}: {
  n: number;
  className?: string;
}) {
  if (!n) return null;
  return (
    <span
      className={cn(
        "grid h-5 min-w-5 place-items-center rounded-full bg-gave px-1 text-[10px] font-bold text-white",
        className,
      )}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}

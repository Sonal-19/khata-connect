import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  withText = true,
}: {
  className?: string;
  withText?: boolean;
}) {
  const [first, ...rest] = BRAND.name.split(" ");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-bold tracking-tight select-none",
        className,
      )}
    >
      <img
        src="/favicon.svg"
        alt=""
        className="size-7 shrink-0 rounded-lg sm:size-8"
      />
      {withText && (
        <span className="whitespace-nowrap text-base sm:text-lg">
          {first} <span className="text-primary">{rest.join(" ")}</span>
        </span>
      )}
    </span>
  );
}

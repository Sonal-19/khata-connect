import { useQuery } from "@tanstack/react-query";
import { AtSign, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { useDebounced } from "@/hooks/use-debounced";
import { api, call } from "@/lib/api";
import { cn } from "@/lib/utils";

export const USERNAME_RE = /^[a-z0-9_.]{3,16}$/;
/** Lowercase, strip @ and anything not allowed. */
export const cleanUsername = (v: string) =>
  v
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9_.]/g, "")
    .slice(0, 16);

export type UsernameState = "idle" | "checking" | "ok" | "bad";

/**
 * @username field with live availability. `unchanged` skips the check (e.g.
 * your current username in Settings); `allowReserved` lets admins assign
 * reserved names.
 */
export function UsernameInput({
  id,
  value,
  onChange,
  onState,
  unchanged,
  allowReserved,
  className,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onState?: (s: UsernameState) => void;
  unchanged?: string;
  allowReserved?: boolean;
  className?: string;
}) {
  const debounced = useDebounced(value);
  const valid = USERNAME_RE.test(value);
  const skip = !valid || value === unchanged;
  const q = useQuery({
    queryKey: ["username-available", debounced],
    queryFn: () =>
      call(
        api.auth["username-available"].get({ query: { username: debounced } }),
      ),
    enabled: USERNAME_RE.test(debounced) && debounced !== unchanged,
    staleTime: 10_000,
    retry: false,
  });

  const reserved = q.data?.reason === "This username is reserved";
  const state: UsernameState = !value
    ? "idle"
    : !valid
      ? "bad"
      : skip
        ? "ok"
        : debounced !== value || q.isFetching
          ? "checking"
          : q.data?.available || (allowReserved && reserved)
            ? "ok"
            : q.data
              ? "bad"
              : "checking";
  useEffect(() => onState?.(state), [state, onState]);

  const message = !value
    ? "3–16 letters, numbers, _ or . — people use it to find you."
    : !valid
      ? value.length < 3
        ? "At least 3 characters"
        : "Only letters, numbers, _ and ."
      : state === "checking"
        ? "Checking…"
        : state === "ok"
          ? value === unchanged
            ? "This is your username"
            : `@${value} is available`
          : (q.data?.reason ?? "Not available");

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <AtSign className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          required
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          minLength={3}
          maxLength={16}
          value={value}
          onChange={(e) => onChange(cleanUsername(e.target.value))}
          placeholder="e.g. sonal_02"
          aria-invalid={state === "bad"}
          className={cn("h-11 pr-9 pl-9", className)}
        />
        <span className="absolute top-1/2 right-3 -translate-y-1/2">
          {state === "checking" && (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          )}
          {state === "ok" && <CheckCircle2 className="size-4 text-got" />}
          {state === "bad" && <XCircle className="size-4 text-destructive" />}
        </span>
      </div>
      <p
        className={cn(
          "text-xs",
          state === "bad"
            ? "text-destructive"
            : state === "ok"
              ? "text-got"
              : "text-muted-foreground",
        )}
      >
        {message}
      </p>
    </div>
  );
}

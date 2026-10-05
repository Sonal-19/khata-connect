import { useQuery } from "@tanstack/react-query";
import { AtSign, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import { useState } from "react";
import { Field } from "@/components/common/field";
import { PersonAvatar } from "@/components/common/person-avatar";
import { ResponsiveSheet } from "@/components/common/responsive-sheet";
import { cleanUsername, USERNAME_RE } from "@/components/common/username-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounced } from "@/hooks/use-debounced";
import { lookupUser, useLinkConnection } from "@/hooks/use-shared";
import { BRAND } from "@/lib/brand";

/** Tag a person in your book with their Khata Connect @username. */
export function LinkSheet({
  connection,
  onClose,
}: {
  connection: { id: number; name: string } | null;
  onClose: () => void;
}) {
  const [username, setUsername] = useState("");
  const [last, setLast] = useState(connection);
  if (connection !== last) {
    setLast(connection);
    setUsername("");
  }
  const debounced = useDebounced(username);
  const valid = USERNAME_RE.test(debounced);
  const found = useQuery({
    queryKey: ["user-lookup", debounced],
    queryFn: () => lookupUser(debounced),
    enabled: valid,
    retry: false,
    staleTime: 30_000,
  });
  const link = useLinkConnection();
  const ready = valid && debounced === username && !!found.data;
  const first = connection?.name.split(" ")[0] ?? "them";

  return (
    <ResponsiveSheet
      open={!!connection}
      onOpenChange={(o) => !o && onClose()}
      title={`Link ${connection?.name ?? ""} to ${BRAND.name}`}
      description={`If ${first} uses ${BRAND.name}, tag their @username. After they accept, they see this ledger from their side.`}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (connection && ready)
            link.mutate(
              { id: connection.id, username: debounced },
              { onSuccess: onClose },
            );
        }}
      >
        <Field label="Their username" htmlFor="link-username">
          <div className="relative">
            <AtSign className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="link-username"
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={17}
              value={username}
              onChange={(e) => setUsername(cleanUsername(e.target.value))}
              placeholder="username"
              className="h-11 pl-9"
            />
          </div>
        </Field>

        <div className="min-h-16 rounded-2xl border bg-muted/40 p-3">
          {!username ? (
            <p className="flex gap-2 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" /> Only people who
              already have a {BRAND.name} account can be tagged.
            </p>
          ) : !USERNAME_RE.test(username) ? (
            <p className="text-sm text-muted-foreground">
              Usernames are 3–16 letters, numbers, _ or .
            </p>
          ) : debounced !== username || found.isFetching ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Looking up @{username}
              …
            </p>
          ) : found.data ? (
            <div className="flex items-center gap-3">
              <PersonAvatar name={found.data.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{found.data.name}</p>
                <p className="text-sm text-muted-foreground">
                  @{found.data.username}
                </p>
              </div>
              <CheckCircle2 className="size-5 text-got" />
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <XCircle className="size-4" />
              {(found.error as Error)?.message ?? "No user found"}
            </p>
          )}
        </div>

        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>• They can only view — you stay the only one who edits.</li>
          <li>
            • Your “you gave” shows as “you got” on their side, and vice versa.
          </li>
          <li>• You or they can remove the link at any time.</li>
        </ul>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!ready || link.isPending}
        >
          {link.isPending ? "Sending…" : "Send invite"}
        </Button>
      </form>
    </ResponsiveSheet>
  );
}

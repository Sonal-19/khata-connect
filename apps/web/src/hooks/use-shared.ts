import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, call, callMsg } from "@/lib/api";
import { useInvalidateBook } from "./use-ledger";

export const useShared = () =>
  useQuery({ queryKey: ["shared"], queryFn: () => call(api.shared.get()) });
export type SharedOverview = NonNullable<ReturnType<typeof useShared>["data"]>;
export type SharedItem = SharedOverview["shared"][number];

export const useSharedLedger = (id: number) =>
  useQuery({
    queryKey: ["shared", id],
    queryFn: () => call(api.shared({ id }).get()),
  });
export type SharedLedger = NonNullable<
  ReturnType<typeof useSharedLedger>["data"]
>;

export const useSharedLoan = (id: number, loanId: number) =>
  useQuery({
    queryKey: ["shared", id, "loans", loanId],
    queryFn: () => call(api.shared({ id }).loans({ loanId }).get()),
  });

/** Looks up a registered user by username (for tagging). */
export const lookupUser = (username: string) =>
  call(api.users.lookup.get({ query: { username } }));

function useShareMutation<V, R extends { message: string }>(
  fn: (v: V) => Promise<R>,
) {
  const invalidate = useInvalidateBook();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      toast.success(r.message);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const useLinkConnection = () =>
  useShareMutation(({ id, username }: { id: number; username: string }) =>
    callMsg(api.connections({ id }).link.post({ username })),
  );

export const useUnlinkConnection = () =>
  useShareMutation((id: number) =>
    callMsg(api.connections({ id }).link.delete()),
  );

export const useRespondInvite = () =>
  useShareMutation(({ id, accept }: { id: number; accept: boolean }) =>
    accept
      ? callMsg(api.shared({ id }).accept.post())
      : callMsg(api.shared({ id }).decline.post()),
  );

export const useLeaveShared = () =>
  useShareMutation((id: number) => callMsg(api.shared({ id }).delete()));

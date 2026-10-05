import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, call, callMsg } from "@/lib/api";
import type { LoanEventKind, PaymentMode, Relation } from "@/lib/format";

/* ---------- queries ---------- */

export const useDashboard = () =>
  useQuery({
    queryKey: ["dashboard"],
    queryFn: () => call(api.dashboard.get()),
  });
export type Dashboard = NonNullable<ReturnType<typeof useDashboard>["data"]>;
export type ActivityRow = Dashboard["recent"][number];

export const useActivity = () =>
  useQuery({ queryKey: ["activity"], queryFn: () => call(api.activity.get()) });

export const useConnections = () =>
  useQuery({
    queryKey: ["connections"],
    queryFn: () => call(api.connections.get()),
  });
export type ConnectionItem = NonNullable<
  ReturnType<typeof useConnections>["data"]
>["connections"][number];

export const useConnection = (id: number) =>
  useQuery({
    queryKey: ["connections", id],
    queryFn: () => call(api.connections({ id }).get()),
  });
export type ConnectionDetail = NonNullable<
  ReturnType<typeof useConnection>["data"]
>;
export type LedgerRow = ConnectionDetail["ledger"][number];

export const useLoans = () =>
  useQuery({ queryKey: ["loans"], queryFn: () => call(api.loans.get()) });
export type LoanItem = NonNullable<
  ReturnType<typeof useLoans>["data"]
>["loans"][number];

export const useLoan = (id: number) =>
  useQuery({
    queryKey: ["loans", id],
    queryFn: () => call(api.loans({ id }).get()),
  });
export type LoanDetail = NonNullable<ReturnType<typeof useLoan>["data"]>;
export type LoanEventRow = LoanDetail["events"][number];

/* ---------- mutations ---------- */

/** Any money change can move every balance, so refresh all ledger views. */
export function useInvalidateBook() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      ["dashboard", "activity", "connections", "loans", "shared"].map((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      ),
    );
}
const onError = (e: Error) => toast.error(e.message);

function useBookMutation<V, R extends { message: string }>(
  fn: (v: V) => Promise<R>,
  opts: { silent?: boolean } = {},
) {
  const invalidate = useInvalidateBook();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      if (!opts.silent) toast.success(r.message);
      invalidate();
    },
    onError,
  });
}

export type ConnectionInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
  relation: Relation;
  note?: string | null;
};

export const useSaveConnection = () =>
  useBookMutation(async ({ id, ...body }: ConnectionInput & { id?: number }) =>
    id
      ? await callMsg(api.connections({ id }).patch(body))
      : await callMsg(api.connections.post(body)),
  );

export const useDeleteConnection = () =>
  useBookMutation((id: number) => callMsg(api.connections({ id }).delete()));

export type EntryInput = {
  connectionId: number;
  type: "gave" | "got";
  amount: number;
  date: string;
  reason: string;
  mode: PaymentMode;
  note?: string | null;
};

export const useSaveEntry = () =>
  useBookMutation(async ({ id, ...body }: EntryInput & { id?: number }) =>
    id
      ? await callMsg(api.entries({ id }).patch(body))
      : await callMsg(api.entries.post(body)),
  );

/** Deletes with an "Undo" toast that re-creates the entry. */
export function useDeleteEntry() {
  const invalidate = useInvalidateBook();
  const save = useSaveEntry();
  return useMutation({
    mutationFn: (id: number) => callMsg(api.entries({ id }).delete()),
    onSuccess: ({ data, message }) => {
      invalidate();
      toast.success(message, {
        action: data
          ? {
              label: "Undo",
              onClick: () =>
                save.mutate({
                  ...data,
                  mode: data.mode as PaymentMode,
                }),
            }
          : undefined,
      });
    },
    onError,
  });
}

export type LoanTermsInput = {
  title?: string;
  interestType: "simple" | "none";
  ratePercent: number;
  ratePeriod: "month" | "year";
  basis: "months" | "days";
  interestDay?: number | null;
  dueDate?: string | null;
  viaConnectionId?: number | null;
  collateral?: string | null;
  note?: string | null;
};
export type NewLoanInput = LoanTermsInput & {
  connectionId: number;
  direction: "lent" | "borrowed";
  amount: number;
  date: string;
  mode: PaymentMode;
};

export const useCreateLoan = () =>
  useBookMutation((body: NewLoanInput) => callMsg(api.loans.post(body)));

export const useUpdateLoan = () =>
  useBookMutation(
    ({
      id,
      ...body
    }: Partial<LoanTermsInput> & {
      id: number;
      connectionId?: number;
      direction?: "lent" | "borrowed";
    }) => callMsg(api.loans({ id }).patch(body)),
  );

export const useDeleteLoan = () =>
  useBookMutation((id: number) => callMsg(api.loans({ id }).delete()));

export const useCloseLoan = () =>
  useBookMutation(({ id, date }: { id: number; date: string }) =>
    callMsg(api.loans({ id }).close.post({ date })),
  );

export const useReopenLoan = () =>
  useBookMutation((id: number) => callMsg(api.loans({ id }).reopen.post()));

export type LoanEventInput = {
  kind: LoanEventKind;
  amount: number;
  date: string;
  mode: PaymentMode;
  note?: string | null;
};

export const useSaveLoanEvent = () =>
  useBookMutation(
    async ({
      loanId,
      id,
      ...body
    }: LoanEventInput & { loanId: number; id?: number }) =>
      id
        ? await callMsg(api.loans.events({ id }).patch(body))
        : await callMsg(api.loans({ id: loanId }).events.post(body)),
  );

export const useDeleteLoanEvent = () =>
  useBookMutation((id: number) => callMsg(api.loans.events({ id }).delete()));

export type ImportPayload = Parameters<typeof api.import.post>[0];
export const useImport = () =>
  useBookMutation((body: ImportPayload) => callMsg(api.import.post(body)));

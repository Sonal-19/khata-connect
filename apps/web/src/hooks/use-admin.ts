import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, call, callMsg } from "@/lib/api";

export const useAdminStats = () =>
  useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => call(api.admin.stats.get()),
  });
export type AdminStats = NonNullable<ReturnType<typeof useAdminStats>["data"]>;

export const useAdminUsers = (q: string) =>
  useQuery({
    queryKey: ["admin", "users", q],
    queryFn: () => call(api.admin.users.get({ query: q ? { q } : {} })),
    placeholderData: (prev) => prev,
  });
export type AdminUser = NonNullable<
  ReturnType<typeof useAdminUsers>["data"]
>[number];

export type AdminActionKind =
  | "user_created"
  | "role_granted"
  | "role_revoked"
  | "user_deleted";

export const useAdminActions = (kind?: AdminActionKind, limit?: number) =>
  useQuery({
    queryKey: ["admin", "actions", kind ?? "all", limit ?? 0],
    queryFn: () =>
      call(
        api.admin.actions.get({
          query: { ...(kind ? { kind } : {}), ...(limit ? { limit } : {}) },
        }),
      ),
    placeholderData: (prev) => prev,
  });
export type AdminAction = NonNullable<
  ReturnType<typeof useAdminActions>["data"]
>[number];

function useAdminMutation<V, R extends { message: string }>(
  fn: (v: V) => Promise<R>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      toast.success(r.message);
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export type NewUserInput = {
  name: string;
  email: string;
  username: string;
  password: string;
  role: "user" | "admin";
};

export const useCreateUser = () =>
  useAdminMutation((body: NewUserInput) => callMsg(api.admin.users.post(body)));

export const useSetRole = () =>
  useAdminMutation(({ id, role }: { id: number; role: "user" | "admin" }) =>
    callMsg(api.admin.users({ id }).patch({ role })),
  );

export const useDeleteUser = () =>
  useAdminMutation((id: number) => callMsg(api.admin.users({ id }).delete()));

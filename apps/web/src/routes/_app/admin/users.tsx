import { createFileRoute } from "@tanstack/react-router";
import {
  MoreHorizontal,
  Search,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useState } from "react";
import { SectionCard } from "@/components/app/section-card";
import { confirm } from "@/components/common/confirm-dialog";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { PasswordInput } from "@/components/common/password-input";
import { PersonAvatar } from "@/components/common/person-avatar";
import { ResponsiveSheet } from "@/components/common/responsive-sheet";
import { Segmented } from "@/components/common/segmented";
import { EmptyState } from "@/components/common/states";
import {
  UsernameInput,
  type UsernameState,
} from "@/components/common/username-input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  type AdminUser,
  type NewUserInput,
  useAdminUsers,
  useCreateUser,
  useDeleteUser,
  useSetRole,
} from "@/hooks/use-admin";
import { useAuth } from "@/hooks/use-auth";
import { useDebounced } from "@/hooks/use-debounced";
import { shortDate } from "@/lib/format";

export const Route = createFileRoute("/_app/admin/users")({
  component: AdminUsersPage,
});

const blank: NewUserInput = {
  name: "",
  email: "",
  username: "",
  password: "",
  role: "user",
};

function CreateUserSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const create = useCreateUser();
  const [form, setForm] = useState<NewUserInput>(blank);
  const [uState, setUState] = useState<UsernameState>("idle");
  const [last, setLast] = useState(open);
  if (open !== last) {
    setLast(open);
    if (open) setForm(blank);
  }
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Create user"
      description="The account is ready to use right away — share the password with them privately."
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(form, { onSuccess: onClose });
        }}
      >
        <Field label="Full name" htmlFor="new-name" required>
          <Input
            id="new-name"
            required
            minLength={2}
            maxLength={80}
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-11"
          />
        </Field>
        <Field label="Email" htmlFor="new-email" required>
          <Input
            id="new-email"
            type="email"
            required
            maxLength={254}
            autoComplete="off"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="h-11"
          />
        </Field>
        <Field label="Username" htmlFor="new-username" required>
          <UsernameInput
            id="new-username"
            allowReserved
            value={form.username}
            onChange={(username) => setForm({ ...form, username })}
            onState={setUState}
          />
        </Field>
        <Field
          label="Password"
          htmlFor="new-password"
          hint="At least 8 characters. They can change it in Settings."
          required
        >
          <PasswordInput
            id="new-password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="h-11"
          />
        </Field>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Role</p>
          <Segmented
            className="w-full"
            value={form.role}
            onChange={(role) => setForm({ ...form, role })}
            options={[
              { value: "user", label: "User" },
              { value: "admin", label: "Admin" },
            ]}
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={create.isPending || uState === "bad"}
        >
          {create.isPending ? "Creating…" : "Create user"}
        </Button>
      </form>
    </ResponsiveSheet>
  );
}

function RoleBadge({ role }: { role: string }) {
  return role === "admin" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
      <ShieldCheck className="size-3" /> Admin
    </span>
  ) : (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      User
    </span>
  );
}

function UserActions({ u, me }: { u: AdminUser; me: number }) {
  const setRole = useSetRole();
  const del = useDeleteUser();
  if (u.id === me)
    return <span className="text-xs text-muted-foreground">You</span>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Actions for @${u.username}`}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {u.role === "admin" ? (
          <DropdownMenuItem
            onClick={() => setRole.mutate({ id: u.id, role: "user" })}
          >
            <ShieldOff /> Remove admin
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => setRole.mutate({ id: u.id, role: "admin" })}
          >
            <ShieldCheck /> Make admin
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={async () => {
            if (
              await confirm({
                title: `Delete @${u.username}?`,
                description: `${u.name}'s account and all their records (${u.usage.people} people, ${u.usage.entries} entries, ${u.usage.loans} loans) are deleted permanently.`,
                confirmText: "Delete user",
                destructive: true,
              })
            )
              del.mutate(u.id);
          }}
        >
          <Trash2 /> Delete user
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AdminUsersPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const search = useDebounced(q.trim());
  const users = useAdminUsers(search);
  const list = users.data ?? [];

  return (
    <div>
      <PageHeader
        title="Users"
        description="Create accounts, change roles and remove users."
        actions={
          <Button onClick={() => setCreating(true)}>
            <UserPlus /> Create user
          </Button>
        }
      />

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <Users className="size-4" /> Users
          </span>
        }
      >
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, @username or email"
            className="h-10 pl-9"
          />
        </div>

        {list.length === 0 ? (
          <EmptyState title={users.isLoading ? "Loading…" : "No users match"} />
        ) : (
          <>
            {/* Phones: cards */}
            <ul className="-mx-4 divide-y border-t sm:-mx-5 md:hidden">
              {list.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center gap-3 px-4 py-3 sm:px-5"
                >
                  <PersonAvatar name={u.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium">
                      <span className="truncate">{u.name}</span>
                      <RoleBadge role={u.role} />
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{u.username} · {u.email}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Joined {shortDate(u.createdAt)} · {u.usage.people} people
                      · {u.usage.entries + u.usage.loans} records
                    </p>
                  </div>
                  <UserActions u={u} me={user?.id ?? 0} />
                </li>
              ))}
            </ul>
            {/* Tablet / desktop: table */}
            <div className="-mx-4 hidden overflow-x-auto sm:-mx-5 md:block">
              <table className="w-full text-sm">
                <thead className="border-y bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-5 py-2.5 text-left font-medium">User</th>
                    <th className="px-3 py-2.5 text-left font-medium">Email</th>
                    <th className="px-3 py-2.5 text-left font-medium">Role</th>
                    <th className="px-3 py-2.5 text-left font-medium">
                      Joined
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium">
                      People
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium">
                      Entries
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium">
                      Loans
                    </th>
                    <th className="w-12 px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {list.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/40">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-3">
                          <PersonAvatar name={u.name} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{u.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              @{u.username}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-56 truncate px-3 py-2.5 text-muted-foreground">
                        {u.email}
                      </td>
                      <td className="px-3 py-2.5">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                        {shortDate(u.createdAt)}
                      </td>
                      <td className="tabular px-3 py-2.5 text-right">
                        {u.usage.people}
                      </td>
                      <td className="tabular px-3 py-2.5 text-right">
                        {u.usage.entries}
                      </td>
                      <td className="tabular px-3 py-2.5 text-right">
                        {u.usage.loans}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <UserActions u={u} me={user?.id ?? 0} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SectionCard>

      <CreateUserSheet open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

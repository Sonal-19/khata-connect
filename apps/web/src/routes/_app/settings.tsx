import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Download, KeyRound, Trash2, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SectionCard } from "@/components/app/section-card";
import { THEMES } from "@/components/app/user-menu";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { PasswordInput } from "@/components/common/password-input";
import {
  UsernameInput,
  type UsernameState,
} from "@/components/common/username-input";
import { flowOf, rowTitle } from "@/components/ledger/activity-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { api, call, callMsg } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { modeLabel, todayStr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useThemeStore } from "@/stores/theme-store";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const clearUser = useAuthStore((s) => s.clearUser);
  const { theme, setTheme } = useThemeStore();
  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [uState, setUState] = useState<UsernameState>("idle");
  const [pw, setPw] = useState({ current: "", next: "" });
  const [delPw, setDelPw] = useState("");

  const saveName = useMutation({
    mutationFn: () => callMsg(api.profile.patch({ name, username })),
    onSuccess: ({ data, message }) => {
      setUser(data);
      qc.setQueryData(["auth", "me"], data);
      toast.success(message);
    },
    onError: (e) => toast.error(e.message),
  });
  const changePw = useMutation({
    mutationFn: () =>
      callMsg(
        api.profile["change-password"].post({
          currentPassword: pw.current,
          newPassword: pw.next,
        }),
      ),
    onSuccess: ({ message }) => {
      toast.success(message);
      setPw({ current: "", next: "" });
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteAccount = useMutation({
    mutationFn: () => callMsg(api.profile.delete({ password: delPw })),
    onSuccess: ({ message }) => {
      toast.success(message);
      clearUser();
      qc.clear();
      navigate({ to: "/", replace: true });
    },
    onError: (e) => toast.error(e.message),
  });
  const exportAll = useMutation({
    mutationFn: () => call(api.activity.get()),
    onSuccess: (rows) =>
      downloadCsv(
        `khata-connect-backup-${todayStr()}.csv`,
        ["Date", "Person", "Details", "Type", "Amount", "Mode", "Via", "Note"],
        rows.map((r) => [
          r.date,
          r.connectionName,
          rowTitle(r),
          flowOf(r) === "out"
            ? "You gave"
            : flowOf(r) === "in"
              ? "You got"
              : "Waived",
          r.amount,
          modeLabel(r.mode),
          r.viaName ?? "",
          r.note ?? "",
        ]),
      ),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" />
      <div className="space-y-4">
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <User className="size-4" /> Profile
            </span>
          }
        >
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveName.mutate();
            }}
          >
            <Field label="Name" htmlFor="set-name">
              <Input
                id="set-name"
                required
                minLength={2}
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11"
              />
            </Field>
            <Field label="Username" htmlFor="set-username">
              <UsernameInput
                id="set-username"
                value={username}
                onChange={setUsername}
                onState={setUState}
                unchanged={user?.username}
                allowReserved={user?.role === "admin"}
              />
            </Field>
            <div className="sm:col-span-2">
              <Button
                type="submit"
                disabled={
                  saveName.isPending ||
                  uState === "bad" ||
                  uState === "checking" ||
                  (name === user?.name && username === user?.username)
                }
              >
                Save profile
              </Button>
            </div>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            Email: {user?.email} · Changing your username doesn't affect
            existing links.
          </p>
        </SectionCard>

        <SectionCard title="Appearance">
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTheme(t.value)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border py-3 text-sm",
                  theme === t.value
                    ? "border-primary bg-accent text-accent-foreground"
                    : "hover:bg-muted",
                )}
              >
                <t.icon className="size-5" />
                {t.label}
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <KeyRound className="size-4" /> Change password
            </span>
          }
        >
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              changePw.mutate();
            }}
          >
            <Field label="Current password" htmlFor="pw-cur">
              <PasswordInput
                id="pw-cur"
                autoComplete="current-password"
                required
                value={pw.current}
                onChange={(e) => setPw({ ...pw, current: e.target.value })}
              />
            </Field>
            <Field
              label="New password"
              htmlFor="pw-new"
              hint="At least 8 characters. Other devices get logged out."
            >
              <PasswordInput
                id="pw-new"
                autoComplete="new-password"
                required
                minLength={8}
                value={pw.next}
                onChange={(e) => setPw({ ...pw, next: e.target.value })}
              />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={changePw.isPending}>
                Update password
              </Button>
            </div>
          </form>
        </SectionCard>

        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <Download className="size-4" /> Your data
            </span>
          }
        >
          <p className="mb-3 text-sm text-muted-foreground">
            Download every entry and loan payment as a CSV (opens in Excel).
          </p>
          <Button
            variant="outline"
            onClick={() => exportAll.mutate()}
            disabled={exportAll.isPending}
          >
            <Download /> Export all to CSV
          </Button>
        </SectionCard>

        <SectionCard
          title={
            <span className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-4" /> Delete account
            </span>
          }
          className="border-destructive/30"
        >
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              deleteAccount.mutate();
            }}
          >
            <Field
              label="Confirm with your password"
              htmlFor="del-pw"
              hint="Deletes all people, entries and loans permanently."
              className="flex-1"
            >
              <PasswordInput
                id="del-pw"
                autoComplete="current-password"
                required
                value={delPw}
                onChange={(e) => setDelPw(e.target.value)}
              />
            </Field>
            <Button
              type="submit"
              variant="destructive"
              disabled={deleteAccount.isPending}
            >
              Delete forever
            </Button>
          </form>
        </SectionCard>
      </div>
    </div>
  );
}

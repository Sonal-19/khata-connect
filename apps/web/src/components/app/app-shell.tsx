import { Link, useRouterState } from "@tanstack/react-router";
import {
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Users,
} from "lucide-react";
import type * as React from "react";
import { CountBadge } from "@/components/common/count-badge";
import { Logo } from "@/components/common/logo";
import { ConnectionSheet } from "@/components/ledger/connection-sheet";
import { EntrySheet } from "@/components/ledger/entry-sheet";
import { LoanEventSheet } from "@/components/ledger/loan-event-sheet";
import { LoanSheet } from "@/components/ledger/loan-sheet";
import { QuickAddSheet } from "@/components/ledger/quick-add-sheet";
import { Button } from "@/components/ui/button";
import { useShared } from "@/hooks/use-shared";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import type { AppUser } from "@/stores/auth-store";
import { useSheets } from "@/stores/sheets-store";
import { ADMIN_NAV, EXIT_ADMIN, isAdminArea, navFor } from "./nav-items";
import { Avatar, UserMenu, useSignOut } from "./user-menu";

const TABS = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/connections", label: "People", icon: Users },
  null,
  { to: "/loans", label: "Loans", icon: HandCoins },
  { to: "/more", label: "More", icon: Menu },
] as const;

const MORE_PATHS = [
  "/more",
  "/shared",
  "/activity",
  "/calculator",
  "/import",
  "/settings",
];

/** Exact match for index routes like `/admin`, prefix match otherwise. */
const isActive = (pathname: string, n: { to: string; exact?: boolean }) =>
  "exact" in n && n.exact
    ? pathname === n.to || pathname === `${n.to}/`
    : pathname.startsWith(n.to);

export function AppShell({
  user,
  children,
}: {
  user: AppUser;
  children: React.ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const openQuickAdd = useSheets((s) => s.openQuickAdd);
  const signOut = useSignOut();
  const admin = isAdminArea(pathname, user.role);
  const nav = admin ? ADMIN_NAV : navFor(user.role);
  const current = nav.find((n) => isActive(pathname, n));
  const invites = useShared().data?.invites.length ?? 0;

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[240px_1fr] lg:grid-cols-[260px_1fr]">
      {/* Desktop / tablet sidebar */}
      <aside className="no-print sticky top-0 hidden h-dvh flex-col border-r bg-card md:flex">
        <div className="px-5 py-5">
          <Link
            to={admin ? "/admin" : "/dashboard"}
            className="flex items-center gap-2"
          >
            <Logo />
            {admin && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                Admin
              </span>
            )}
          </Link>
        </div>
        {!admin && (
          <div className="px-3">
            <Button className="w-full" onClick={openQuickAdd}>
              <Plus /> New entry
            </Button>
          </div>
        )}
        <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-3">
          {nav.map((n) => {
            const active = isActive(pathname, n);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  active && "bg-accent text-accent-foreground hover:bg-accent",
                )}
              >
                <n.icon className="size-4.5" />
                <span className="flex-1">{n.label}</span>
                {n.to === "/shared" && <CountBadge n={invites} />}
              </Link>
            );
          })}
        </nav>
        {admin && (
          <div className="border-t px-3 py-3">
            <Link
              to={EXIT_ADMIN.to}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <EXIT_ADMIN.icon className="size-4.5" />
              <span className="flex-1">{EXIT_ADMIN.label}</span>
            </Link>
          </div>
        )}
        <div className="flex items-center gap-3 border-t p-4">
          <Avatar name={user.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              @{user.username}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            aria-label="Log out"
            title="Log out"
          >
            <LogOut />
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="no-print pt-safe sticky top-0 z-30 border-b bg-background/85 backdrop-blur-lg">
          <div className="flex h-14 items-center justify-between gap-3 px-4 md:h-16 md:px-8">
            <div className="flex min-w-0 items-center gap-2 md:hidden">
              <img src="/favicon.svg" alt="" className="size-7 rounded-md" />
              <span className="truncate font-semibold">
                {current?.label ?? (pathname === "/more" ? "More" : BRAND.name)}
              </span>
            </div>
            <p className="hidden text-sm text-muted-foreground md:block">
              Namaste,{" "}
              <span className="font-medium text-foreground">
                {user.name.split(" ")[0]}
              </span>{" "}
              🙏
            </p>
            <UserMenu user={user} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-28 md:px-8 md:pt-6 md:pb-10">
          {children}
        </main>
      </div>

      {/* Phone bottom tab bar */}
      <nav className="no-print pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur-lg md:hidden">
        {admin ? (
          <div className="grid h-16 grid-cols-4 items-center">
            {[...ADMIN_NAV, EXIT_ADMIN].map((tab) => {
              const active = tab !== EXIT_ADMIN && isActive(pathname, tab);
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={cn(
                    "flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground transition-colors",
                    active && "text-primary",
                  )}
                >
                  <tab.icon
                    className={cn(
                      "size-5.5 transition-transform",
                      active && "scale-110",
                    )}
                  />
                  {tab.label.replace("Admin activity", "Activity")}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="grid h-16 grid-cols-5 items-center">
            {TABS.map((tab) => {
              if (!tab)
                return (
                  <div key="fab" className="grid place-items-center">
                    <button
                      type="button"
                      onClick={openQuickAdd}
                      aria-label="New entry"
                      className="-mt-7 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background transition-transform active:scale-90"
                    >
                      <Plus className="size-7" />
                    </button>
                  </div>
                );
              const active =
                tab.to === "/more"
                  ? MORE_PATHS.some((p) => pathname.startsWith(p))
                  : pathname.startsWith(tab.to);
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={cn(
                    "flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground transition-colors",
                    active && "text-primary",
                  )}
                >
                  <span className="relative">
                    <tab.icon
                      className={cn(
                        "size-5.5 transition-transform",
                        active && "scale-110",
                      )}
                    />
                    {tab.to === "/more" && (
                      <CountBadge
                        n={invites}
                        className="absolute -top-1.5 -right-2.5 h-4 min-w-4 text-[9px]"
                      />
                    )}
                  </span>
                  {tab.label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      <QuickAddSheet />
      <EntrySheet />
      <LoanSheet />
      <LoanEventSheet />
      <ConnectionSheet />
    </div>
  );
}

import {
  ArrowLeftRight,
  Calculator,
  FileSpreadsheet,
  HandCoins,
  History,
  LayoutDashboard,
  LayoutGrid,
  Settings,
  ShieldCheck,
  UserCheck,
  UserCog,
  Users,
} from "lucide-react";

export const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/connections", label: "People", icon: Users },
  { to: "/loans", label: "Loans & interest", icon: HandCoins },
  { to: "/shared", label: "Shared with me", icon: UserCheck },
  { to: "/activity", label: "Activity", icon: History },
  { to: "/calculator", label: "Interest calculator", icon: Calculator },
  { to: "/import", label: "Import from Excel", icon: FileSpreadsheet },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/admin", label: "Admin", icon: ShieldCheck, adminOnly: true },
] as const;

/** Nav entries this user may see. */
export const navFor = (role: string) =>
  NAV.filter((n) => !("adminOnly" in n) || role === "admin");

/** Sidebar / tab bar inside the admin area — admin tools only. */
export const ADMIN_NAV = [
  { to: "/admin", label: "Overview", icon: LayoutGrid, exact: true },
  { to: "/admin/users", label: "Users", icon: UserCog },
  { to: "/admin/activity", label: "Admin activity", icon: History },
] as const;

export const EXIT_ADMIN = {
  to: "/dashboard",
  label: "My khata",
  icon: ArrowLeftRight,
} as const;

export const isAdminArea = (pathname: string, role: string) =>
  role === "admin" && /^\/admin(\/|$)/.test(pathname);

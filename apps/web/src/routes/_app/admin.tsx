import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/admin")({
  component: AdminLayout,
});

/** Admin area: its own sidebar (see `AppShell`), admins only. */
function AdminLayout() {
  const { user } = useAuth();
  if (user && user.role !== "admin")
    return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

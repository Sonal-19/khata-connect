import { createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";
import { useState } from "react";
import { ACTION_META, ActionList } from "@/components/admin/action-list";
import { SectionCard } from "@/components/app/section-card";
import { PageHeader } from "@/components/common/page-header";
import { Segmented } from "@/components/common/segmented";
import { EmptyState, ErrorState, PageLoader } from "@/components/common/states";
import { type AdminActionKind, useAdminActions } from "@/hooks/use-admin";

export const Route = createFileRoute("/_app/admin/activity")({
  component: AdminActivityPage,
});

type Filter = "all" | AdminActionKind;

function AdminActivityPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const { data, isLoading, error } = useAdminActions(
    filter === "all" ? undefined : filter,
  );

  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorState error={error} />;

  return (
    <div>
      <PageHeader
        title="Admin activity"
        description="Every account change made by an admin, newest first."
      />
      <Segmented
        className="mb-4"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All" },
          ...Object.entries(ACTION_META).map(([value, m]) => ({
            value: value as AdminActionKind,
            label: m.label,
          })),
        ]}
      />
      <SectionCard>
        {data.length === 0 ? (
          <EmptyState icon={<History className="size-8" />} title="Nothing yet">
            Creating users, changing roles and deleting accounts show up here.
          </EmptyState>
        ) : (
          <ActionList actions={data} />
        )}
      </SectionCard>
    </div>
  );
}

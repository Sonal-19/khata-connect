import { format } from "date-fns";
import {
  ShieldCheck,
  ShieldOff,
  Terminal,
  Trash2,
  UserPlus,
} from "lucide-react";
import type { AdminAction, AdminActionKind } from "@/hooks/use-admin";
import { dayLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export const ACTION_META: Record<
  AdminActionKind,
  { label: string; verb: string; icon: typeof UserPlus; tone: string }
> = {
  user_created: {
    label: "Created",
    verb: "created",
    icon: UserPlus,
    tone: "bg-accent text-accent-foreground",
  },
  role_granted: {
    label: "Made admin",
    verb: "made admin",
    icon: ShieldCheck,
    tone: "bg-accent text-accent-foreground",
  },
  role_revoked: {
    label: "Removed admin",
    verb: "removed admin from",
    icon: ShieldOff,
    tone: "bg-muted text-muted-foreground",
  },
  user_deleted: {
    label: "Deleted",
    verb: "deleted",
    icon: Trash2,
    tone: "bg-destructive/10 text-destructive",
  },
};

function Handle({ name, gone }: { name: string; gone?: boolean }) {
  return (
    <span
      className={cn(
        "font-medium",
        gone && "text-muted-foreground line-through",
      )}
      title={gone ? "Account deleted" : undefined}
    >
      @{name}
    </span>
  );
}

export function ActionItem({ a }: { a: AdminAction }) {
  const meta = ACTION_META[a.kind];
  return (
    <li className="flex items-start gap-3 py-3">
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-xl",
          meta.tone,
        )}
      >
        <meta.icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="leading-snug">
          {a.actorUsername ? (
            <Handle name={a.actorUsername} gone={a.isActorDeleted} />
          ) : (
            <span className="inline-flex items-center gap-1 font-medium">
              <Terminal className="size-3.5" /> Command line
            </span>
          )}{" "}
          <span className="text-muted-foreground">{meta.verb}</span>{" "}
          <Handle name={a.targetUsername} gone={a.isTargetDeleted} />
        </p>
        <p className="truncate text-xs text-muted-foreground">{a.targetName}</p>
      </div>
      <time
        dateTime={String(a.createdAt)}
        className="tabular shrink-0 text-xs text-muted-foreground"
      >
        {format(new Date(a.createdAt), "h:mm a")}
      </time>
    </li>
  );
}

/** Actions grouped under local-day headings, newest first. */
export function ActionList({ actions }: { actions: AdminAction[] }) {
  const days: { key: string; rows: AdminAction[] }[] = [];
  for (const a of actions) {
    const key = format(new Date(a.createdAt), "yyyy-MM-dd");
    const last = days.at(-1);
    if (last?.key === key) last.rows.push(a);
    else days.push({ key, rows: [a] });
  }
  return (
    <div className="space-y-4">
      {days.map((d) => (
        <div key={d.key}>
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {dayLabel(d.key)}
          </h3>
          <ul className="divide-y">
            {d.rows.map((a) => (
              <ActionItem key={a.id} a={a} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

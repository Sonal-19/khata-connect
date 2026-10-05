import { and, count, desc, eq, gte, ilike, ne, or, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";
import { db } from "$/db";
import {
  adminActionKinds,
  adminActionsTable,
  connectionLinksTable,
  connectionsTable,
  entriesTable,
  type InsertAdminAction,
  loansTable,
  roles,
  type SelectUser,
  usersTable,
} from "$/db/schema";
import { coreAuthService } from "$/lib/services/core-auth-service";
import { publicUser } from "$/lib/services/session-service";
import { findUserByEmail, usernameProblem } from "$/lib/services/user-service";
import {
  fail,
  isUniqueViolation,
  normalizeEmail,
  normalizeUsername,
  ok,
} from "$/lib/utils";
import { tEnum, tId, tUsername } from "$/lib/utils/schema";
import { protectedUser } from "$/pre-processor";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

/** How many of each record a user has — counts only, never amounts. */
async function usage(userIds: number[]) {
  if (!userIds.length) return new Map<number, Record<string, number>>();
  const [people, entries, loans] = await Promise.all(
    [connectionsTable, entriesTable, loansTable].map((tbl) =>
      db
        .select({ userId: tbl.userId, n: count() })
        .from(tbl)
        .groupBy(tbl.userId),
    ),
  );
  const map = new Map<
    number,
    { people: number; entries: number; loans: number }
  >();
  for (const id of userIds) map.set(id, { people: 0, entries: 0, loans: 0 });
  for (const r of people!) {
    const m = map.get(r.userId);
    if (m) m.people = r.n;
  }
  for (const r of entries!) {
    const m = map.get(r.userId);
    if (m) m.entries = r.n;
  }
  for (const r of loans!) {
    const m = map.get(r.userId);
    if (m) m.loans = r.n;
  }
  return map;
}

/** Record what an admin did to an account. */
const logAction = (
  kind: InsertAdminAction["kind"],
  actor: { id: number; username: string },
  target: Pick<SelectUser, "id" | "username" | "name">,
  tx: Pick<typeof db, "insert"> = db,
) =>
  tx.insert(adminActionsTable).values({
    kind,
    actorUserId: actor.id,
    actorUsername: actor.username,
    targetUserId: target.id,
    targetUsername: target.username,
    targetName: target.name,
  });

async function adminCount() {
  const [r] = await db
    .select({ n: count() })
    .from(usersTable)
    .where(eq(usersTable.role, "admin"));
  return r?.n ?? 0;
}

/**
 * Admin console. Admins manage accounts and see usage counts; they never
 * see anyone's people, amounts or loans.
 */
export const adminController = new Elysia({
  name: "admin_controller",
  prefix: "/admin",
})
  .use(protectedUser)
  .onBeforeHandle(({ user, status }) => {
    if (user.role !== "admin")
      return status(403, fail("Only admins can open this page"));
  })
  .get("/stats", async () => {
    const one = async (where?: ReturnType<typeof eq>) => {
      const [r] = await db.select({ n: count() }).from(usersTable).where(where);
      return r?.n ?? 0;
    };
    const table = async (
      tbl: typeof connectionsTable | typeof entriesTable | typeof loansTable,
    ) => {
      const [r] = await db.select({ n: count() }).from(tbl);
      return r?.n ?? 0;
    };
    const [
      total,
      admins,
      last7,
      last30,
      people,
      entries,
      loans,
      links,
      monthly,
    ] = await Promise.all([
      one(),
      one(eq(usersTable.role, "admin")),
      one(gte(usersTable.createdAt, daysAgo(7))),
      one(gte(usersTable.createdAt, daysAgo(30))),
      table(connectionsTable),
      table(entriesTable),
      table(loansTable),
      db
        .select({ n: count() })
        .from(connectionLinksTable)
        .where(eq(connectionLinksTable.status, "accepted"))
        .then((r) => r[0]?.n ?? 0),
      db
        .select({
          month: sql<string>`to_char(date_trunc('month', ${usersTable.createdAt} at time zone 'Asia/Kolkata'), 'YYYY-MM')`,
          n: count(),
        })
        .from(usersTable)
        .where(gte(usersTable.createdAt, daysAgo(366)))
        .groupBy(sql`1`)
        .orderBy(sql`1`),
    ]);
    // Last 12 months, zero-filled.
    const now = new Date();
    const signups = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1),
      );
      const key = d.toISOString().slice(0, 7);
      return {
        month: key,
        users: monthly.find((m) => m.month === key)?.n ?? 0,
      };
    });
    return ok({
      total,
      admins,
      last7,
      last30,
      people,
      entries,
      loans,
      links,
      signups,
    });
  })
  .get(
    "/users",
    async ({ query }) => {
      const q = query.q?.trim();
      const rows = await db
        .select()
        .from(usersTable)
        .where(
          q
            ? or(
                ilike(usersTable.name, `%${q}%`),
                ilike(usersTable.email, `%${q}%`),
                ilike(usersTable.username, `%${normalizeUsername(q)}%`),
              )
            : undefined,
        )
        .orderBy(desc(usersTable.createdAt))
        .limit(200);
      const counts = await usage(rows.map((r) => r.id));
      return ok(
        rows.map((u) => ({
          ...publicUser(u),
          usage: counts.get(u.id) ?? { people: 0, entries: 0, loans: 0 },
        })),
      );
    },
    { query: t.Object({ q: t.Optional(t.String({ maxLength: 80 })) }) },
  )
  .get(
    "/actions",
    async ({ query }) => {
      const rows = await db
        .select()
        .from(adminActionsTable)
        .where(query.kind ? eq(adminActionsTable.kind, query.kind) : undefined)
        .orderBy(desc(adminActionsTable.createdAt), desc(adminActionsTable.id))
        .limit(query.limit ?? 200);
      return ok(
        rows.map((r) => ({
          id: r.id,
          kind: r.kind,
          actorUsername: r.actorUsername,
          isActorDeleted: r.actorUsername !== null && r.actorUserId === null,
          targetUsername: r.targetUsername,
          targetName: r.targetName,
          isTargetDeleted: r.targetUserId === null,
          createdAt: r.createdAt,
        })),
      );
    },
    {
      query: t.Object({
        kind: t.Optional(tEnum(adminActionKinds)),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 500 })),
      }),
    },
  )
  .post(
    "/users",
    async ({ user: admin, body, status }) => {
      const email = normalizeEmail(body.email);
      if (await findUserByEmail(email))
        return status(409, fail("An account with this email already exists"));
      const problem = await usernameProblem(body.username, {
        allowReserved: true,
      });
      if (problem) return status(409, fail(problem));
      try {
        const [user] = await db
          .insert(usersTable)
          .values({
            name: body.name.trim(),
            email,
            username: normalizeUsername(body.username),
            role: body.role,
            passwordHash: await Bun.password.hash(body.password),
          })
          .returning();
        await logAction("user_created", admin, user!);
        return ok(publicUser(user!), `@${user!.username} created`);
      } catch (e) {
        if (isUniqueViolation(e))
          return status(409, fail("Username or email is already taken"));
        throw e;
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 2, maxLength: 80 }),
        email: t.String({ format: "email", maxLength: 254 }),
        username: tUsername,
        password: t.String({ minLength: 8, maxLength: 128 }),
        role: tEnum(roles),
      }),
    },
  )
  .patch(
    "/users/:id",
    async ({ user, params, body, status }) => {
      const [target] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, params.id));
      if (!target) return status(404, fail("User not found"));
      if (target.id === user.id && body.role !== "admin")
        return status(400, fail("You can't remove your own admin access"));
      if (target.role === body.role)
        return ok(
          null,
          `@${target.username} is already ${body.role === "admin" ? "an admin" : "a regular user"}`,
        );
      await db
        .update(usersTable)
        .set({ role: body.role })
        .where(eq(usersTable.id, target.id));
      await logAction(
        body.role === "admin" ? "role_granted" : "role_revoked",
        user,
        target,
      );
      return ok(
        null,
        body.role === "admin"
          ? `@${target.username} is now an admin`
          : `@${target.username} is now a regular user`,
      );
    },
    { params: tId, body: t.Object({ role: tEnum(roles) }) },
  )
  .delete(
    "/users/:id",
    async ({ user, params, status }) => {
      if (params.id === user.id)
        return status(400, fail("You can't delete your own account here"));
      const [target] = await db
        .select()
        .from(usersTable)
        .where(and(eq(usersTable.id, params.id), ne(usersTable.id, user.id)));
      if (!target) return status(404, fail("User not found"));
      if (target.role === "admin" && (await adminCount()) <= 1)
        return status(400, fail("Keep at least one admin"));
      await coreAuthService.revokeAllForUser(target.id);
      // Log first: the FK then nulls target_user_id, marking the row as deleted.
      await db.transaction(async (tx) => {
        await logAction("user_deleted", user, target, tx);
        await tx.delete(usersTable).where(eq(usersTable.id, target.id));
      });
      return ok(null, `@${target.username} deleted`);
    },
    { params: tId },
  );

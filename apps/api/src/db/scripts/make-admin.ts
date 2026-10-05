/** Promote an account to admin: bun run db:make-admin <email|username> */
import { eq, or } from "drizzle-orm";
import { db } from "$/db";
import { adminActionsTable, usersTable } from "$/db/schema";
import { normalizeEmail, normalizeUsername } from "$/lib/utils";

const who = process.argv[2];
if (!who) {
  console.error("Usage: bun run db:make-admin <email|username>");
  process.exit(1);
}
const [before] = await db
  .select({ role: usersTable.role })
  .from(usersTable)
  .where(
    or(
      eq(usersTable.email, normalizeEmail(who)),
      eq(usersTable.username, normalizeUsername(who)),
    ),
  );
const [user] = await db
  .update(usersTable)
  .set({ role: "admin" })
  .where(
    or(
      eq(usersTable.email, normalizeEmail(who)),
      eq(usersTable.username, normalizeUsername(who)),
    ),
  )
  .returning();
if (user && before?.role !== "admin")
  // No actor: shown as "command line" in the admin activity log.
  await db.insert(adminActionsTable).values({
    kind: "role_granted",
    targetUserId: user.id,
    targetUsername: user.username,
    targetName: user.name,
  });
console.info(user ? `@${user.username} is now an admin` : `No user "${who}"`);
process.exit(user ? 0 : 1);

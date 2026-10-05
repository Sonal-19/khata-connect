import { and, eq, ne } from "drizzle-orm";
import { db } from "$/db";
import { usersTable } from "$/db/schema";
import {
  normalizeEmail,
  normalizeUsername,
  RESERVED_USERNAMES,
  USERNAME_PATTERN,
} from "$/lib/utils";

const usernameRe = new RegExp(USERNAME_PATTERN);

export async function findUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, normalizeEmail(email)))
    .limit(1);
  return user;
}

export async function findUserByUsername(username: string) {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, normalizeUsername(username)))
    .limit(1);
  return user;
}

/** "name@x.com" → email lookup, anything else → username lookup. */
export const findUserByLogin = (identifier: string) =>
  identifier.includes("@") && !identifier.trim().startsWith("@")
    ? findUserByEmail(identifier)
    : findUserByUsername(identifier);

/** Why this username can't be used, or null when it's free. */
export async function usernameProblem(
  raw: string,
  opts: { allowReserved?: boolean; exceptUserId?: number } = {},
) {
  const username = normalizeUsername(raw);
  if (!usernameRe.test(username)) return "Use 3–16 letters, numbers, _ or .";
  if (!opts.allowReserved && RESERVED_USERNAMES.has(username))
    return "This username is reserved";
  const [taken] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(
      opts.exceptUserId
        ? and(
            eq(usersTable.username, username),
            ne(usersTable.id, opts.exceptUserId),
          )
        : eq(usersTable.username, username),
    )
    .limit(1);
  return taken ? "Username is already taken" : null;
}

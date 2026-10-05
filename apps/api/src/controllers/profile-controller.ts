import { eq } from "drizzle-orm";
import Elysia, { t } from "elysia";
import { db } from "$/db";
import { usersTable } from "$/db/schema";
import { coreAuthService } from "$/lib/services/core-auth-service";
import { publicUser } from "$/lib/services/session-service";
import { usernameProblem } from "$/lib/services/user-service";
import { fail, isUniqueViolation, normalizeUsername, ok } from "$/lib/utils";
import { tUsername } from "$/lib/utils/schema";
import { protectedUser } from "$/pre-processor";

export const profileController = new Elysia({
  name: "profile_controller",
  prefix: "/profile",
})
  .use(protectedUser)
  .patch(
    "/",
    async ({ user, body, status }) => {
      const username =
        body.username === undefined
          ? undefined
          : normalizeUsername(body.username);
      if (username && username !== user.username) {
        const problem = await usernameProblem(username, {
          exceptUserId: user.id,
          allowReserved: user.role === "admin",
        });
        if (problem) return status(409, fail(problem));
      }
      try {
        const [updated] = await db
          .update(usersTable)
          .set({
            ...(body.name !== undefined && { name: body.name.trim() }),
            ...(username !== undefined && { username }),
          })
          .where(eq(usersTable.id, user.id))
          .returning();
        return ok(publicUser(updated!), "Profile updated");
      } catch (e) {
        if (isUniqueViolation(e))
          return status(409, fail("Username is already taken"));
        throw e;
      }
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 2, maxLength: 80 })),
        username: t.Optional(tUsername),
      }),
    },
  )
  .post(
    "/change-password",
    async ({ user, token, body, status }) => {
      const valid = await Bun.password.verify(
        body.currentPassword,
        user.passwordHash,
      );
      if (!valid) return status(400, fail("Current password is incorrect"));
      await db
        .update(usersTable)
        .set({ passwordHash: await Bun.password.hash(body.newPassword) })
        .where(eq(usersTable.id, user.id));
      await coreAuthService.revokeAllForUser(user.id, token ?? undefined);
      return ok(null, "Password changed");
    },
    {
      body: t.Object({
        currentPassword: t.String({ minLength: 1 }),
        newPassword: t.String({ minLength: 8, maxLength: 128 }),
      }),
    },
  )
  .delete(
    "/",
    async ({ user, body, status, cookie }) => {
      const valid = await Bun.password.verify(body.password, user.passwordHash);
      if (!valid) return status(400, fail("Password is incorrect"));
      await coreAuthService.revokeAllForUser(user.id);
      await db.delete(usersTable).where(eq(usersTable.id, user.id));
      cookie?.token?.remove();
      return ok(null, "Account deleted");
    },
    { body: t.Object({ password: t.String({ minLength: 1 }) }) },
  );

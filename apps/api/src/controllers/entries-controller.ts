import { and, eq } from "drizzle-orm";
import Elysia, { t } from "elysia";
import { db } from "$/db";
import { entriesTable, entryTypes, paymentModes } from "$/db/schema";
import { ownedConnection } from "$/lib/services/book-service";
import { fail, ok } from "$/lib/utils";
import { money } from "$/lib/utils/format";
import { toPaise, toRupees } from "$/lib/utils/money";
import { tAmount, tDate, tEnum, tId, tNote } from "$/lib/utils/schema";
import { protectedUser } from "$/pre-processor";

const entryBody = t.Object({
  connectionId: t.Integer(),
  type: tEnum(entryTypes),
  amount: tAmount,
  date: tDate,
  reason: t.String({ minLength: 1, maxLength: 120 }),
  mode: tEnum(paymentModes),
  note: t.Optional(tNote),
});

async function ownedEntry(userId: number, id: number) {
  const [row] = await db
    .select()
    .from(entriesTable)
    .where(and(eq(entriesTable.id, id), eq(entriesTable.userId, userId)))
    .limit(1);
  return row;
}

export const entriesController = new Elysia({
  name: "entries_controller",
  prefix: "/entries",
})
  .use(protectedUser)
  .post(
    "/",
    async ({ user, body, status }) => {
      const c = await ownedConnection(user.id, body.connectionId);
      if (!c) return status(404, fail("Connection not found"));
      const [row] = await db
        .insert(entriesTable)
        .values({
          ...body,
          reason: body.reason.trim(),
          amount: toPaise(body.amount),
          userId: user.id,
        })
        .returning();
      return ok(
        { ...row!, amount: toRupees(row!.amount) },
        body.type === "gave"
          ? `You gave ${money(body.amount)} to ${c.name}`
          : `You got ${money(body.amount)} from ${c.name}`,
      );
    },
    { body: entryBody },
  )
  .patch(
    "/:id",
    async ({ user, params, body, status }) => {
      const entry = await ownedEntry(user.id, params.id);
      if (!entry) return status(404, fail("Entry not found"));
      if (
        body.connectionId !== undefined &&
        !(await ownedConnection(user.id, body.connectionId))
      )
        return status(404, fail("Connection not found"));
      await db
        .update(entriesTable)
        .set({
          ...body,
          ...(body.reason && { reason: body.reason.trim() }),
          ...(body.amount !== undefined && { amount: toPaise(body.amount) }),
        })
        .where(eq(entriesTable.id, entry.id));
      return ok(null, "Entry updated");
    },
    { params: tId, body: t.Partial(entryBody) },
  )
  .delete(
    "/:id",
    async ({ user, params, status }) => {
      const entry = await ownedEntry(user.id, params.id);
      if (!entry) return status(404, fail("Entry not found"));
      await db.delete(entriesTable).where(eq(entriesTable.id, entry.id));
      const { userId: _u, createdAt: _c, id: _id, ...rest } = entry;
      // Returned so the client can offer "Undo".
      return ok({ ...rest, amount: toRupees(entry.amount) }, "Entry deleted");
    },
    { params: tId },
  );

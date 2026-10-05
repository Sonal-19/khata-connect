import { and, eq, inArray } from "drizzle-orm";
import Elysia, { t } from "elysia";
import { db } from "$/db";
import {
  connectionsTable,
  entriesTable,
  entryTypes,
  interestBases,
  interestTypes,
  loanDirections,
  loanEventKinds,
  loanEventsTable,
  loansTable,
  paymentModes,
  ratePeriods,
} from "$/db/schema";
import { fail, ok } from "$/lib/utils";
import { toPaise } from "$/lib/utils/money";
import { tAmount, tDate, tEnum, tNote } from "$/lib/utils/schema";
import { protectedUser } from "$/pre-processor";

/** A person referenced by the import: an existing connection or a new name. */
const tRef = t.Object({
  id: t.Optional(t.Integer()),
  name: t.Optional(t.String({ minLength: 1, maxLength: 80 })),
});

const tImportEvent = t.Object({
  kind: tEnum(loanEventKinds),
  amount: tAmount,
  date: tDate,
  note: t.Optional(tNote),
});

/**
 * Bulk import (from a spreadsheet parsed in the browser). Everything is
 * written in one transaction, so a failed import leaves nothing behind.
 */
export const importController = new Elysia({ name: "import_controller" })
  .use(protectedUser)
  .post(
    "/import",
    async ({ user, body, status }) => {
      const refs = [body.holder, ...body.loans.flatMap((l) => [l.party])] as {
        id?: number;
        name?: string;
      }[];
      const ids = [...new Set(refs.flatMap((r) => (r.id ? [r.id] : [])))];
      if (ids.length) {
        const owned = await db
          .select({ id: connectionsTable.id })
          .from(connectionsTable)
          .where(
            and(
              eq(connectionsTable.userId, user.id),
              inArray(connectionsTable.id, ids),
            ),
          );
        if (owned.length !== ids.length)
          return status(404, fail("Connection not found"));
      }
      if (refs.some((r) => !r.id && !r.name?.trim()))
        return status(400, fail("Every row needs a person"));

      const result = await db.transaction(async (tx) => {
        const created = new Map<string, number>();
        const resolve = async (r: { id?: number; name?: string }) => {
          if (r.id) return r.id;
          const name = r.name!.trim();
          const key = name.toLowerCase();
          const hit = created.get(key);
          if (hit) return hit;
          const [c] = await tx
            .insert(connectionsTable)
            .values({ userId: user.id, name, relation: "other" })
            .returning();
          created.set(key, c!.id);
          return c!.id;
        };

        const holderId = await resolve(body.holder);
        if (body.entries.length)
          await tx.insert(entriesTable).values(
            body.entries.map((e) => ({
              userId: user.id,
              connectionId: holderId,
              type: e.type,
              amount: toPaise(e.amount),
              date: e.date,
              reason: e.reason.trim() || "Imported",
              mode: e.mode ?? "cash",
              note: e.note ?? null,
            })),
          );

        for (const l of body.loans) {
          const partyId = await resolve(l.party);
          if (partyId === holderId) continue;
          const [loan] = await tx
            .insert(loansTable)
            .values({
              userId: user.id,
              connectionId: partyId,
              viaConnectionId: l.viaHolder ? holderId : null,
              direction: l.direction,
              title: l.title.trim(),
              interestType: l.interestType,
              ratePercent: l.ratePercent,
              ratePeriod: l.ratePeriod,
              basis: l.basis,
              note: l.note ?? null,
            })
            .returning();
          await tx.insert(loanEventsTable).values(
            l.events.map((e) => ({
              loanId: loan!.id,
              kind: e.kind,
              amount: toPaise(e.amount),
              date: e.date,
              note: e.note ?? null,
            })),
          );
        }
        return {
          entries: body.entries.length,
          loans: body.loans.length,
          newConnections: created.size,
          holderId,
        };
      });

      return ok(
        result,
        `Imported ${result.entries} entries and ${result.loans} loan(s)`,
      );
    },
    {
      body: t.Object({
        holder: tRef,
        entries: t.Array(
          t.Object({
            type: tEnum(entryTypes),
            amount: tAmount,
            date: tDate,
            reason: t.String({ maxLength: 120 }),
            mode: t.Optional(tEnum(paymentModes)),
            note: t.Optional(tNote),
          }),
          { maxItems: 5000 },
        ),
        loans: t.Array(
          t.Object({
            party: tRef,
            viaHolder: t.Boolean(),
            direction: tEnum(loanDirections),
            title: t.String({ minLength: 1, maxLength: 80 }),
            interestType: tEnum(interestTypes),
            ratePercent: t.Number({ minimum: 0, maximum: 100 }),
            ratePeriod: tEnum(ratePeriods),
            basis: tEnum(interestBases),
            note: t.Optional(tNote),
            events: t.Array(tImportEvent, { minItems: 1, maxItems: 1000 }),
          }),
          { maxItems: 100 },
        ),
      }),
    },
  );

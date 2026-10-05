/**
 * One-off for databases created before usernames existed:
 *   bun run db:backfill-usernames && bun run db:push
 * Adds the column (nullable) and gives every user a unique username from
 * their email, so the NOT NULL + UNIQUE push succeeds.
 */
import { DATABASE_URL } from "$/env";

const sql = new Bun.SQL(DATABASE_URL, { max: 1 });
await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS username text`;
const rows: { id: number; email: string; username: string | null }[] =
  await sql`SELECT id, email, username FROM users ORDER BY id`;
const taken = new Set(rows.flatMap((r) => (r.username ? [r.username] : [])));
let filled = 0;
for (const r of rows) {
  if (r.username) continue;
  const base =
    (r.email.split("@")[0] ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9_.]/g, "")
      .slice(0, 12)
      .padEnd(3, "0") || "user";
  let name = base;
  for (let n = 1; taken.has(name); n++) name = `${base}${n}`.slice(0, 16);
  taken.add(name);
  await sql`UPDATE users SET username = ${name} WHERE id = ${r.id}`;
  filled++;
}
console.info(`Backfilled ${filled} username(s). Now run: bun run db:push`);
await sql.close();

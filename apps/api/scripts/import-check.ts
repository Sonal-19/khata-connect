// biome-ignore-all lint/suspicious/noExplicitAny: ad-hoc check script
/** End-to-end import check: bun scripts/import-check.ts <file.xlsx>. Uses a throwaway user. */
import { eq } from "drizzle-orm";
import Elysia from "elysia";
import { mainController } from "$/controllers";
import { db } from "$/db";
import { usersTable } from "$/db/schema";
import { coreAuthService } from "$/lib/services/core-auth-service";
import { today } from "$/lib/utils/period";
import {
  buildImport,
  findHeaderRow,
  guessColumns,
  parseRows,
} from "../../web/src/lib/import-mapping";
import { readXlsxBytes } from "../../web/src/lib/xlsx";

const file = process.argv[2]!;
const EMAIL = "import-check@khataconnect.local";
await coreAuthService.initialize();
await db.delete(usersTable).where(eq(usersTable.email, EMAIL));
await db.insert(usersTable).values({
  name: "Import Check",
  email: EMAIL,
  username: "importcheck",
  passwordHash: await Bun.password.hash("Check@1234"),
});

const app = new Elysia().use(mainController);
let cookie = "";
const req = async (method: string, path: string, body?: unknown) => {
  const res = await app.handle(
    new Request(`http://localhost/api${path}`, {
      method,
      headers: { "content-type": "application/json", cookie },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
  const set = res.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0]!;
  const j = (await res.json()) as any;
  if (!res.ok) console.error(path, res.status, j.message);
  return j;
};
await req("POST", "/auth/login", { email: EMAIL, password: "Check@1234" });

const sheets = readXlsxBytes(
  new Uint8Array(await Bun.file(file).arrayBuffer()),
);
for (const [i, s] of sheets.entries()) {
  const h = findHeaderRow(s.rows);
  const { rows } = parseRows(s.rows, h, guessColumns(s.rows[h]!));
  const borrower = rows.some((r) => r.interest) ? { name: "Borrower" } : null;
  const { payload } = buildImport(rows, {
    holder: { name: `Holder ${i + 1}` },
    borrower,
    positiveIsGave: true,
    ratePeriod: "month",
    basis: "months",
    defaultRate: 1,
    loanTitle: "Imported loan",
    today: today(),
  });
  console.info((await req("POST", "/import", payload)).message);
}
const conns = (await req("GET", "/connections")).data;
for (const c of conns.connections) console.info(c.name, c.summary);
console.info("totals", conns.totals);
await db.delete(usersTable).where(eq(usersTable.email, EMAIL));
console.info("cleaned up");
process.exit(0);

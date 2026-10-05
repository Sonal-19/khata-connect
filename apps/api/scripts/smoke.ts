// biome-ignore-all lint/suspicious/noExplicitAny: ad-hoc smoke script over loosely typed JSON
/** In-process API smoke test: bun scripts/smoke.ts (needs a seeded DB). */
import Elysia from "elysia";
import { mainController } from "$/controllers";
import { coreAuthService } from "$/lib/services/core-auth-service";

await coreAuthService.initialize();
const app = new Elysia().use(mainController);
let cookie = "";
async function req(method: string, path: string, body?: unknown) {
  const res = await app.handle(
    new Request(`http://localhost/api${path}`, {
      method,
      headers: { "content-type": "application/json", cookie },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
  const set = res.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0]!;
  const json = (await res.json()) as any;
  if (!res.ok) console.error(method, path, res.status, json.message);
  return json;
}

const login = async (identifier: string, password = "Demo@1234") => {
  cookie = "";
  return req("POST", "/auth/login", { identifier, password });
};
await login("demo@khataconnect.local");
const dash = (await req("GET", "/dashboard")).data as any;
console.info("totals", dash.totals);
console.info(
  "upcoming",
  dash.upcoming.map((u: any) => `${u.type} ${u.date} ${u.title} ${u.amount}`),
);
console.info("chart pts", dash.chart.length, dash.chart.at(-1));
const conns = (await req("GET", "/connections")).data as any;
for (const c of conns.connections)
  console.info(c.name, c.summary.net, c.summary.ledger);
const ravi = conns.connections.find((c: any) => c.name.startsWith("Ravi"));
const detail = (await req("GET", `/connections/${ravi.id}`)).data as any;
console.info("ravi ledger rows", detail.ledger.length, "top", detail.ledger[0]);
const loans = (await req("GET", "/loans")).data as any;
for (const l of loans.loans) console.info(l.title, l.summary);
const l1 = (await req("GET", `/loans/${loans.loans[0].id}`)).data as any;
console.info(
  "events",
  l1.events.map((e: any) => [e.date, e.kind, e.amount, e.elapsed, e.interest]),
  l1.byYear,
  l1.upcoming.slice(0, 2),
);
const act = (await req("GET", "/activity")).data as any[];
console.info("activity", act.length);
// CRUD round trip
const c = (
  await req("POST", "/connections", { name: "Smoke Test", relation: "other" })
).data as any;
const en = await req("POST", "/entries", {
  connectionId: c.id,
  type: "gave",
  amount: 1234.5,
  date: "2026-10-01",
  reason: "test",
  mode: "upi",
});
console.info(en.message);
const ln = await req("POST", "/loans", {
  connectionId: c.id,
  direction: "lent",
  interestType: "simple",
  ratePercent: 2,
  ratePeriod: "month",
  basis: "days",
  amount: 10000,
  date: "2026-08-01",
  mode: "cash",
});
console.info(ln.message);
const lid = (ln.data as any).id;
console.info(
  (
    await req("POST", `/loans/${lid}/events`, {
      kind: "interest",
      amount: 200,
      date: "2026-09-01",
      mode: "upi",
    })
  ).message,
);
console.info(
  (await req("POST", `/loans/${lid}/close`, { date: "2026-09-30" })).message,
);
const lsum = (await req("GET", `/loans/${lid}`)).data as any;
console.info(
  "closed loan",
  lsum.status,
  lsum.summary.accrued,
  lsum.summary.interestDue,
);
const owner = (await req("GET", `/connections/${c.id}`)).data as any;
console.info("smoke conn", owner.summary);
console.info((await req("DELETE", `/connections/${c.id}`)).message);
console.info((await req("GET", "/connections/999999")).message);

/* ---------- usernames, admin, sharing ---------- */
const check = (label: string, cond: boolean) => {
  console.info(`${cond ? "✓" : "✗ FAIL"} ${label}`);
  if (!cond) process.exitCode = 1;
};
cookie = "";
check(
  "username available",
  (await req("GET", "/auth/username-available?username=Smoke_1")).data
    .available === true,
);
check(
  "username taken",
  (await req("GET", "/auth/username-available?username=demo")).data
    .available === false,
);
check(
  "reserved username",
  (await req("GET", "/auth/username-available?username=admin")).data
    .available === false,
);
check(
  "dup username on register → 409",
  (
    await req("POST", "/auth/register/send-otp", {
      name: "Smoke",
      email: "smoke@khataconnect.local",
      username: "ravi",
    })
  ).success === false,
);
await req("POST", "/auth/register/send-otp", {
  name: "Smoke",
  email: "smoke@khataconnect.local",
  username: "Smoke_1",
});
const reg = await req("POST", "/auth/register/verify", {
  name: "Smoke",
  email: "smoke@khataconnect.local",
  username: "Smoke_1",
  otp: "123456",
  password: "Smoke@1234",
});
check("register stores lowercase username", reg.data?.username === "smoke_1");
check("login by username", (await login("smoke_1", "Smoke@1234")).success);
check("login by @Username", (await login("@SMOKE_1", "Smoke@1234")).success);
check(
  "login by email",
  (await login("smoke@khataconnect.local", "Smoke@1234")).success,
);
check(
  "normal user → admin 403",
  (await req("GET", "/admin/stats")).success === false,
);
check(
  "lookup ravi",
  (await req("GET", "/users/lookup?username=ravi")).data?.name ===
    "Ravi Sharma",
);
check(
  "lookup unknown → 404",
  (await req("GET", "/users/lookup?username=nobody_here")).success === false,
);
check(
  "lookup self → 400",
  (await req("GET", "/users/lookup?username=smoke_1")).success === false,
);
const sc = (
  await req("POST", "/connections", { name: "Ravi", relation: "friend" })
).data;
await req("POST", "/entries", {
  connectionId: sc.id,
  type: "gave",
  amount: 1000,
  date: "2026-10-01",
  reason: "lent",
  mode: "cash",
});
await req("POST", "/loans", {
  connectionId: sc.id,
  direction: "lent",
  interestType: "simple",
  ratePercent: 1,
  ratePeriod: "month",
  basis: "months",
  amount: 5000,
  date: "2026-08-01",
  mode: "cash",
});
check(
  "invite @ravi",
  (await req("POST", `/connections/${sc.id}/link`, { username: "ravi" }))
    .success,
);
check(
  "second invite same pair → 409",
  (await req("POST", `/connections/${sc.id}/link`, { username: "ravi" }))
    .success === false,
);
const ownerView = (await req("GET", `/connections/${sc.id}`)).data;
check("owner sees pending link", ownerView.link?.status === "pending");
await login("ravi");
let sh = (await req("GET", "/shared")).data;
const inv = sh.invites.find((i: any) => i.ownerUsername === "smoke_1");
check("ravi has invite", !!inv);
check(
  "shared detail hidden before accept",
  (await req("GET", `/shared/${inv.id}`)).success === false,
);
check("accept", (await req("POST", `/shared/${inv.id}/accept`)).success);
const mirror = (await req("GET", `/shared/${inv.id}`)).data;
check(
  `mirrored net ${mirror.summary.net} = −${ownerView.summary.net}`,
  mirror.summary.net === -ownerView.summary.net,
);
check(
  "mirrored loan is borrowed",
  mirror.loans[0]?.direction === "borrowed" &&
    mirror.loans[0]?.connectionName === "Smoke",
);
check(
  "mirrored ledger flips",
  mirror.ledger[0].amount === -ownerView.ledger[0].amount,
);
const ml = (await req("GET", `/shared/${inv.id}/loans/${mirror.loans[0].id}`))
  .data;
check(
  "mirrored loan detail",
  ml.loan.direction === "borrowed" && ml.loan.events.length === 1,
);
sh = (await req("GET", "/shared")).data;
check("owed by ravi > 0", sh.totals.owedByYou > 0);
check(
  "demo seed link visible to ravi",
  sh.shared.some((x: any) => x.ownerUsername === "demo"),
);
check("leave", (await req("DELETE", `/shared/${inv.id}`)).success);
await login("admin", "Admin@1234");
const stats = (await req("GET", "/admin/stats")).data;
check(
  `admin stats total=${stats?.total}`,
  stats?.total >= 4 && stats.signups.length === 12,
);
const created = await req("POST", "/admin/users", {
  name: "Made By Admin",
  email: "made@khataconnect.local",
  username: "made_by_admin",
  password: "Made@1234",
  role: "user",
});
check("admin creates user", created.success);
check(
  "admin dup username → 409",
  (
    await req("POST", "/admin/users", {
      name: "Second Try",
      email: "x2@khataconnect.local",
      username: "made_by_admin",
      password: "Made@1234",
      role: "user",
    })
  ).success === false,
);
const list = (await req("GET", "/admin/users?q=made")).data;
check("admin search", list.length === 1 && list[0].usage.people === 0);
check(
  "promote",
  (await req("PATCH", `/admin/users/${list[0].id}`, { role: "admin" })).success,
);
check(
  "delete user",
  (await req("DELETE", `/admin/users/${list[0].id}`)).success,
);
const smoke = (await req("GET", "/admin/users?q=smoke_1")).data[0];
check(
  "delete smoke user",
  (await req("DELETE", `/admin/users/${smoke.id}`)).success,
);
const me = (await req("GET", "/auth/me")).data;
check(
  "can't demote self",
  (await req("PATCH", `/admin/users/${me.id}`, { role: "user" })).success ===
    false,
);
process.exit();

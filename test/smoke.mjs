const API = "http://127.0.0.1:8099/api";
let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`${c ? "✓" : "✗ FAIL"}  ${m}`); };
const J = (h) => ({ "Content-Type": "application/json", ...h });
const call = async (m, p, body, token) => {
  const r = await fetch(API + p, { method: m, headers: J(token ? { authorization: "Bearer " + token } : {}), body: body ? JSON.stringify(body) : undefined });
  let d = null; try { d = await r.json(); } catch {}
  return { status: r.status, d };
};

const health = await call("GET", "/health");
ok(health.d?.ok === true, "health check");

const reg = await call("POST", "/auth/register", { schoolName: "Test PS", email: "gav@test.school", password: "secret123", name: "Gav" });
ok(reg.d?.token && reg.d?.user?.role === "admin", "register school + admin");
const T = reg.d.token;

const fac = await call("GET", "/factions", null, T);
ok(Array.isArray(fac.d) && fac.d.length === 2, "two factions seeded (Maroon/White)");
const maroon = fac.d.find(f => f.name === "Maroon").id;
const white = fac.d.find(f => f.name === "White").id;

const bulk = await call("POST", "/students/bulk", [
  { name: "Jack P", year_group: "Year 3", gender: "Boys", faction_id: maroon },
  { name: "Noah L", year_group: "Year 3", gender: "Boys", faction_id: white },
], T);
ok(bulk.d?.added === 2, "bulk add 2 students");
const students = (await call("GET", "/students", null, T)).d;
const jack = students.find(s => s.name === "Jack P").id;

await call("PUT", "/results", { year_group: "Year 3", gender: "Boys", place: 1, student_id: jack }, T);
await call("PUT", "/participation", { year_group: "Year 3", gender: "Boys", faction_id: white, count: 5 }, T);

const tally = (await call("GET", "/scoreboard/tally", null, T)).d;
const m = tally.find(t => t.name === "Maroon"), w = tally.find(t => t.name === "White");
ok(m.total === 10, `Maroon total = 10 (got ${m.total})`);
ok(w.total === 5, `White total = 5 from participation (got ${w.total})`);
ok(tally[0].name === "Maroon", "Maroon ranked first");

const champs = (await call("GET", "/scoreboard/champions", null, T)).d;
const c = champs.find(x => x.year_group === "Year 3" && x.gender === "Boys");
ok(c?.champion?.student_name === "Jack P", "Year 3 Boys champion = Jack P");

const quals = (await call("GET", "/scoreboard/qualifiers", null, T)).d;
ok(quals.cutoff === 6 && quals.rows.length === 1, "qualifiers list returns placed runner");

// tenant isolation
const reg2 = await call("POST", "/auth/register", { schoolName: "Other PS", email: "x@other.school", password: "secret123" });
const other = (await call("GET", "/students", null, reg2.d.token)).d;
ok(Array.isArray(other) && other.length === 0, "tenant isolation: other school sees 0 students");

// role enforcement
await call("POST", "/auth/users", { email: "v@test.school", password: "secret123", role: "viewer" }, T);
const vt = (await call("POST", "/auth/login", { email: "v@test.school", password: "secret123" })).d.token;
const blocked = await call("POST", "/students", { name: "X", year_group: "Year 3", gender: "Boys" }, vt);
ok(blocked.status === 403, `viewer blocked from adding students (got ${blocked.status})`);

// auth failures
ok((await call("POST", "/auth/login", { email: "gav@test.school", password: "WRONG" })).status === 401, "wrong password → 401");
ok((await call("GET", "/students")).status === 401, "no token → 401");

// robustness: malformed id must NOT crash the server
const badId = await call("PUT", "/results", { year_group: "Year 3", gender: "Boys", place: 1, student_id: "not-a-uuid" }, T);
ok(badId.status === 400, `malformed id → 400, server still alive (got ${badId.status})`);
ok((await call("GET", "/health")).d?.ok === true, "server still responding after bad input");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

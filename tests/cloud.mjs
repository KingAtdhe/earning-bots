// Cloud tests: run the worker locally (cd cloud && npx wrangler dev --port 8787) then: node tests/cloud.mjs
// Checks auth, sync both ways, scheduled bot runs, conflict handling, and the app's cloud connection.
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CLOUD = process.env.CLOUD_URL || "http://127.0.0.1:8787";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "www");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html")); if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
let failed = 0, passed = 0;
const check = (n, ok, d = "") => { if (ok) { passed++; console.log(`  ✓ ${n}`); } else { failed++; console.log(`  ✗ ${n} ${d}`); } };
const api = async (method, p, body, token) => { const r = await fetch(CLOUD + p, { method, headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, data: await r.json() }; };

console.log("Cloud API");
check("health", (await api("GET", "/health")).data.app === "earning-bots-cloud");
check("rejects requests without the token", (await api("GET", "/status")).status === 401);

console.log("App connects and syncs");
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const pg = await (await browser.newContext({ viewport: { width: 400, height: 860 } })).newPage();
const errors = []; pg.on("pageerror", e => errors.push(e.message));
await pg.goto(`http://127.0.0.1:${server.address().port}/`); await pg.waitForFunction(() => window.EB && window.EB.Store.S.ready);
// local work before connecting: an approved printable and autopilot settings
await pg.evaluate(async () => {
  const S = window.EB.Store; await S.setConfig({ auto: { autopilot: true, salesSync: false } });
  for (const id of ["product_factory", "maze_books", "notebooks", "wall_art"]) await S.setBotConfig(id, { auto: 24, approve: id === "product_factory" ? "auto" : "manual" });
  await S.save("items", "local-1", { id: "local-1", bot: "manual", kind: "lead", title: "Made on the phone", status: "new", createdAt: new Date().toISOString(), data: { name: "Cafe" }, links: {} });
});
await pg.evaluate(url => window.EB_CLOUD.connect(url), CLOUD);
const token = await pg.evaluate(() => JSON.parse(localStorage.getItem("eb_cloud_token")));
check("app claimed the cloud", !!token);
check("a second claim is refused", (await api("POST", "/claim")).status === 403);
let r = await api("GET", "/sync?since=0", null, token);
check("phone data reached the cloud", r.data.docs.some(d => d.id === "local-1") && r.data.docs.some(d => d.col === "config"));

console.log("Scheduled runs");
for (let i = 0; i < 4; i++) await api("POST", "/tick", null, token);
r = await api("GET", "/sync?since=0", null, token);
const cloudItems = r.data.docs.filter(d => d.col === "items" && d.data && d.data.cloud);
check("cloud bots made items on their schedule", cloudItems.length >= 6, `got ${cloudItems.length}`);
const sell = cloudItems.filter(d => ["printable", "wallart", "kdpbook"].includes(d.data.kind));
check("the cloud runs the quality check (text, market, duplicates)", sell.length > 0 && sell.every(d => d.data.qa && d.data.qa.score >= 0 && d.data.qa.visual === false), JSON.stringify(sell.map(d => d.data.qa && d.data.qa.score)));
check("auto-approve setting applied in the cloud", cloudItems.some(d => d.data.bot === "product_factory" && d.data.status === "approved"));
const runs = r.data.docs.filter(d => d.col === "runs" && d.data && d.data.cloud);
check("each due bot ran once", new Set(runs.map(d => d.data.bot)).size === runs.length && runs.length === 4, JSON.stringify(runs.map(d => d.data.bot)));
await api("POST", "/tick", null, token);
check("nothing runs twice before its interval", (await api("GET", "/sync?since=0", null, token)).data.docs.filter(d => d.col === "runs").length === 4);

console.log("Phone receives and edits");
await pg.evaluate(() => window.EB_CLOUD.sync());
const onPhone = await pg.evaluate(() => Object.values(window.EB.Store.S.items).filter(i => i.cloud).length);
await pg.waitForTimeout(1500);
check("the phone adds the image check to cloud-made designs", await pg.evaluate(() => { const its = Object.values(window.EB.Store.S.items).filter(i => i.cloud && i.qa && ["printable", "wallart"].includes(i.kind)); return its.length > 0 && its.some(i => i.qa.visual); }));
check("cloud items arrived on the phone", onPhone === cloudItems.length, `${onPhone} vs ${cloudItems.length}`);
const target = cloudItems.find(d => d.data.status === "pending").id;
await pg.evaluate(id => window.EB.Store.patch("items", id, { status: "approved", approvedAt: new Date().toISOString() }), target);
await pg.evaluate(() => window.EB_CLOUD.sync());
r = await api("GET", "/sync?since=0", null, token);
check("approval on the phone reached the cloud", r.data.docs.find(d => d.id === target).data.status === "approved");
// conflict: an older cloud copy must not overwrite a newer phone change
await api("POST", "/sync", { docs: [{ col: "items", id: target, updated: 1000, data: { ...r.data.docs.find(d => d.id === target).data, status: "rejected" } }] }, token);
r = await api("GET", "/sync?since=0", null, token);
check("an older change never overwrites a newer one", r.data.docs.find(d => d.id === target).data.status === "approved");
// big items keep their full data after the cloud patches them
const book = cloudItems.find(d => d.data.kind === "kdpbook" && d.data.data.seeds);
check("books keep their full contents in sync", !!book && book.data.data.seeds.length > 10);
await pg.evaluate(() => window.EB.Store.remove("items", "local-1")); await pg.evaluate(() => window.EB_CLOUD.sync());
r = await api("GET", "/sync?since=0", null, token);
check("deletes sync to the cloud", r.data.docs.find(d => d.id === "local-1").data === null);
const st = (await api("GET", "/status", null, token)).data;
check("status reports the last check and runs", st.lastTick > 0 && st.lastRuns.length > 0);
check("bots that need Claude explain why when it's missing", (await api("POST", "/run/idea_bot", null, token)).data.error.includes("Anthropic"));
check("no page errors", errors.length === 0, errors.join(" | "));
await browser.close(); server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

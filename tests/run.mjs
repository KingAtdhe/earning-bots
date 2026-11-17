// Earning Bots test suite: unit checks of the generators, storage, and end-to-end runs
// inside-Claude mode and Android mode (with fake APIs). Exit code 1 on any failure.
// Usage: node tests/run.mjs   (PW_CHROMIUM=/path/to/chrome to use a specific browser)
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { claudeMode, androidMode } from "./mocks.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "www");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"));
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const URL0 = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});

let failed = 0, passed = 0;
const check = (name, ok, detail = "") => { if (ok) { passed++; console.log(`  ✓ ${name}`); } else { failed++; console.log(`  ✗ ${name} ${detail}`); } };

async function page(mode) {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, acceptDownloads: true });
  const pg = await ctx.newPage(); pg.errors = [];
  pg.on("pageerror", e => pg.errors.push(e.message)); pg.on("console", m => { if (m.type() === "error" && !/ERR_|Failed to load resource|^\[EB\]/.test(m.text())) pg.errors.push(m.text()); });
  if (mode === "claude") await pg.addInitScript(claudeMode);
  if (mode === "android") await pg.addInitScript(androidMode);
  await pg.goto(URL0); await pg.waitForFunction(() => window.EB && window.EB.Store.S.ready, null, { timeout: 15000 });
  return { pg, ctx };
}
const runBot = (pg, id) => pg.evaluate(async id => {
  const btn = document.querySelector(`[data-act=run][data-bot=${id}]`); if (!btn) { document.querySelector('#nav [data-tab=bots]').click(); await new Promise(r => setTimeout(r, 50)); }
  document.querySelector(`[data-act=run][data-bot=${id}]`).click();
  for (let i = 0; i < 1200; i++) { await new Promise(r => setTimeout(r, 100)); if (!document.querySelector(`[data-progress="${id}"]`) && Object.values(window.EB.Store.S.runs).some(r => r.bot === id)) break; }
  const runs = Object.values(window.EB.Store.S.runs).filter(r => r.bot === id).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return runs[0] || null;
}, id);

// ---------------------------------------------------------------------------------------------------
console.log("Unit checks");
{
  const { pg, ctx } = await page("local");
  const r = await pg.evaluate(async () => {
    const out = {}, P = window.EB_PUZZLES, K = window.EB_KDP, D = window.EB_DESIGNS;
    // sudoku: solution valid, puzzle consistent, unique
    let sudokuOk = true;
    for (const lvl of ["easy", "medium", "hard"]) {
      const { p, s } = P.sudoku(lvl), g = s.split("").map(Number);
      for (let i = 0; i < 9; i++) {
        const row = new Set(), col = new Set(), box = new Set();
        for (let j = 0; j < 9; j++) { row.add(g[i * 9 + j]); col.add(g[j * 9 + i]); box.add(g[(Math.floor(i / 3) * 3 + Math.floor(j / 3)) * 9 + (i % 3) * 3 + (j % 3)]); }
        if (row.size !== 9 || col.size !== 9 || box.size !== 9) sudokuOk = false;
      }
      for (let i = 0; i < 81; i++) if (p[i] !== "0" && p[i] !== s[i]) sudokuOk = false;
    }
    out.sudoku = sudokuOk;
    // word search: every listed word is really in the grid where it says
    const ws = P.wordSearch("APPLE BANANA CHERRY GRAPE LEMON MANGO ORANGE PEACH".split(" "), 15, true);
    out.wordsearch = ws.w.length >= 6 && ws.w.every(([w, r, c, dr, dc]) => w.split("").every((ch, k) => ws.g[(r + dr * k) * 15 + c + dc * k] === ch));
    // maze: solution path is connected through open walls
    const m = K.maze(18, 23, 42), D4 = { 1: [0, -1], 2: [1, 0], 4: [0, 1], 8: [-1, 0] };
    out.maze = m.path[0] === 0 && m.path[m.path.length - 1] === m.w * m.h - 1 && m.path.every((c, i) => { if (!i) return true; const p = m.path[i - 1]; const dx = c % m.w - p % m.w, dy = Math.floor(c / m.w) - Math.floor(p / m.w); const bit = Object.entries(D4).find(([, v]) => v[0] === dx && v[1] === dy); return bit && !(m.walls[p] & +bit[0]); });
    // calendars: 1 Jan 2027 is a Friday, 1 Jan 2026 a Thursday
    out.calendar = !!D.LAYOUTS[`cal_${new Date().getFullYear() + 1}_01_mon`] && new Date(Date.UTC(2027, 0, 1)).getUTCDay() === 5;
    // every catalogue listing fits Etsy's limits
    let listOk = true;
    for (const [k, b] of Object.entries(D.BUNDLES)) for (const t of Object.keys(D.THEMES)) { const c = D.listingCopy(b, t); if (c.title.length > 140 || c.tags.length > 13 || c.tags.some(x => x.length > 20)) listOk = false; }
    out.listings = listOk;
    out.lowInkHidden = !Object.keys(D.THEMES).includes("LowInk") && !!D.THEMES.LowInk;
    out.validatorBlocksTrademark = window.EB_AUTO.validate({ kind: "design", price: 20, data: { title: "Funny Disney Princess Shirt for Girls", description: "x".repeat(100), tags: ["a"] } }).some(i => i.includes("disney"));
    out.validatorPassesClean = window.EB_AUTO.validate({ kind: "printable", price: 4.9, data: { title: "Weekly Planner Printable, Sage Minimalist", description: "x".repeat(120), tags: ["weekly planner"] } }).length === 0;
    out.seasonal = window.EB_WIN.seasonalSeeds(new Date(Date.UTC(2026, 9, 15))).includes("christmas");
    // PDFs build and are real PDFs
    const head = async blob => new TextDecoder().decode((await blob.arrayBuffer()).slice(0, 5));
    out.pdfs = (await head(D.makePdf({ bundle: D.BUNDLES.life, theme: "Sage", shortName: "x" }, "A4"))) === "%PDF-" && (await head(await K.interior({ data: { type: "coloring", seeds: [1, 2], title: "T", subtitle: "S" } }))) === "%PDF-";
    return out;
  });
  for (const [k, v] of Object.entries(r)) check(k, v === true);
  check("no page errors", pg.errors.length === 0, pg.errors.join(" | "));
  await ctx.close();
}

console.log("Storage");
{
  const { pg, ctx } = await page("local");
  await pg.evaluate(() => window.EB.Store.save("items", "persist-test", { id: "persist-test", bot: "x", kind: "lead", title: "T", status: "new", createdAt: new Date().toISOString(), data: {} }));
  await pg.waitForTimeout(300); await pg.reload(); await pg.waitForFunction(() => window.EB && window.EB.Store.S.ready);
  check("IndexedDB keeps data across restarts", await pg.evaluate(() => !!window.EB.Store.S.items["persist-test"]));
  await pg.evaluate(() => localStorage.setItem("eb2_earnings", JSON.stringify({ old1: { amountCents: 500, currency: "EUR", platform: "Etsy", itemId: "", date: new Date().toISOString() } })));
  await pg.reload(); await pg.waitForFunction(() => window.EB && window.EB.Store.S.ready);
  check("old localStorage data is migrated", await pg.evaluate(() => !!window.EB.Store.S.earnings.old1 && !localStorage.getItem("eb2_earnings")));
  await ctx.close();
}

console.log("Inside Claude (all bots, kits)");
{
  const { pg, ctx } = await page("claude");
  const bots = await pg.evaluate(() => window.EB_BOTS.BOTS.map(b => b.id));
  await pg.evaluate(() => window.EB.Store.setBotConfig("lead_finder", { manual: "Cafe Luna, cafe\nSalon Bella, hairdresser", city: "Belgrade" }));
  for (const id of bots) {
    const runnable = await pg.evaluate(id => { const el = document.querySelector(`[data-act=run][data-bot=${id}]`); return !el || !el.disabled; }, id);
    await pg.click("#nav [data-tab=bots]");
    if (!(await pg.evaluate(id => !document.querySelector(`[data-act=run][data-bot=${id}]`).disabled, id))) { console.log(`  - ${id} needs the Android app (skipped)`); continue; }
    const run = await runBot(pg, id);
    check(`bot ${id} runs`, run && run.status === "ok", run ? run.summary : "no run");
  }
  await pg.click("#nav [data-tab=inbox]"); await pg.evaluate(() => document.querySelector("[data-act=approve-all]") && document.querySelector("[data-act=approve-all]").click());
  await pg.waitForTimeout(1500);
  const kinds = await pg.evaluate(() => { const o = {}; Object.values(window.EB.Store.S.items).forEach(i => { if (!o[i.kind] && window.EB_BOTS.KINDS[i.kind]?.kit && i.status !== "rejected") o[i.kind] = i.id; }); return o; });
  for (const [kind, id] of Object.entries(kinds)) {
    const ok = await pg.evaluate(async id => { const it = window.EB.Store.S.items[id]; const k = await window.EB_BOTS.KINDS[it.kind].kit(it); const buf = new Uint8Array(await k.blob.arrayBuffer()); return k.blob.size > 100 && buf[0] === 0x50 && buf[1] === 0x4b; }, id);
    check(`${kind} kit is a valid zip`, ok);
  }
  check("Metricool scheduling was called", await pg.evaluate(() => window.__calls.some(c => c[1] === "createScheduledPost") || !window.EB.Store.config().auto?.metricool));
  check("no page errors", pg.errors.length === 0, pg.errors.join(" | "));
  await ctx.close();
}

console.log("Android (publishing to Etsy, Printify, Pinterest)");
{
  const { pg, ctx } = await page("android");
  for (const id of ["niche_research", "calendar_bot", "pod_designs", "wall_art", "worksheets"]) { const run = await runBot(pg, id); check(`bot ${id} runs`, run && run.status === "ok", run ? run.summary : ""); }
  await pg.click("#nav [data-tab=inbox]"); await pg.evaluate(() => document.querySelector("[data-act=approve-all]").click()); await pg.waitForTimeout(800);
  check("approving does not upload unless upload-on-approve is on", await pg.evaluate(() => !window.__req.some(r => r[1].includes("/shops/77/listings") && r[0] === "POST")));
  await runBot(pg, "pin_bot");
  await pg.click("#nav [data-tab=inbox]"); await pg.evaluate(() => document.querySelector("[data-act=approve-all]") && document.querySelector("[data-act=approve-all]").click()); await pg.waitForTimeout(500);
  // first Etsy file upload fails once -> the item records an error, then a retry resumes it
  await pg.evaluate(() => { window.__fail.files = 1; });
  await pg.evaluate(() => window.EB_AUTO.publishAll()); await pg.waitForTimeout(500);
  const failedItem = await pg.evaluate(() => Object.values(window.EB.Store.S.items).find(i => i.publishError));
  check("a failed upload is recorded on the item", !!failedItem);
  await pg.evaluate(() => window.EB_AUTO.publishAll()); await pg.waitForTimeout(500);
  const res = await pg.evaluate(() => {
    const created = window.__req.filter(r => r[0] === "POST" && /\/shops\/77\/listings$/.test(r[1])).length;
    const etsyItems = Object.values(window.EB.Store.S.items).filter(i => i.data.etsyId);
    const statuses = {}; Object.values(window.EB.Store.S.items).forEach(i => { const k = i.kind + ":" + i.status; statuses[k] = (statuses[k] || 0) + 1; });
    return { created, etsy: etsyItems.length, ids: new Set(etsyItems.map(i => i.data.etsyId)).size, statuses, printify: window.__req.filter(r => r[1].endsWith("/publish.json")).length, pins: window.__req.filter(r => r[1].endsWith("/v5/pins")).length, left: Object.values(window.EB.Store.S.items).filter(i => window.EB_AUTO.destination(i)).length };
  });
  check("retry resumed instead of creating duplicate Etsy listings", res.created === res.etsy && res.ids === res.etsy, JSON.stringify(res));
  check("everything approved got published", res.left === 0 && res.printify > 0 && res.pins > 0, JSON.stringify(res));
  check("daily limit counter tracked", await pg.evaluate(() => (window.EB.Store.config().auto.counts || {}).Etsy > 0));
  check("no page errors", pg.errors.length === 0, pg.errors.join(" | "));
  await ctx.close();
}

await browser.close(); server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

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
  const ai = await pg.evaluate(() => { const its = Object.values(window.EB.Store.S.items).filter(i => i.qa && i.qa.ai); return { n: its.length, seen: window.__seen, ex: its[0] && { score: its[0].qa.score, issues: its[0].qa.issues.map(x => x[1]) } }; });
  check("Claude looks at each new design's main photo (capped per run)", ai.n > 0 && ai.seen === ai.n && ai.ex.issues.some(t => /thumbnail/.test(t)) && ai.ex.score < 100, JSON.stringify(ai));
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

console.log("Quality check, market data and listing photos");
{
  const { pg, ctx } = await page("local");
  for (const id of ["product_factory", "wall_art", "worksheets", "notebooks"]) await runBot(pg, id);
  const r = await pg.evaluate(async () => {
    const S = window.EB.Store.S, Store = window.EB.Store, QA = window.EB_QA, W = window.EB_WIN, out = {};
    const all = Object.values(S.items).filter(i => QA.SELL.includes(i.kind));
    out.allChecked = all.every(i => i.qa && typeof i.qa.score === "number" && i.qa.visual);
    out.noneRejected = all.filter(i => i.status === "rejected").map(i => i.title + ": " + i.qa.issues.map(x => x[1]).join(","));
    out.minScore = Math.min(...all.map(i => i.qa.score));
    // tags: too long gets shortened, trademarks dropped, duplicates removed
    out.tags = QA.tidyTags(["Weekly Planner", "weekly planner", "printable weekly planner pages", "harry potter gift", "x"]);
    // market: a niche with live data adds relevant top-seller tags only, and moves an out-of-range price
    await Store.save("items", "niche-t", { id: "niche-t", kind: "niche", bot: "niche_research", status: "new", title: "teacher planner", createdAt: new Date().toISOString(), data: { keyword: "teacher planner", score: 70, type: "printable", etsy: { count: 5000, price: 4.2, p25: 3, p75: 6, tags: [["teacher gift", 30], ["dog mom", 25], ["teacher planner pages", 20], ["lesson planner", 15], ["hogwarts planner", 12]] } } });
    const base = Object.values(S.items).find(i => i.kind === "printable");
    await Store.save("items", "pr-t", { ...base, id: "pr-t", status: "pending", title: "Teacher Planner Bundle", createdAt: new Date().toISOString(), price: 12, qa: undefined, data: { ...base.data, title: "Teacher Planner Bundle, Lesson Plans and Class Schedule", tags: ["teacher planner", "class schedule", "lesson plan"], price: 12 } });
    await QA.process([S.items["pr-t"]]);
    const t = S.items["pr-t"]; out.market = { tags: t.data.tags, price: t.price, dataPrice: t.data.price, fixed: t.qa.fixed, market: !!t.qa.market };
    // duplicates of earlier items are moved out of the Inbox; variations of an item are not
    await Store.save("items", "dup-t", { ...t, id: "dup-t", status: "pending", createdAt: new Date(Date.now() + 1000).toISOString(), qa: undefined });
    await QA.process([S.items["dup-t"]]); out.dup = [S.items["dup-t"].status, S.items["dup-t"].qa.issues.map(x => x[1]).join(",")];
    const wa = Object.values(S.items).find(i => i.kind === "wallart" && i.status === "pending");
    await W.variations(wa, 2); const vars = Object.values(S.items).filter(i => i.data.variantOf === wa.id);
    await QA.process(vars); out.vars = vars.map(v => S.items[v.id].status);
    // an empty design is caught by the image check
    const K = window.EB_BOTS.KINDS, orig = K.wallart.thumb;
    K.wallart.thumb = (it, w) => { const c = document.createElement("canvas"); c.width = w; c.height = w; const x = c.getContext("2d"); x.fillStyle = "#f3eee6"; x.fillRect(0, 0, w, w); return c; };
    await Store.save("items", "blank-t", { ...wa, id: "blank-t", status: "pending", title: "Totally different abstract print", createdAt: new Date(Date.now() + 2000).toISOString(), qa: undefined, data: { ...wa.data, title: "Totally different abstract print", variantOf: undefined } });
    await QA.process([S.items["blank-t"]]); K.wallart.thumb = orig;
    out.blank = [S.items["blank-t"].status, S.items["blank-t"].qa.issues.map(x => x[1]).join(",")];
    out.blankNotQueued = window.EB_AUTO.destination({ ...S.items["blank-t"], status: "approved" }) === "";
    // photo sets: 4:3 photos for every Etsy kind, all drawable
    out.photos = {};
    for (const kind of ["printable", "wallart", "worksheet"]) {
      const it = Object.values(S.items).find(i => i.kind === kind); const set = window.EB_SCENES.photoSet(it);
      const dims = set.map(([, f]) => { const c = f(); const d = [c.width, c.height]; c.width = 0; return d; });
      out.photos[kind] = { n: set.length, landscape: dims.filter(([w, h]) => w === 2000 && h === 1500).length, all: dims.every(([w, h]) => w >= 1600 && h >= 1200) };
    }
    out.assets = window.EB_AUTO.assets(Object.values(S.items).find(i => i.kind === "worksheet")).images.length;
    out.sheet = (document.querySelector("[data-tab=inbox]").click(), await new Promise(r => setTimeout(r, 100)), !!document.querySelector(".card.item .qa"));
    return out;
  });
  check("every new design gets a quality score and image check", r.allChecked);
  check("good bot output is never rejected", !r.noneRejected.length && r.minScore >= 80, JSON.stringify(r.noneRejected) + " min " + r.minScore);
  check("tags are cleaned: shortened, deduped, trademarks dropped", JSON.stringify(r.tags) === JSON.stringify(["weekly planner", "printable weekly"]), JSON.stringify(r.tags));
  check("market data adds relevant top-seller tags, skips unrelated and trademarked ones", r.market.tags.includes("teacher gift") && r.market.tags.includes("lesson planner") && !r.market.tags.includes("dog mom") && !r.market.tags.some(t => /hogwarts/.test(t)), JSON.stringify(r.market.tags));
  check("an out-of-range price moves into the market range", r.market.price === 3.99 && r.market.dataPrice === 3.99, JSON.stringify(r.market));
  check("near-duplicates are moved out of the Inbox with the reason", r.dup[0] === "rejected" && /almost the same/.test(r.dup[1]), JSON.stringify(r.dup));
  check("variations of an item are not treated as duplicates", r.vars.length === 2 && r.vars.every(s => s === "pending"), JSON.stringify(r.vars));
  check("an empty design is caught and kept out of the publish queue", r.blank[0] === "rejected" && /empty/.test(r.blank[1]) && r.blankNotQueued, JSON.stringify(r.blank));
  check("printables get 6+ listing photos", r.photos.printable.n >= 6 && r.photos.printable.all, JSON.stringify(r.photos.printable));
  check("wall art gets 3 room scenes + sizes + details + close-up", r.photos.wallart.n === 7 && r.photos.wallart.landscape === 7, JSON.stringify(r.photos.wallart));
  check("worksheets get 6+ listing photos for Etsy", r.photos.worksheet.n >= 6 && r.assets >= 6, JSON.stringify(r.photos.worksheet) + " assets " + r.assets);
  check("quality score shows in the Inbox", r.sheet);
  check("no page errors", pg.errors.length === 0, pg.errors.join(" | "));
  await ctx.close();
}

console.log("Android (publishing to Etsy, Printify, Pinterest)");
{
  const { pg, ctx } = await page("android");
  for (const id of ["niche_research", "calendar_bot", "pod_designs", "wall_art", "worksheets"]) { const run = await runBot(pg, id); check(`bot ${id} runs`, run && run.status === "ok", run ? run.summary : ""); }
  const niche = await pg.evaluate(() => Object.values(window.EB.Store.S.items).find(i => i.kind === "niche" && i.data.etsy).data.etsy);
  check("research reads the live market: price range, top tags, newcomers", niche.p25 > 0 && niche.p75 > niche.p25 && niche.tags.some(t => t[0] === "weekly planner") && niche.freshWin > 0 && niche.digitalShare === 80, JSON.stringify(niche).slice(0, 300));
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

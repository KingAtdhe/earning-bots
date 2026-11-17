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
  await pg.evaluate(() => window.EB.Store.setConfig({ showManual: true })); // tests exercise every bot
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
  check("copies of the same design are moved out of the Inbox with the reason", r.dup[0] === "rejected" && /same design/.test(r.dup[1]), JSON.stringify(r.dup));
  check("variations of an item are not treated as duplicates", r.vars.length === 2 && r.vars.every(s => s === "pending"), JSON.stringify(r.vars));
  check("an empty design is caught and kept out of the publish queue", r.blank[0] === "rejected" && /empty/.test(r.blank[1]) && r.blankNotQueued, JSON.stringify(r.blank));
  check("printables get 6+ listing photos", r.photos.printable.n >= 6 && r.photos.printable.all, JSON.stringify(r.photos.printable));
  check("wall art gets 3 room scenes + sizes + details + close-up", r.photos.wallart.n === 7 && r.photos.wallart.landscape === 7, JSON.stringify(r.photos.wallart));
  check("worksheets get 6+ listing photos for Etsy", r.photos.worksheet.n >= 6 && r.assets >= 6, JSON.stringify(r.photos.worksheet) + " assets " + r.assets);
  check("quality score shows in the Inbox", r.sheet);
  check("no page errors", pg.errors.length === 0, pg.errors.join(" | "));
  await ctx.close();
}

console.log("New bots: digital planner, digital paper, party games, card decks; KDP covers; pins");
{
  const { pg, ctx } = await page("local");
  const runs = {};
  for (const id of ["planner_bot", "paper_bot", "party_bot", "cards_bot", "coloring_books", "notebooks", "wall_art"]) { const r = await runBot(pg, id); runs[id] = r && r.status; }
  check("the 4 new bots run without Claude", ["planner_bot", "paper_bot", "party_bot", "cards_bot"].every(id => runs[id] === "ok"), JSON.stringify(runs));
  const r = await pg.evaluate(async () => {
    const S = window.EB.Store.S, B3 = window.EB_BOTS3, out = {}, get = k => Object.values(S.items).find(i => i.kind === k);
    const kinds = ["dplanner", "paperpack", "partygame", "carddeck"];
    out.items = kinds.map(k => { const it = get(k); return it && { k, status: it.status, qa: it.qa && it.qa.score, issues: it.qa && it.qa.issues.map(x => x[1]), tags: it.data.tags.length, valid: window.EB_AUTO.validate(it) }; });
    const pl = get("dplanner"), plan = B3.plannerPlan(pl.data), pblob = await B3.plannerPdf(pl), ptxt = await pblob.text();
    out.planner = { pages: await B3.pdfPageCount(pblob), total: plan.total, weeks: plan.weeks.length, links: (ptxt.match(/\/Subtype \/Link/g) || []).length };
    const pa = get("partygame"); out.party = await B3.pdfPageCount(await B3.partyPdf(pa));
    const dk = get("carddeck"); out.deck = [await B3.pdfPageCount(await B3.deckPdf(dk)), 2 + Math.ceil(dk.data.cards.length / 9)];
    const pp = get("paperpack"), files = B3.etsyFiles(pp), z = await files[0][1](), zz = await window.JSZip.loadAsync(z);
    out.paper = { files: files.length, mb: z.size / 1048576, inZip: Object.keys(zz.files).length, license: !!zz.files["LICENSE.txt"] };
    out.photos = {}; out.assets = {};
    for (const k of kinds) {
      const it = get(k), set = window.EB_SCENES.photoSet(it), dims = set.map(([, f]) => { const c = f(); const d = [c.width, c.height]; c.width = 0; return d; });
      out.photos[k] = { n: set.length, ok: dims.every(([w, h]) => w === 2000 && h === 1500) };
      const a = window.EB_AUTO.assets(it); out.assets[k] = [a.images.length, a.files.length];
    }
    // KDP: print-ready full cover sized from the real page count
    const nbk = Object.values(S.items).find(i => i.kind === "kdpbook" && i.data.type === "notebook"), cbk = Object.values(S.items).find(i => i.kind === "kdpbook" && i.data.type === "coloring");
    const fc = await B3.kdpCoverFiles(nbk, await window.EB_KDP.interior(nbk)), fc2 = await B3.kdpCoverFiles(cbk, await window.EB_KDP.interior(cbk));
    const box = async b => { const t = await b.text(), m = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(t); return [Math.round(m[1] / 72 * 1000) / 1000, Math.round(m[2] / 72 * 1000) / 1000]; };
    out.kdp = { nb: [fc.pages, ...(await box(fc.blob))], col: [fc2.pages, ...(await box(fc2.blob))] };
    // pins: three layouts, lifestyle photo inside
    const wa = get("wallart"); out.pins = [0, 1, 2].map(l => { const pin = { kind: "pin", data: { sourceId: wa.id, headline: "Test", kicker: "Wall art", cta: "SHOP NOW", palette: l, layout: l } }; const c = window.EB_BOTS.KINDS.pin.thumb(pin, 500); return [c.width, c.height]; });
    out.shirtStyles = window.EB_MEDIA.STYLES.length;
    return out;
  });
  check("new products pass the quality check and listing rules", r.items.every(i => i && i.status === "pending" && i.qa >= 80 && i.tags === 13 && !i.valid.length), JSON.stringify(r.items));
  check("digital planner: every page built, 52-53 weeks, hyperlinked", r.planner.pages === r.planner.total && r.planner.weeks >= 52 && r.planner.links > r.planner.pages * 14, JSON.stringify(r.planner));
  check("party games PDF has all 23 pages", r.party === 23, String(r.party));
  check("card deck PDF: instructions, card pages and backs", r.deck[0] === r.deck[1], JSON.stringify(r.deck));
  check("digital paper: 2 ZIPs of 6 patterns + license, under Etsy's 20 MB", r.paper.files === 2 && r.paper.inZip === 7 && r.paper.license && r.paper.mb < 20, JSON.stringify(r.paper));
  check("every new product gets 5+ listing photos in 4:3", Object.values(r.photos).every(p => p.n >= 5 && p.ok), JSON.stringify(r.photos));
  check("every new product is ready for Etsy upload (photos + files)", Object.values(r.assets).every(([i, f]) => i >= 5 && f >= 1), JSON.stringify(r.assets));
  const near = (a, b) => Math.abs(a - b) < 0.002;
  check("KDP full cover matches KDP's size formula (trim x2 + spine + bleed)", near(r.kdp.nb[1], 12 + r.kdp.nb[0] * 0.002252 + 0.25) && near(r.kdp.nb[2], 9.25) && near(r.kdp.col[1], 17 + r.kdp.col[0] * 0.002252 + 0.25) && near(r.kdp.col[2], 11.25), JSON.stringify(r.kdp));
  check("pins come in 3 layouts at 2:3", r.pins.every(([w, h]) => w === 500 && h === 750), JSON.stringify(r.pins));
  check("7 shirt design styles", r.shirtStyles === 7);
  const vis = await pg.evaluate(async () => { await window.EB.Store.setConfig({ showManual: false }); document.querySelector("#nav [data-tab=home]").click(); await new Promise(r => setTimeout(r, 50)); document.querySelector("#nav [data-tab=bots]").click(); await new Promise(r => setTimeout(r, 100)); const ids = () => [...document.querySelectorAll("[data-act=run][data-bot]")].map(b => b.dataset.bot); const before = ids(); document.querySelector("[data-act=show-manual]").click(); await new Promise(r => setTimeout(r, 300)); const after = ids(); return { before, after }; });
  check("bots that need manual work are hidden; one tap shows them", !vis.before.includes("gig_bot") && !vis.before.includes("notebooks") && vis.before.includes("coloring_books") && vis.before.includes("planner_bot") && vis.after.includes("gig_bot"), JSON.stringify(vis));
  check("no page errors", pg.errors.length === 0, pg.errors.join(" | "));
  await ctx.close();
}

console.log("Android (publishing to Etsy, Printify, Pinterest)");
{
  const { pg, ctx } = await page("android");
  for (const id of ["niche_research", "calendar_bot", "pod_designs", "wall_art", "worksheets", "cards_bot"]) { const run = await runBot(pg, id); check(`bot ${id} runs`, run && run.status === "ok", run ? run.summary : ""); }
  const niche = await pg.evaluate(() => Object.values(window.EB.Store.S.items).find(i => i.kind === "niche" && i.data.etsy).data.etsy);
  check("research reads the live market: price range, top tags, newcomers", niche.p25 > 0 && niche.p75 > niche.p25 && niche.tags.some(t => t[0] === "weekly planner") && niche.freshWin > 0 && niche.digitalShare === 80, JSON.stringify(niche).slice(0, 300));
  await pg.evaluate(() => window.EB.Store.setConfig({ auto: { ...(window.EB.Store.config().auto || {}), etsyPublish: false } }));
  await pg.click("#nav [data-tab=inbox]"); await pg.evaluate(() => document.querySelector("[data-act=approve-all]").click()); await pg.waitForTimeout(800);
  check("with upload-on-approve switched off, approving only queues", await pg.evaluate(() => !window.__req.some(r => r[1].includes("/shops/77/listings") && r[0] === "POST")));
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
  // default: approving publishes straight away, and books go to Etsy as printables with their own listing
  await pg.evaluate(() => window.EB.Store.setConfig({ auto: { ...(window.EB.Store.config().auto || {}), etsyPublish: undefined } }));
  await runBot(pg, "coloring_books");
  const book = await pg.evaluate(async () => { const it = Object.values(window.EB.Store.S.items).find(i => i.kind === "kdpbook" && i.data.type === "coloring" && i.status === "pending"); await window.EB_AUTO.approve(it); const post = window.__req.filter(r => r[0] === "POST" && /\/shops\/77\/listings$/.test(r[1])).pop(); const f = window.EB.Store.S.items[it.id]; return { listed: f.status, etsyId: f.data.etsyId, body: String(post && post[2] || "") }; });
  check("approving publishes right away by default (coloring book as an Etsy printable)", book.listed === "listed" && !!book.etsyId, JSON.stringify(book).slice(0, 300));
  check("books use their own Etsy listing text and price, not the paperback's", /Printable/.test(decodeURIComponent(book.body.replace(/\+/g, " "))) && /price=4\.50/.test(book.body), book.body.slice(0, 300));
  // Listing Optimizer changes reach live Etsy listings
  const upd = await pg.evaluate(async () => { const it = Object.values(window.EB.Store.S.items).find(i => i.data.etsyId && i.kind === "printable"); await window.EB.Store.patch("items", it.id, { data: { ...it.data, title: it.data.title + " Updated", etsyNeedsUpdate: true } }); const n = await window.EB_AUTO.pushEtsyUpdates(); return [n, window.__req.some(r => r[0] === "PATCH" && r[1].includes(`/listings/${it.data.etsyId}`) && String(r[2]).includes("Updated"))]; });
  check("better titles and tags are pushed to live Etsy listings", upd[0] === 1 && upd[1], JSON.stringify(upd));
  await ctx.close();
}

await browser.close(); server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

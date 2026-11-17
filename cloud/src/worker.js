// Earning Bots cloud: runs the bots around the clock, syncs sales, and syncs everything with the app.
import { S, Store, Claude, Log, logs, writes } from "./env.js";
import "../../www/designs.js";
import "../../www/puzzles.js";
import "../../www/media.js";
import "../../www/bots.js";
import "../../www/kdp.js";
import "../../www/art.js";
import "../../www/bots2.js";
import "../../www/research.js";

const VERSION = "1.0";
const COLS = ["items", "earnings", "runs", "watches", "config"];
const { BOTS } = globalThis.EB_BOTS;
// bots that only make data or call APIs (no drawing). Sudoku books need more CPU than a request allows.
const CLOUD_BOTS = new Set(["niche_research", "product_factory", "calendar_bot", "idea_bot", "seo_optimizer", "maze_books", "coloring_books", "notebooks", "worksheets",
  "pod_designs", "wall_art", "content_bot", "pin_bot", "article_bot", "ebook_bot", "newsletter_bot", "social_poster", "lead_finder", "job_scanner", "gig_bot", "price_watch"]);
const BIG = ["puzzles", "chapters", "markdown"];

// ---- helpers ---------------------------------------------------------------------------------------
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "GET, POST, OPTIONS" } });
const sha = async s => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, "0")).join("");
const lite = data => { if (!data || !data.data) return data; const d = { ...data.data }; let cut = false; for (const k of BIG) if (k in d) { delete d[k]; cut = true; } return cut ? { ...data, data: d, _lite: true } : data; };
async function meta(env, key, value) {
  if (value === undefined) return (await env.DB.prepare("SELECT value FROM meta WHERE key = ?").bind(key).first())?.value ?? null;
  await env.DB.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, String(value)).run();
}
async function secrets(env) { const rows = (await env.DB.prepare("SELECT key, value FROM secrets").all()).results || []; return Object.fromEntries(rows.map(r => [r.key, JSON.parse(r.value)])); }
async function setSecret(env, key, value) { await env.DB.prepare("INSERT INTO secrets (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, JSON.stringify(value)).run(); }
async function log(env, level, msg) { Log.add(level, msg); }
async function flushLogs(env) {
  if (!logs.length) return;
  await env.DB.batch(logs.splice(0).map(l => env.DB.prepare("INSERT INTO log (t, level, msg) VALUES (?, ?, ?)").bind(l.t, l.level, l.msg)));
  await env.DB.prepare("DELETE FROM log WHERE t < ?").bind(Date.now() - 14 * 864e5).run();
}

// ---- documents --------------------------------------------------------------------------------------
async function upsert(env, rows) {
  // rows: [col, id, obj|null, updated]; newest write wins
  const stmts = rows.map(([col, id, obj, updated]) => env.DB.prepare(
    "INSERT INTO docs (col, id, data, lite, updated, deleted) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(col, id) DO UPDATE SET data = excluded.data, lite = excluded.lite, updated = excluded.updated, deleted = excluded.deleted WHERE excluded.updated > docs.updated")
    .bind(col, id, obj ? JSON.stringify(obj) : null, obj ? JSON.stringify(lite(obj)) : null, updated, obj ? 0 : 1));
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
}
async function loadState(env) {
  for (const c of COLS) S[c] = {};
  const rows = (await env.DB.prepare("SELECT col, id, lite FROM docs WHERE deleted = 0").all()).results || [];
  for (const r of rows) if (S[r.col]) S[r.col][r.id] = JSON.parse(r.lite);
  writes.clear();
}
async function flushWrites(env) {
  const rows = [];
  for (const [col, id, obj] of writes.values()) {
    if (obj && obj.__patch) { // trimmed item: merge the change into the full stored copy
      const row = await env.DB.prepare("SELECT data FROM docs WHERE col = ? AND id = ?").bind(col, id).first();
      if (!row || !row.data) continue;
      const full = JSON.parse(row.data), p = obj.__patch;
      const merged = { ...full, ...p, data: p.data ? { ...full.data, ...p.data } : full.data, _u: Date.now() }; delete merged._lite; delete merged.data._lite;
      rows.push([col, id, merged, merged._u]);
    } else rows.push([col, id, obj, obj ? obj._u : Date.now()]);
  }
  writes.clear();
  if (rows.length) await upsert(env, rows);
  return rows.length;
}

// ---- running bots ------------------------------------------------------------------------------------
function botCfg(bot) {
  const out = {}; (bot.settings || []).forEach(s => { out[s.key] = s.def; });
  Object.assign(out, Store.botConfig(bot.id));
  (bot.settings || []).forEach(s => { if (s.type === "number") out[s.key] = Math.min(s.max || 99, Math.max(s.min || 0, parseInt(out[s.key], 10) || s.def)); });
  return out;
}
function missing(bot) {
  if ((bot.needs || []).includes("claude") && !Claude.available()) return "needs your Anthropic key in the cloud";
  if (bot.watches && !Object.keys(S.watches).length) return "no products to watch";
  return "";
}
async function runBot(env, bot) {
  const started = new Date().toISOString(), ids = [], runId = `cloud-${Date.now().toString(36)}`;
  // record the attempt first: if the platform stops this run (time or memory limit), the next check
  // sees it and waits for the bot's interval instead of retrying the same failing run every 10 minutes
  const marker = { bot: bot.id, startedAt: started, status: "error", summary: "Stopped before finishing (cloud time limit?)", made: 0, cloud: true, _u: Date.now() };
  await upsert(env, [["runs", runId, marker, marker._u]]); S.runs[runId] = marker;
  const ctx = {
    cfg: botCfg(bot), progress() {},
    add: async (kind, title, data, o = {}) => { const id = o.id || `${kind}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`; ids.push(id); await Store.save("items", id, { id, bot: bot.id, kind, title: String(title).slice(0, 160), status: o.status || "pending", createdAt: new Date().toISOString(), price: o.price ?? null, data, links: {}, cloud: true }); },
  };
  let summary, status = "ok";
  try { summary = await bot.run(ctx); } catch (e) { status = "error"; summary = "Failed: " + (e.message || e); }
  if (status === "ok" && ids.length) { try { const extra = await gate(bot, ids); if (extra) summary += ` (${extra})`; } catch (e) { summary += ` (review skipped: ${e.message})`; } }
  await Store.save("runs", runId, { bot: bot.id, startedAt: started, finishedAt: new Date().toISOString(), status, summary, made: ids.length, cloud: true });
  await log(env, status === "ok" ? "info" : "error", `${bot.title}: ${summary}`);
  return { status, summary, made: ids.length };
}
// same quality gate as the app: never publishes, only approves (publishing always needs a person)
async function gate(bot, ids) {
  const mode = Store.botConfig(bot.id).approve || "manual";
  const pending = ids.map(id => S.items[id]).filter(i => i && i.status === "pending");
  if (!pending.length || mode === "manual") return "";
  const PIPE = ["lead", "opportunity", "deal", "niche"];
  const ok = async it => Store.patch("items", it.id, { status: PIPE.includes(it.kind) ? "new" : "approved", approvedAt: new Date().toISOString(), autoApproved: true });
  if (mode === "auto" || !Claude.available()) { for (const it of pending) await ok(it); return `${pending.length} auto-approved`; }
  const r = await Claude.json(`You are a strict quality reviewer for a seller who lists digital products and content on marketplaces. Score each item 1-10 for: clear and accurate title, no spelling mistakes, no trademark or brand names, no misleading claims, sensible price, and whether buyers would want it. Items: ${JSON.stringify(pending.map(i => ({ id: i.id, kind: i.kind, title: i.data.title || i.title, description: String(i.data.description || i.data.caption || i.data.text || "").slice(0, 600), tags: i.data.tags || i.data.hashtags, price: i.price })))}
Return a JSON array of {"id": "...", "score": number, "issue": "short reason if below 7, else empty"}.`);
  const scores = new Map((Array.isArray(r) ? r : []).map(x => [x.id, x])); let n = 0;
  for (const it of pending) { const s = scores.get(it.id); if (s && Number(s.score) >= 7) { await ok(it); n++; } else if (s) await Store.patch("items", it.id, { review: { score: Number(s.score) || 0, issue: String(s.issue || "").slice(0, 200) } }); }
  return `${n} auto-approved${pending.length - n ? `, ${pending.length - n} held for you` : ""}`;
}

// ---- sales sync -------------------------------------------------------------------------------------------
async function etsyToken(env, sec) {
  const e = sec.etsy; if (!e || !e.token) return null;
  if (e.token.expires_at - 60e3 > Date.now()) return e.token;
  const res = await fetch("https://api.etsy.com/v3/public/oauth/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", client_id: e.key, refresh_token: e.token.refresh_token }).toString() });
  const fresh = await res.json(); if (!res.ok) throw new Error("Etsy token refresh failed: " + (fresh.error_description || fresh.error || res.status));
  e.token = { ...e.token, ...fresh, expires_at: Date.now() + (fresh.expires_in || 3600) * 1000 };
  await setSecret(env, "etsy", e); return e.token;
}
async function etsyApi(sec, tok, path) {
  const res = await fetch("https://api.etsy.com/v3/application" + path, { headers: { "x-api-key": sec.etsy.secret ? `${sec.etsy.key}:${sec.etsy.secret}` : sec.etsy.key, Authorization: `Bearer ${tok.access_token}` } });
  const t = await res.text(); if (!res.ok) throw new Error(`Etsy ${res.status}: ${t.slice(0, 160)}`); return JSON.parse(t);
}
async function syncSales(env, sec) {
  const out = [];
  const byListing = {}; Object.values(S.items).forEach(i => { if (i.data && i.data.etsyId) byListing[i.data.etsyId] = i; });
  try {
    const tok = await etsyToken(env, sec);
    if (tok) {
      let added = 0;
      for (let off = 0; off < 300; off += 100) {
        const r = await etsyApi(sec, tok, `/shops/${tok.shop_id}/receipts?limit=100&offset=${off}&was_paid=true`);
        for (const rc of r.results || []) for (const tr of rc.transactions || []) {
          const key = "etsy-" + tr.transaction_id; if (S.earnings[key]) continue;
          const it = byListing[String(tr.listing_id)], pr = tr.price || {};
          await Store.save("earnings", key, { amountCents: Math.round((pr.amount || 0) * 100 / (pr.divisor || 100)) * (tr.quantity || 1), currency: pr.currency_code || "USD", platform: "Etsy", itemId: it ? it.id : "", bot: it ? it.bot : "", date: new Date((rc.created_timestamp || Date.now() / 1000) * 1000).toISOString(), note: tr.title || "" });
          added++;
        }
        if ((r.results || []).length < 100) break;
      }
      const l = await etsyApi(sec, tok, `/shops/${tok.shop_id}/listings?state=active&limit=100`);
      for (const x of l.results || []) { const it = byListing[String(x.listing_id)]; if (it) await Store.patch("items", it.id, { data: { ...it.data, stats: { views: x.views || 0, favorites: x.num_favorers || 0, at: new Date().toISOString() } } }); }
      out.push(`Etsy +${added}`);
    }
  } catch (e) { out.push("Etsy: " + e.message); }
  if (sec.gumroad) {
    try {
      const byName = {}; Object.values(S.items).forEach(i => { byName[(i.data && i.data.shortName) || i.title] = i; });
      let key = "", added = 0;
      for (let p = 0; p < 10; p++) {
        const r = await (await fetch(`https://api.gumroad.com/v2/sales?access_token=${encodeURIComponent(sec.gumroad)}${key ? "&page_key=" + encodeURIComponent(key) : ""}`)).json();
        for (const s of r.sales || []) { if (s.refunded || s.chargedback || S.earnings["gumroad-" + s.id]) continue; const it = byName[s.product_name];
          await Store.save("earnings", "gumroad-" + s.id, { amountCents: Number(s.price) || 0, currency: (s.currency || "usd").toUpperCase(), platform: "Gumroad", itemId: it ? it.id : "", bot: it ? it.bot : "", date: s.created_at || new Date().toISOString(), note: s.product_name }); added++; }
        if (!r.next_page_key) break; key = r.next_page_key;
      }
      out.push(`Gumroad +${added}`);
    } catch (e) { out.push("Gumroad: " + e.message); }
  }
  return out.join(" · ");
}

// ---- the schedule ------------------------------------------------------------------------------------------
async function tick(env, onlyBot) {
  await loadState(env);
  const sec = await secrets(env);
  Claude.key = sec.anthropic || ""; Claude.model = sec.model || "claude-sonnet-5-5";
  globalThis.EB_AUTO = { Etsy: { key: () => (sec.etsy ? (sec.etsy.secret ? `${sec.etsy.key}:${sec.etsy.secret}` : sec.etsy.key) : "") } }; // research uses the Etsy key for competition data
  const cfg = Store.config(), auto = cfg.auto || {}, now = Date.now(), done = [];
  const lastRun = id => Math.max(0, ...Object.values(S.runs).filter(r => r.bot === id).map(r => Date.parse(r.startedAt) || 0));
  if (onlyBot) {
    const bot = BOTS.find(b => b.id === onlyBot); if (!bot || !CLOUD_BOTS.has(bot.id)) throw new Error("This bot can't run in the cloud");
    const why = missing(bot); if (why) throw new Error(`${bot.title} ${why}`);
    done.push({ bot: bot.id, ...(await runBot(env, bot)) });
  } else if (auto.cloud !== false) {
    // run the most overdue bot (one per tick keeps each run small and reliable)
    const due = BOTS.filter(b => CLOUD_BOTS.has(b.id) && !Store.botConfig(b.id).disabled && parseFloat(Store.botConfig(b.id).auto || 0) > 0 && !missing(b))
      .map(b => ({ b, over: now - lastRun(b.id) - parseFloat(Store.botConfig(b.id).auto) * 3600e3 })).filter(x => x.over >= 0).sort((a, b) => b.over - a.over);
    if (due.length) done.push({ bot: due[0].b.id, ...(await runBot(env, due[0].b)) });
    const lastSync = Number(await meta(env, "last_sales_sync")) || 0;
    if (auto.salesSync && now - lastSync > 6 * 3600e3) { const r = await syncSales(env, sec); await meta(env, "last_sales_sync", now); await log(env, "info", "Sales sync: " + r); done.push({ sync: r }); }
  }
  const n = await flushWrites(env); await flushLogs(env);
  await meta(env, "last_tick", now);
  return { done, written: n };
}

// ---- HTTP API ------------------------------------------------------------------------------------------------
async function authed(req, env) {
  const h = req.headers.get("authorization") || ""; const tok = h.replace(/^Bearer\s+/i, "");
  const want = await meta(env, "token_hash"); return !!(tok && want && (await sha(tok)) === want);
}
export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url), p = url.pathname;
    if (req.method === "OPTIONS") return json({});
    try {
      if (p === "/" || p === "/health") return json({ ok: true, app: "earning-bots-cloud", version: VERSION, claimed: !!(await meta(env, "token_hash")) });
      if (p === "/claim" && req.method === "POST") {
        if (await meta(env, "token_hash")) return json({ error: "This cloud is already connected to an app. Reset it with the reset command in the README." }, 403);
        const token = [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, "0")).join("");
        await meta(env, "token_hash", await sha(token)); return json({ token });
      }
      if (!(await authed(req, env))) return json({ error: "Not authorized" }, 401);

      if (p === "/sync" && req.method === "GET") {
        const since = Number(url.searchParams.get("since") || 0), limit = 300;
        const rows = (await env.DB.prepare("SELECT col, id, data, updated, deleted FROM docs WHERE updated > ? ORDER BY updated LIMIT ?").bind(since, limit).all()).results || [];
        return json({ docs: rows.map(r => ({ col: r.col, id: r.id, updated: r.updated, data: r.deleted ? null : JSON.parse(r.data) })), more: rows.length === limit, now: Date.now() });
      }
      if (p === "/sync" && req.method === "POST") {
        const body = await req.json(), docs = (body.docs || []).filter(d => COLS.includes(d.col) && d.id);
        await upsert(env, docs.map(d => [d.col, String(d.id), d.data, Number(d.updated) || Date.now()]));
        return json({ ok: true, accepted: docs.length });
      }
      if (p === "/secrets" && req.method === "POST") {
        const body = await req.json(), cur = await secrets(env);
        for (const k of ["anthropic", "model", "gumroad"]) if (typeof body[k] === "string") await setSecret(env, k, body[k]);
        if (body.etsy && body.etsy.key) {
          const keepNewer = cur.etsy && cur.etsy.token && body.etsy.token && cur.etsy.token.expires_at > body.etsy.token.expires_at;
          await setSecret(env, "etsy", { ...body.etsy, token: keepNewer ? cur.etsy.token : body.etsy.token });
        }
        const s = await secrets(env); return json({ ok: true, have: { anthropic: !!s.anthropic, gumroad: !!s.gumroad, etsy: !!(s.etsy && s.etsy.token) } });
      }
      if (p === "/token/etsy") { // the cloud owns Etsy token refresh so the app and cloud never fight over it
        const sec = await secrets(env); const tok = await etsyToken(env, sec);
        return tok ? json({ token: tok }) : json({ error: "Etsy isn't connected in the cloud" }, 404);
      }
      if (p === "/status") {
        const s = await secrets(env);
        const lastRuns = ((await env.DB.prepare("SELECT data FROM docs WHERE col = 'runs' AND deleted = 0 ORDER BY updated DESC LIMIT 8").all()).results || []).map(r => JSON.parse(r.data)).filter(r => r.cloud);
        const logRows = (await env.DB.prepare("SELECT t, level, msg FROM log ORDER BY t DESC LIMIT 40").all()).results || [];
        return json({ version: VERSION, lastTick: Number(await meta(env, "last_tick")) || 0, lastSalesSync: Number(await meta(env, "last_sales_sync")) || 0, keys: { anthropic: !!s.anthropic, gumroad: !!s.gumroad, etsy: !!(s.etsy && s.etsy.token) }, cloudBots: [...CLOUD_BOTS], lastRuns, log: logRows });
      }
      if (p.startsWith("/run/") && req.method === "POST") return json(await tick(env, p.slice(5)));
      if (p === "/tick" && req.method === "POST") return json(await tick(env));
      if (p === "/sync-sales" && req.method === "POST") { await loadState(env); const r = await syncSales(env, await secrets(env)); await meta(env, "last_sales_sync", Date.now()); await flushWrites(env); return json({ result: r }); }
      return json({ error: "Not found" }, 404);
    } catch (e) {
      Log.add("error", `${p}: ${e.message}`); await flushLogs(env).catch(() => {});
      return json({ error: e.message }, 500);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(tick(env).catch(async e => { Log.add("error", "tick: " + (e.stack || e.message)); await flushLogs(env).catch(() => {}); }));
  },
};

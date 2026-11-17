/* Quality check for everything the bots make, before it reaches the Inbox or the publish queue.
   1. Fixes small things itself: tidy titles, clean and dedupe tags, tags that are too long.
   2. Market data: adds the tags top sellers use for the matching niche and moves an out-of-range price
      into the going range (from Niche Research's live Etsy data).
   3. Catches near-duplicates of earlier listings (Etsy ranks duplicate listings down).
   4. Looks at the main image: empty or washed-out designs are caught (phone only, the cloud can't draw).
   5. Optionally Claude looks at the main photo and scores it like a buyer would.
   The result is a 0-100 score with reasons, kept on the item as `qa`. */
(function () {
  "use strict";
  const { U, LS, Store, Claude, Log } = window.EB;
  const { KINDS } = window.EB_BOTS;
  const W = window.EB_WIN;
  const S = Store.S;
  const SELL = ["printable", "wallart", "worksheet", "design", "kdpbook", "puzzlebook", "ebook"];
  const VISUAL = ["printable", "wallart", "worksheet", "design", "kdpbook", "puzzlebook", "ebook"];
  const canDraw = () => typeof document !== "undefined" && !window.EB.IN_CLOUD && typeof document.createElement === "function";
  const settings = () => { try { return Store.config().auto || {}; } catch { return {}; } };

  // ---- 1. small fixes -----------------------------------------------------------------------------
  function tidyTitle(t) {
    let s = String(t || "").replace(/\s+/g, " ").replace(/\s*([|,])\s*(?=[|,])/g, "").trim();
    s = s.replace(/^[\s|,\-–]+|[\s|,\-–]+$/g, "");
    return s;
  }
  function fitTag(t) {
    t = String(t).toLowerCase().replace(/[^a-z0-9 '&-]/g, " ").replace(/\s+/g, " ").trim();
    if (t.length < 3) return "";
    if (t.length <= 20) return t;
    const w = t.split(" "); while (w.length > 1 && w.join(" ").length > 20) w.pop();
    return w.join(" ").length <= 20 && w.join(" ").length >= 4 ? w.join(" ") : "";
  }
  function tidyTags(tags) {
    const out = [];
    for (const t of tags || []) { const f = fitTag(t); if (f && !out.includes(f) && !W.hasTrademark(f)) out.push(f); }
    return out.slice(0, 13);
  }

  // ---- 3. duplicates ---------------------------------------------------------------------------------
  const tokens = s => new Set(W.words(s));
  function similarity(a, b) { const A = tokens(a), B = tokens(b); if (!A.size || !B.size) return 0; let n = 0; A.forEach(w => { if (B.has(w)) n++; }); return n / (A.size + B.size - n); }
  function duplicateOf(it) {
    const title = it.data.title || it.title;
    for (const o of Object.values(S.items)) {
      if (o.id === it.id || o.kind !== it.kind || o.status === "rejected" || o.createdAt > it.createdAt) continue;
      const ra = it.data.variantOf || it.id, rb = o.data.variantOf || o.id; if (ra === rb) continue; // its own variations
      if (similarity(title, o.data.title || o.title) >= 0.8) return o;
    }
    return null;
  }

  // ---- 4. image check --------------------------------------------------------------------------------
  // returns how much of the image is one colour, how much detail it has, and its tonal contrast
  function imageStats(cv) {
    const w = 160, h = Math.max(1, Math.round(160 * cv.height / cv.width)), c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(cv, 0, 0, w, h);
    const px = x.getImageData(0, 0, w, h).data, L = new Float32Array(w * h), hist = new Map();
    for (let i = 0, j = 0; i < px.length; i += 4, j++) {
      L[j] = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
      const key = (px[i] >> 4) << 8 | (px[i + 1] >> 4) << 4 | px[i + 2] >> 4; hist.set(key, (hist.get(key) || 0) + 1);
    }
    let mean = 0; for (const v of L) mean += v; mean /= L.length;
    let vr = 0, edges = 0; for (let j = 0; j < L.length; j++) { vr += (L[j] - mean) ** 2; const xx = j % w; if (xx < w - 1 && j + w < L.length && Math.abs(L[j] - L[j + 1]) + Math.abs(L[j] - L[j + w]) > 0.08) edges++; }
    c.width = 0;
    return { dominant: Math.max(...hist.values()) / L.length, contrast: Math.sqrt(vr / L.length), detail: edges / L.length };
  }
  function visualIssues(it) {
    const k = KINDS[it.kind]; if (!k || !k.thumb || !canDraw()) return null;
    const cv = k.thumb(it, 600), st = imageStats(cv), out = [];
    if (st.detail < 0.01 && st.dominant > 0.9) out.push(["hard", "the main image looks empty"]);
    else if (st.contrast < 0.05) out.push(["soft", "the main image looks washed out (low contrast)"]);
    else if (st.detail < (it.kind === "design" ? 0.008 : 0.02)) out.push(["soft", "the main image has very little in it"]); // shirt mockups are mostly plain fabric
    return { issues: out, stats: { dominant: Math.round(st.dominant * 100), contrast: Math.round(st.contrast * 100), detail: Math.round(st.detail * 1000) / 10 }, cv };
  }

  // ---- 5. Claude looks at the main photo -------------------------------------------------------------
  async function aiLook(it, cv) {
    if (settings().aiPhotoCheck === false || !(await Claude.canSee())) return null;
    const blob = await new Promise(r => cv.toBlob(r, "image/jpeg", 0.85));
    const d = it.data;
    const r = await Claude.vision(`You are an experienced Etsy seller judging a listing's main photo before it goes live. The product: "${d.title || it.title}" (${KINDS[it.kind]?.label || it.kind}).
Check: is any text cut off, overlapping or misspelled; is it readable at thumbnail size; does it look professional and appealing to a buyer; does the image match the title.
Return {"score": 1-10, "issues": [up to 3 short problems a seller should fix, empty if none]}.`, blob);
    if (!r || typeof r !== "object") return null;
    return { score: Math.max(1, Math.min(10, Number(r.score) || 5)), issues: (Array.isArray(r.issues) ? r.issues : []).map(s => U.clampStr(String(s), 140)).filter(Boolean).slice(0, 3) };
  }

  // ---- the check ---------------------------------------------------------------------------------------
  function scoreOf(issues, ai) {
    let sc = 100 - issues.filter(i => i[0] === "hard").length * 45 - issues.filter(i => i[0] === "soft").length * 10;
    if (ai) sc = Math.round(sc * 0.5 + ai.score * 5);
    return Math.max(0, Math.min(100, sc));
  }
  // text, market and duplicate checks: no drawing, so it also runs in the cloud
  async function prepare(it) {
    if (!SELL.includes(it.kind) || !it.data) return null;
    const d = { ...it.data }, fixed = [], issues = [];
    const t0 = d.title || it.title, t1 = tidyTitle(t0);
    if (t1 && t1 !== t0) { d.title = t1; fixed.push("tidied the title"); }
    if (Array.isArray(d.tags)) {
      const before = d.tags.join("|"), tg = tidyTags(d.tags);
      if (tg.join("|") !== before) { d.tags = tg; fixed.push("cleaned the tags"); }
    }
    let price = it.price, market = null;
    const m = W.enrich({ ...it, data: d });
    if (m) {
      market = m.market; d.tags = m.tags;
      if (m.market.tagsAdded.length) fixed.push(`added ${m.market.tagsAdded.length} tag${m.market.tagsAdded.length > 1 ? "s" : ""} top sellers use for “${m.market.keyword}”`);
      if (m.price) { price = m.price; if ("price" in d) d.price = m.price; fixed.push(`price ${Number(m.market.priceFrom).toFixed(2)} → ${m.price.toFixed(2)} (most sellers charge ${m.market.p25}–${m.market.p75})`); }
    }
    const dup = duplicateOf({ ...it, data: d });
    if (dup) issues.push(["hard", `almost the same as “${U.clampStr(dup.data.title || dup.title, 60)}”, made earlier`]);
    if (Array.isArray(d.tags) && ["printable", "wallart", "worksheet", "design"].includes(it.kind) && d.tags.length < 13) issues.push(["soft", `uses ${d.tags.length} of Etsy's 13 tags`]);
    if (String(d.title || "").split(/\s+/).length > 20) issues.push(["soft", "the title is long; Etsy favours short, clear titles"]);
    const v = window.EB_AUTO && window.EB_AUTO.validate ? window.EB_AUTO.validate({ ...it, data: d, price }) : [];
    v.forEach(x => issues.push(["hard", x]));
    const qa = { score: scoreOf(issues), issues, fixed, market, visual: false, ai: null, at: U.now() };
    const patch = { data: { ...d, ...(it.data.etsyJob ? { etsyJob: it.data.etsyJob } : {}) }, qa };
    if (price !== it.price) patch.price = price;
    if (d.title && d.title !== it.title && it.title === t0) patch.title = d.title;
    await Store.patch("items", it.id, patch);
    return S.items[it.id];
  }
  // image checks (phone only), then the final verdict
  async function look(it, allowAi = true) {
    const qa = { ...(it.qa || { issues: [], fixed: [] }) };
    let vis = null; try { vis = visualIssues(it); } catch (e) { Log.add("warn", `Image check failed for ${it.id}: ${e.message}`); }
    if (!vis) return it;
    const issues = qa.issues.filter(i => !i[2]).concat(vis.issues.map(i => [i[0], i[1], "img"]));
    let ai = null;
    if (allowAi && !issues.some(i => i[0] === "hard")) { try { ai = await aiLook(it, vis.cv); } catch (e) { Log.add("warn", `Photo review skipped: ${e.message}`); } }
    try { vis.cv.width = 0; } catch { /* ignore */ }
    if (ai) ai.issues.forEach(s => issues.push(["soft", s, "ai"]));
    await Store.patch("items", it.id, { qa: { ...qa, issues, visual: true, image: vis.stats, ai, score: scoreOf(issues.filter(i => i[2] !== "ai"), ai), at: U.now() } });
    return S.items[it.id];
  }
  const blocked = it => !!(it.qa && it.qa.issues.some(i => i[0] === "hard"));

  // full pass on freshly made items. Clearly broken ones (duplicates, empty images) are moved out of the
  // Inbox to Rejected with the reason, so the Inbox only holds work worth a look.
  async function process(items, opts = {}) {
    const res = { checked: 0, rejected: 0, fixed: 0 }; let aiBudget = opts.aiBudget ?? 6;
    for (let it of items) {
      if (!it || !SELL.includes(it.kind) || it.status !== "pending") continue;
      it = await prepare(it); if (!it) continue; res.checked++;
      if (it.qa.fixed.length) res.fixed++;
      if (canDraw()) { it = await look(it, aiBudget > 0); if (it.qa.ai) aiBudget--; }
      if (blocked(it)) { await Store.patch("items", it.id, { status: "rejected", qa: { ...it.qa, autoRejected: true } }); res.rejected++; }
      await U.sleep(0);
    }
    return res;
  }
  // phone: items the cloud made (or older ones) get their image check here
  let busy = false;
  async function backfill(max = 12) {
    if (busy || !canDraw()) return 0; busy = true; let n = 0;
    try {
      const todo = Object.values(S.items).filter(i => VISUAL.includes(i.kind) && ["pending", "approved"].includes(i.status) && !(i.qa && i.qa.visual)).slice(0, max);
      for (let it of todo) {
        if (!it.qa) it = await prepare(it) || it;
        it = await look(it, false); n++;
        if (blocked(it)) await Store.patch("items", it.id, { status: it.status === "pending" ? "rejected" : "pending", qa: { ...it.qa, autoRejected: it.status === "pending" } });
        await U.sleep(30);
      }
    } finally { busy = false; }
    return n;
  }
  // used by approval: auto mode passes anything without a blocking problem; review mode needs 70+
  function passes(it, mode) { if (!it.qa) return true; if (blocked(it)) return false; return mode === "auto" ? it.qa.score >= 50 : it.qa.score >= 70; }

  function badge(it) {
    if (!it.qa) return "";
    const s = it.qa.score, cls = s >= 80 ? "good" : s >= 60 ? "ok" : "low";
    return `<span class="qa ${cls}" title="Quality check">${s}</span>`;
  }
  function sheetHtml(it) {
    const q = it.qa; if (!q) return "";
    const esc = U.esc || (s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])));
    const m = q.market;
    return `<div class="qabox"><div class="qahead">${badge(it)}<b>Quality check</b><span class="muted">${q.visual ? (q.ai ? "text, market, image and Claude's eye" : "text, market and image") : "text and market (image check runs on your phone)"}</span></div>
      ${q.issues.length ? `<ul class="qalist">${q.issues.map(i => `<li class="${i[0]}">${esc(i[1])}</li>`).join("")}</ul>` : `<p class="muted">No problems found.</p>`}
      ${q.fixed.length ? `<p class="muted">Fixed automatically: ${esc(q.fixed.join("; "))}.</p>` : ""}
      ${m ? `<p class="muted">Market “${esc(m.keyword)}”: ${m.competition ? Number(m.competition).toLocaleString() + " listings, " : ""}most priced ${m.p25}–${m.p75} (median ${m.median}).</p>` : ""}
      ${q.autoRejected ? `<p class="muted">Moved out of your Inbox because of the problem above. You can still approve it.</p>` : ""}</div>`;
  }

  window.EB_QA = { prepare, look, process, backfill, passes, blocked, badge, sheetHtml, imageStats, similarity, tidyTitle, tidyTags, SELL };
})();

/* Earning Bots: manager, worker bots, approvals and earnings.
   Runs in two places with the same code:
   - inside Claude (artifact): data in the artifact database, Idea Bot via Claude, files via downloads
   - Android app (Capacitor): data on the phone, Idea Bot via your Anthropic API key, files via the share sheet */
(function () {
  "use strict";
  const D = window.EB_DESIGNS;
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const now = () => new Date().toISOString();
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const money = obj => {
    const parts = Object.entries(obj || {}).filter(([, v]) => v).sort();
    return parts.length ? parts.map(([cur, c]) => `${(c / 100).toFixed(2)} ${cur}`).join(" + ") : "0.00";
  };

  const IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };

  // ---- state & storage --------------------------------------------------------

  const state = { products: {}, earnings: {}, runs: {}, ready: false, mode: "local", busy: {}, notice: "", tab: "bots" };
  let db = null, sample = null, downloads = null;

  const Store = {
    async save(col, id, obj) {
      state[col][id] = obj; render();
      if (db) {
        try { await db.doc(`${col}/${id}`).set(obj); }
        catch (e) { notify(e.code === "quota_exceeded" ? "Storage is full. Delete old runs or products." : "Couldn't save: " + (e.message || e.code)); }
      } else LS.set("eb_" + col, state[col]);
    },
    async remove(col, id) {
      delete state[col][id]; render();
      if (db) { try { await db.doc(`${col}/${id}`).delete(); } catch (e) { notify("Couldn't delete: " + (e.message || e.code)); } }
      else LS.set("eb_" + col, state[col]);
    },
  };

  function loadLocal() {
    for (const col of ["products", "earnings", "runs"]) state[col] = LS.get("eb_" + col, {});
    state.mode = "local"; state.ready = true; render();
  }

  async function connectClaude() {
    if (!window.claude || !window.claude.use) return false;
    try { db = await window.claude.use("db"); } catch { db = null; }
    try { sample = await window.claude.use("sample"); } catch { sample = null; }
    try { downloads = await window.claude.use("downloads"); } catch { downloads = null; }
    if (!db) return false;
    state.mode = "claude";
    let pending = 3;
    const timer = setTimeout(() => { if (!state.ready) { state.ready = true; notify("Your saved data can't be reached yet."); } }, 10000);
    for (const col of ["products", "earnings", "runs"]) {
      db.collection(col).onSnapshot(snap => {
        const next = {};
        snap.docs.forEach(d => { next[d.id] = d.data(); });
        state[col] = next;
        if (!snap.metadata.fromCache && --pending <= 0) { clearTimeout(timer); state.ready = true; }
        render();
      }, err => { clearTimeout(timer); state.ready = true; notify("Data connection stopped: " + err.message); });
    }
    return true;
  }

  // ---- Claude (for the Idea Bot) ---------------------------------------------

  async function askClaudeJSON(prompt) {
    if (sample) return await sample.json(prompt, { modelTier: "default" });
    const key = LS.get("eb_anthropic_key", "");
    if (!key) throw new Error("Add your Anthropic API key in Settings to use the Idea Bot in the app.");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: LS.get("eb_model", "claude-sonnet-5-5"), max_tokens: 4000,
        messages: [{ role: "user", content: prompt + "\n\nReply with the JSON only, no other text." }] }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `Claude API error ${res.status}`);
    const text = (data.content || []).map(c => c.text || "").join("");
    return JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1));
  }
  const claudeAvailable = () => !!sample || (!window.claude && !!LS.get("eb_anthropic_key", ""));

  // ---- files ------------------------------------------------------------------

  async function blobToBase64(blob) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  async function saveFile(filename, blob) {
    if (downloads) {
      try { await downloads.save({ filename, data: blob }); return true; }
      catch (e) { if (e.code !== "declined") notify("Download failed: " + (e.message || e.code)); return false; }
    }
    const P = window.Capacitor && window.Capacitor.Plugins;
    if (IS_NATIVE && P && P.Filesystem) {
      const written = await P.Filesystem.writeFile({ path: filename, data: await blobToBase64(blob), directory: "CACHE" });
      try { await P.Share.share({ title: filename, url: written.uri, dialogTitle: "Save or send " + filename }); }
      catch { /* share sheet closed */ }
      return true;
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return true;
  }

  async function copyText(text, label) {
    try { await navigator.clipboard.writeText(text); notify(`${label} copied.`); }
    catch { showCopyBox(text, label); }
  }

  // ---- the upload kit ---------------------------------------------------------------

  async function buildKit(p) {
    const zip = new window.JSZip(), stem = slug(p.shortName);
    const etsy = zip.folder("1-upload-to-etsy"), gum = zip.folder("2-upload-to-gumroad");
    const customer = new window.JSZip();
    for (const size of Object.keys(D.SIZES)) {
      const pdf = D.makePdf(p, size);
      etsy.file(`${stem}-${size}.pdf`, pdf); customer.file(`${stem}-${size}.pdf`, pdf);
    }
    customer.file("HOW-TO-PRINT.txt", "Thank you for your purchase!\n\n- The -A4 file is for A4 paper (Europe and most of the world).\n- The -US-Letter file is for US Letter paper (USA and Canada).\n- Print at 100% / \"Actual size\" for the best result.\n- You can also write on the PDF in any note-taking app that supports PDF annotation.\n");
    gum.file(`${stem}.zip`, await customer.generateAsync({ type: "blob" }));
    const cover = await D.canvasBlob(D.coverCanvas(p, 2000));
    etsy.file("01-cover.png", cover); gum.file("cover.png", cover);
    let i = 2;
    for (const key of p.bundle.pages.slice(0, 9)) etsy.file(`${String(i++).padStart(2, "0")}-${key}.png`, await D.canvasBlob(D.pageCanvas(p, key, 2000)));
    zip.file("LISTING.txt", `TITLE\n${p.title}\n\nPRICE\n${p.price.toFixed(2)}\n\nTAGS (Etsy: all 13, Gumroad: first 5)\n${p.tags.join(", ")}\n\nDESCRIPTION\n${p.description}\nETSY: create a listing as a Digital file, add the photos in 1-upload-to-etsy (cover first) and both PDFs as the digital files.\nGUMROAD: New product > Digital product, name it exactly "${p.shortName}", upload the zip in 2-upload-to-gumroad and cover.png as the cover.\n`);
    return { blob: await zip.generateAsync({ type: "blob" }), name: `${stem}-upload-kit.zip` };
  }

  // ---- worker bots --------------------------------------------------------------
  // Add a bot: push an object with id, title, desc, earnsVia and an async run(ctx) that returns a summary.

  const BOTS = [
    {
      id: "product_factory", title: "Product Factory",
      desc: "Designs printable planner PDFs, makes the preview images and writes the Etsy listing.",
      earnsVia: "Etsy + Gumroad sales",
      async run(ctx) {
        const todo = [];
        for (const b of Object.keys(D.BUNDLES)) for (const t of Object.keys(D.THEMES)) {
          if (!state.products[`${b}-${t.toLowerCase()}`]) todo.push([b, t]);
        }
        if (!todo.length) return "The catalogue is complete. Use the Idea Bot for new products.";
        const counts = {};
        Object.values(state.products).forEach(p => { counts[p.bundleKey] = (counts[p.bundleKey] || 0) + 1; });
        todo.sort(() => Math.random() - 0.5).sort((a, b) => (counts[a[0]] || 0) - (counts[b[0]] || 0));
        const made = [];
        for (const [bk, theme] of todo.slice(0, ctx.perRun)) {
          const bundle = D.BUNDLES[bk];
          await ctx.addProduct(`${bk}-${theme.toLowerCase()}`, bk, { ...bundle }, theme);
          made.push(`${bundle.name} (${theme})`);
        }
        return `Made ${made.length} product(s) for approval: ${made.join(", ")}. ${todo.length - made.length} more in the catalogue.`;
      },
    },
    {
      id: "idea_bot", title: "Idea Bot",
      desc: "Asks Claude for new niche printables that sell on Etsy (teachers, nurses, weddings, pets...) and builds them.",
      earnsVia: "Etsy + Gumroad sales",
      needsClaude: true,
      async run(ctx) {
        const existing = Object.values(state.products).map(p => p.bundle.name);
        const pages = Object.entries(D.LAYOUTS).map(([k, v]) => `${k} (${v[0]})`).join(", ");
        const themes = Object.keys(D.THEMES);
        const ideas = await askClaudeJSON(`You research products for a printable planner shop on Etsy.
Suggest ${ctx.perRun} NEW printable bundles aimed at specific buyer niches that sell well on Etsy (for example teachers, nurses, students, new parents, small business owners, wedding planning, pet owners, travellers, homeschool, freelancers). Each bundle may ONLY use these page designs: ${pages}.
Do not repeat these existing products: ${existing.slice(-60).join("; ") || "none yet"}.
Return a JSON array. Each item: {"name": product name in Title Case, max 45 characters, naming the niche; "pages": 2 to 6 page keys from the list; "intro": one sentence that sells it to the buyer; "tags": exactly 10 lowercase Etsy search tags, each at most 20 characters; "price": number between 2.5 and 9.9; "theme": one of ${themes.join(", ")}}.`);
        if (!Array.isArray(ideas)) throw new Error("Claude didn't return a list.");
        const made = [];
        for (const it of ideas.slice(0, ctx.perRun)) {
          const pagesOk = (it.pages || []).filter(k => D.LAYOUTS[k]);
          if (!it.name || pagesOk.length === 0) continue;
          const theme = themes.includes(it.theme) ? it.theme : themes[Math.floor(Math.random() * themes.length)];
          const bundle = { name: String(it.name).slice(0, 60), pages: [...new Set(pagesOk)].slice(0, 6),
            intro: String(it.intro || "").slice(0, 300), tags: (it.tags || []).map(String),
            price: Math.min(19.9, Math.max(1.5, Number(it.price) || 3.9)) };
          const sku = `idea-${slug(bundle.name).slice(0, 40)}-${theme.toLowerCase()}`;
          if (state.products[sku]) continue;
          await ctx.addProduct(sku, "custom", bundle, theme);
          made.push(`${bundle.name} (${theme})`);
        }
        return made.length ? `Made ${made.length} niche product(s) for approval: ${made.join(", ")}.` : "Claude's ideas were all duplicates. Try again.";
      },
    },
  ];

  async function runBot(bot) {
    if (state.busy[bot.id]) return;
    if (bot.needsClaude && !claudeAvailable()) { notify(sample === null && window.claude ? "Claude isn't available in this view." : "Add your Anthropic API key in Settings first."); setTab("settings"); return; }
    state.busy[bot.id] = true; render();
    const runId = uid(), started = now();
    const ctx = {
      perRun: Number(LS.get("eb_per_run", 3)) || 3,
      addProduct: async (sku, bundleKey, bundle, theme) => {
        const copy = D.listingCopy(bundle, theme);
        await Store.save("products", sku, { sku, bot: bot.id, bundleKey, bundle, theme, ...copy, status: "pending", createdAt: now() });
      },
    };
    let summary, status = "ok";
    try { summary = await bot.run(ctx); }
    catch (e) { status = "error"; summary = "Failed: " + (e.message || e); }
    state.busy[bot.id] = false;
    notify(summary);
    await Store.save("runs", runId, { bot: bot.id, startedAt: started, status, summary });
    pruneRuns();
  }

  function pruneRuns() {
    const runs = Object.entries(state.runs).sort((a, b) => b[1].startedAt.localeCompare(a[1].startedAt));
    runs.slice(40).forEach(([id]) => Store.remove("runs", id));
  }

  // ---- earnings report -------------------------------------------------------------

  function report() {
    const rows = Object.values(state.earnings);
    const total = {}, w7 = {}, w30 = {}, byBot = {}, bySource = {}, byProduct = {};
    const t7 = Date.now() - 7 * 864e5, t30 = Date.now() - 30 * 864e5;
    const add = (o, k, cur, c) => { o[k] = o[k] || {}; o[k][cur] = (o[k][cur] || 0) + c; };
    for (const r of rows) {
      const cur = r.currency, c = r.amountCents, t = Date.parse(r.date);
      total[cur] = (total[cur] || 0) + c;
      if (t >= t7) w7[cur] = (w7[cur] || 0) + c;
      if (t >= t30) w30[cur] = (w30[cur] || 0) + c;
      const p = state.products[r.sku];
      add(byBot, p ? p.bot : (r.bot || "other"), cur, c);
      add(bySource, r.platform, cur, c);
      if (p) { byProduct[r.sku] = byProduct[r.sku] || { name: p.shortName, n: 0, sums: {} }; byProduct[r.sku].n++; add(byProduct[r.sku], "sums", cur, c); }
    }
    return { count: rows.length, total, w7, w30, byBot, bySource,
      top: Object.values(byProduct).sort((a, b) => b.n - a.n).slice(0, 8) };
  }

  // ---- UI ------------------------------------------------------------------------------

  const thumbs = new Map();
  let thumbQueue = [], thumbBusy = false;
  function thumb(p) {
    const key = p.sku + p.theme;
    if (thumbs.has(key)) return thumbs.get(key);
    if (!thumbQueue.includes(p)) thumbQueue.push(p);
    pumpThumbs();
    return "";
  }
  function pumpThumbs() {
    if (thumbBusy || !thumbQueue.length) return;
    thumbBusy = true;
    setTimeout(() => {
      const p = thumbQueue.shift();
      try { thumbs.set(p.sku + p.theme, D.coverCanvas(p, 900).toDataURL("image/jpeg", 0.85)); } catch { /* skip */ }
      thumbBusy = false;
      document.querySelectorAll(`img[data-sku="${CSS.escape(p.sku)}"]`).forEach(img => { img.src = thumbs.get(p.sku + p.theme) || ""; });
      pumpThumbs();
    }, 30);
  }

  function notify(msg) { state.notice = msg; render(); }

  function setTab(t) { state.tab = t; try { history.replaceState(null, "", "#" + t); } catch { /* ignore */ } render(); window.scrollTo(0, 0); }

  function showCopyBox(text, label) {
    const box = $("#copybox");
    box.querySelector("h3").textContent = label;
    box.querySelector("textarea").value = text;
    box.hidden = false; box.querySelector("textarea").select();
  }

  function productCard(p, mode) {
    const img = `<img class="cover" data-sku="${esc(p.sku)}" src="${thumb(p)}" alt="">`;
    const details = `<details><summary>Listing text</summary><p class="t">${esc(p.title)}</p><pre>${esc(p.description)}</pre><p class="muted">Tags: ${esc(p.tags.join(", "))}</p></details>`;
    const head = `<div class="ph"><div><b>${esc(p.shortName)}</b><div class="muted">${p.price.toFixed(2)} · ${p.bundle.pages.length} page${p.bundle.pages.length === 1 ? "" : "s"} · ${esc(botTitle(p.bot))}</div></div>${mode !== "pending" ? `<span class="pill ${p.status}">${p.status === "listed" ? "listed" : "ready"}</span>` : ""}</div>`;
    if (mode === "pending") {
      return `<div class="card">${head}${img}${details}<div class="btns"><button data-act="approve" data-sku="${esc(p.sku)}">Approve</button><button class="ghost" data-act="reject" data-sku="${esc(p.sku)}">Reject</button></div></div>`;
    }
    const L = p.listings || {};
    return `<div class="card">${head}${img}
      <div class="btns"><button data-act="kit" data-sku="${esc(p.sku)}">${state.busy["kit-" + p.sku] ? "Building..." : "Download upload kit"}</button>
      <button class="ghost" data-act="copy-title" data-sku="${esc(p.sku)}">Copy title</button>
      <button class="ghost" data-act="copy-desc" data-sku="${esc(p.sku)}">Copy description</button>
      <button class="ghost" data-act="copy-tags" data-sku="${esc(p.sku)}">Copy tags</button></div>
      ${details}
      <form class="listed" data-sku="${esc(p.sku)}"><label>Etsy listing link<input name="etsy" value="${esc(L.etsy || "")}" placeholder="https://www.etsy.com/listing/..."></label>
      <label>Gumroad link<input name="gumroad" value="${esc(L.gumroad || "")}" placeholder="https://....gumroad.com/l/..."></label>
      <div class="btns"><button class="ghost">Save links</button><button type="button" class="ghost" data-act="sale" data-sku="${esc(p.sku)}">Log a sale</button></div></form></div>`;
  }

  const botTitle = id => (BOTS.find(b => b.id === id) || { title: id }).title;

  function render() {
    const root = $("#app"); if (!root) return;
    const products = Object.values(state.products);
    const pending = products.filter(p => p.status === "pending").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const ready = products.filter(p => p.status === "approved" || p.status === "listed").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const rep = report();
    const tabs = [["bots", "Bots"], ["approve", `Approve${pending.length ? ` (${pending.length})` : ""}`], ["sell", "Sell"], ["earnings", "Earnings"], ["settings", "Settings"]];
    let h = `<header><h1>Earning Bots</h1><div class="total"><span class="muted">Earned all time</span><b>${esc(money(rep.total))}</b></div></header>
      <nav>${tabs.map(([id, label]) => `<button class="${state.tab === id ? "on" : ""}" data-tab="${id}">${esc(label)}</button>`).join("")}</nav>`;
    if (state.notice) h += `<div class="notice"><span>${esc(state.notice)}</span><button class="x" data-act="dismiss" aria-label="Dismiss">×</button></div>`;
    if (!state.ready) h += `<p class="muted center">Loading your bots...</p>`;

    if (state.tab === "bots") {
      const last = {};
      Object.values(state.runs).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).forEach(r => { if (!last[r.bot]) last[r.bot] = r; });
      h += `<div class="row stats"><div class="card"><span class="muted">Waiting for approval</span><b>${pending.length}</b></div><div class="card"><span class="muted">Ready to sell</span><b>${ready.length}</b></div><div class="card"><span class="muted">Last 30 days</span><b>${esc(money(rep.w30))}</b></div></div>`;
      h += `<button class="wide" data-act="run-all">Run all bots</button>`;
      for (const b of BOTS) {
        const r = last[b.id], busy = state.busy[b.id];
        const off = b.needsClaude && !claudeAvailable();
        h += `<div class="card bot"><div class="ph"><div><b>${esc(b.title)}</b><div class="muted">${esc(b.desc)}</div><div class="muted">Earns via ${esc(b.earnsVia)}</div></div>
          ${busy ? `<span class="pill run">working</span>` : r ? `<span class="pill ${r.status}">${r.status === "ok" ? "ok" : "error"}</span>` : ""}</div>
          ${r ? `<p class="muted small">Last run ${new Date(r.startedAt).toLocaleString()}: ${esc(r.summary)}</p>` : ""}
          ${off ? `<p class="muted small">Needs Claude: add your Anthropic API key in Settings.</p>` : ""}
          <button data-act="run" data-bot="${b.id}" ${busy ? "disabled" : ""}>${busy ? "Working..." : "Run"}</button></div>`;
      }
      h += `<p class="muted small center">More bots can be added later. Each one is a small plug-in in app.js.</p>`;
    }

    if (state.tab === "approve") {
      if (!pending.length) h += `<div class="card muted center">Nothing waiting. Go to Bots and tap Run.</div>`;
      else if (pending.length > 1) h += `<button class="wide" data-act="approve-all">Approve all ${pending.length}</button>`;
      h += pending.map(p => productCard(p, "pending")).join("");
    }

    if (state.tab === "sell") {
      h += `<div class="card small muted">Approved products come with an upload kit (ZIP) containing the PDFs, Etsy photos, a Gumroad file and the listing text. List them on Etsy and Gumroad, paste the links here, then log sales to track earnings.</div>`;
      if (!ready.length) h += `<div class="card muted center">Approve products to see them here.</div>`;
      h += ready.map(p => productCard(p, "ready")).join("");
    }

    if (state.tab === "earnings") {
      h += `<div class="row stats"><div class="card"><span class="muted">Last 7 days</span><b>${esc(money(rep.w7))}</b></div><div class="card"><span class="muted">Last 30 days</span><b>${esc(money(rep.w30))}</b></div><div class="card"><span class="muted">Sales</span><b>${rep.count}</b></div></div>`;
      h += `<form id="saleform" class="card"><h3>Log a sale</h3>
        <div class="grid"><label>Amount<input name="amount" type="number" step="0.01" min="0" required placeholder="4.90"></label>
        <label>Currency<select name="currency">${["EUR", "USD", "GBP"].map(c => `<option ${LS.get("eb_currency", "EUR") === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>
        <label>Platform<select name="platform"><option>Etsy</option><option>Gumroad</option><option>Other</option></select></label>
        <label>Date<input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}"></label></div>
        <label>Product<select name="sku"><option value="">Not linked to a product</option>${ready.map(p => `<option value="${esc(p.sku)}" ${state.saleSku === p.sku ? "selected" : ""}>${esc(p.shortName)}</option>`).join("")}</select></label>
        <label>Note<input name="note" placeholder="optional"></label><button>Add sale</button></form>`;
      const table = (title, obj, nameFn) => {
        const rows = Object.entries(obj);
        return rows.length ? `<div class="card"><h3>${title}</h3><table>${rows.map(([k, v]) => `<tr><td>${esc(nameFn(k))}</td><td>${esc(money(v))}</td></tr>`).join("")}</table></div>` : "";
      };
      h += table("By bot", rep.byBot, k => botTitle(k)) + table("By platform", rep.bySource, k => k);
      if (rep.top.length) h += `<div class="card"><h3>Best sellers</h3><table>${rep.top.map(t => `<tr><td>${esc(t.name)} (${t.n})</td><td>${esc(money(t.sums))}</td></tr>`).join("")}</table></div>`;
      const list = Object.entries(state.earnings).sort((a, b) => b[1].date.localeCompare(a[1].date)).slice(0, 50);
      if (list.length) h += `<div class="card"><h3>Recent sales</h3><table>${list.map(([id, r]) => `<tr><td>${esc(r.date.slice(0, 10))} · ${esc(r.platform)}<div class="muted small">${esc(state.products[r.sku]?.shortName || r.note || "")}</div></td><td>${(r.amountCents / 100).toFixed(2)} ${esc(r.currency)} <button class="x" data-act="del-sale" data-id="${esc(id)}" aria-label="Delete">×</button></td></tr>`).join("")}</table></div>`;
      else h += `<div class="card muted center">No sales logged yet.</div>`;
    }

    if (state.tab === "settings") {
      h += `<form id="settings" class="card"><h3>Settings</h3>
        <label>Products per bot run<input name="perRun" type="number" min="1" max="10" value="${esc(LS.get("eb_per_run", 3))}"></label>
        <label>Default currency<select name="currency">${["EUR", "USD", "GBP"].map(c => `<option ${LS.get("eb_currency", "EUR") === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>
        ${window.claude ? `<p class="muted small">The Idea Bot uses Claude directly here, no key needed.</p>` :
          `<label>Anthropic API key (for the Idea Bot)<input name="key" type="password" value="${esc(LS.get("eb_anthropic_key", ""))}" placeholder="sk-ant-..."></label>
           <p class="muted small">Stored only on this phone. Get one at console.anthropic.com. Each Idea Bot run costs a few cents.</p>`}
        <button>Save</button></form>
        <div class="card small muted"><b>Where your data lives</b><br>${state.mode === "claude" ? "In this artifact's private database, available wherever you open it in Claude." : "On this device only. Use Back up to keep a copy."}</div>
        <div class="btns"><button class="ghost" data-act="backup">Back up data</button><label class="filebtn ghost">Restore backup<input type="file" accept=".json,application/json" id="restore" hidden></label></div>`;
    }

    root.innerHTML = h;
  }

  // ---- events --------------------------------------------------------------------------

  document.addEventListener("click", async e => {
    const t = e.target.closest("[data-tab],[data-act]"); if (!t) return;
    if (t.dataset.tab) return setTab(t.dataset.tab);
    const act = t.dataset.act, p = t.dataset.sku ? state.products[t.dataset.sku] : null;
    if (act === "dismiss") { state.notice = ""; render(); }
    else if (act === "run") runBot(BOTS.find(b => b.id === t.dataset.bot));
    else if (act === "run-all") { for (const b of BOTS) if (!b.needsClaude || claudeAvailable()) await runBot(b); }
    else if (act === "approve" && p) Store.save("products", p.sku, { ...p, status: "approved", approvedAt: now() });
    else if (act === "approve-all") {
      for (const q of Object.values(state.products).filter(x => x.status === "pending")) await Store.save("products", q.sku, { ...q, status: "approved", approvedAt: now() });
      notify("All approved. Open Sell to download the upload kits.");
    }
    else if (act === "reject" && p) Store.save("products", p.sku, { ...p, status: "rejected" });
    else if (act === "kit" && p) {
      if (state.busy["kit-" + p.sku]) return;
      state.busy["kit-" + p.sku] = true; render();
      try { const kit = await buildKit(p); await saveFile(kit.name, kit.blob); }
      catch (err) { notify("Couldn't build the kit: " + (err.message || err)); }
      state.busy["kit-" + p.sku] = false; render();
    }
    else if (act === "copy-title" && p) copyText(p.title, "Title");
    else if (act === "copy-desc" && p) copyText(p.description, "Description");
    else if (act === "copy-tags" && p) copyText(p.tags.join(", "), "Tags");
    else if (act === "sale" && p) { state.saleSku = p.sku; setTab("earnings"); }
    else if (act === "del-sale") Store.remove("earnings", t.dataset.id);
    else if (act === "backup") {
      const data = JSON.stringify({ products: state.products, earnings: state.earnings, exportedAt: now() }, null, 1);
      saveFile(`earning-bots-backup-${new Date().toISOString().slice(0, 10)}.json`, new Blob([data], { type: "application/json" }));
    }
  });

  document.addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target, fd = new FormData(f);
    if (f.id === "saleform") {
      const amount = Math.round(parseFloat(fd.get("amount")) * 100);
      if (!(amount > 0)) return notify("Enter the sale amount.");
      const sku = fd.get("sku") || "";
      await Store.save("earnings", uid(), { amountCents: amount, currency: fd.get("currency"), platform: fd.get("platform"),
        sku, bot: state.products[sku]?.bot || "", date: new Date(fd.get("date") + "T12:00:00").toISOString(), note: fd.get("note") || "" });
      state.saleSku = ""; notify("Sale added.");
    } else if (f.id === "settings") {
      LS.set("eb_per_run", Math.min(10, Math.max(1, parseInt(fd.get("perRun"), 10) || 3)));
      LS.set("eb_currency", fd.get("currency"));
      if (fd.has("key")) LS.set("eb_anthropic_key", String(fd.get("key")).trim());
      notify("Settings saved.");
    } else if (f.classList.contains("listed")) {
      const p = state.products[f.dataset.sku]; if (!p) return;
      const listings = { etsy: String(fd.get("etsy")).trim(), gumroad: String(fd.get("gumroad")).trim() };
      await Store.save("products", p.sku, { ...p, listings, status: listings.etsy || listings.gumroad ? "listed" : "approved" });
      notify("Links saved.");
    }
  });

  document.addEventListener("change", async e => {
    if (e.target.id !== "restore" || !e.target.files[0]) return;
    try {
      const data = JSON.parse(await e.target.files[0].text());
      for (const [id, v] of Object.entries(data.products || {})) if (!state.products[id]) await Store.save("products", id, v);
      for (const [id, v] of Object.entries(data.earnings || {})) if (!state.earnings[id]) await Store.save("earnings", id, v);
      notify("Backup restored.");
    } catch { notify("That file isn't an Earning Bots backup."); }
  });

  $("#copybox button").addEventListener("click", () => { $("#copybox").hidden = true; });

  // ---- start ----------------------------------------------------------------------------

  const startTab = (location.hash || "").slice(1);
  if (["bots", "approve", "sell", "earnings", "settings"].includes(startTab)) state.tab = startTab;
  window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (h && h !== state.tab) { state.tab = h; render(); } });
  render();
  if (window.claude && window.claude.use) {
    connectClaude().then(ok => { if (!ok) loadLocal(); });
  } else loadLocal();
  if (document.fonts) document.fonts.ready.then(() => { thumbs.clear(); render(); });
})();

/* Earning Bots interface: Home, Bots, Inbox, Library, Money, sheets and settings. */
(function () {
  "use strict";
  const { U, LS, Store, Claude, Web, Files, IS_NATIVE, IN_CLAUDE } = window.EB;
  const { BOTS, KINDS, PLATFORMS } = window.EB_BOTS;
  const M = window.EB_MEDIA;
  const S = Store.S, esc = U.esc;
  const VERSION = "4.2";

  const ICONS = {
    tablet: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M17 5v14"/><path d="M19 8h2M19 11h2M19 14h2"/>',
    grid: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16M15 4v16"/>',
    party: '<path d="M4 20l5-14 9 9z"/><path d="M14 4l1 2M19 7l2-1M17 3l-1 2"/><circle cx="20" cy="11" r="1"/>',
    cards: '<rect x="3" y="6" width="11" height="15" rx="2" transform="rotate(-8 8 13)"/><rect x="10" y="3" width="11" height="15" rx="2"/>',
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4"/><circle cx="12" cy="3" r="1"/><circle cx="9" cy="14" r="1.2"/><circle cx="15" cy="14" r="1.2"/>',
    inbox: '<path d="M4 13l2-8h12l2 8"/><path d="M4 13v6h16v-6h-5l-1 2h-4l-1-2z"/>',
    library: '<rect x="4" y="4" width="6" height="16" rx="1"/><rect x="12" y="4" width="8" height="7" rx="1"/><rect x="12" y="13" width="8" height="7" rx="1"/>',
    wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M16 13h2"/><path d="M3 10h18"/><path d="M6 6V4h11v2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
    play: '<path d="M7 4l13 8-13 8z"/>', check: '<path d="M4 12l5 5L20 6"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
    download: '<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M4 20h16"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
    link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>', phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z"/>',
    book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5"/><path d="M8 7h7"/>', shirt: '<path d="M8 3l-5 3 2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 01-8 0z"/>',
    video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>', doc: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/><path d="M9 13h7M9 17h7"/>',
    file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>', target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2"/><path d="M3 13h18"/>', tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8" r="1.3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', plus: '<path d="M12 5v14M5 12h14"/>', trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>', pin: '<path d="M12 21v-6"/><path d="M8 4h8l-1 6 3 3H6l3-3z"/>',
    maze: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v8h6M17 21v-8h-6M11 7h6M7 17h4"/>', palette: '<path d="M12 3a9 9 0 100 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 004-4c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
    notebook: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18M3 7h4M3 12h4M3 17h4"/>', pencil: '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>', chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    sync: '<path d="M20 11a8 8 0 00-14.9-3"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0014.9 3"/><path d="M20 20v-4h-4"/>', back: '<path d="M15 5l-7 7 7 7"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  };
  const ic = (n, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ICONS.file}</svg>`;

  const ui = { tab: "home", sheet: null, libKind: "all", libStatus: "all", search: "", inboxBot: "all", period: 30, running: {}, toasts: [] };
  const TABS = [["home", "Home", "home"], ["bots", "Bots", "bot"], ["inbox", "Inbox", "inbox"], ["library", "Library", "library"], ["money", "Money", "wallet"]];
  const cfg = () => Store.config();
  const currency = () => cfg().currency || "EUR";
  const items = () => Object.values(S.items);
  const pipelineKinds = Object.entries(KINDS).filter(([, k]) => k.pipeline).map(([n]) => n);
  const botById = id => BOTS.find(b => b.id === id);

  // ---- helpers ------------------------------------------------------------------------
  function missingNeeds(bot) {
    if ((bot.needs || []).includes("claude") && !Claude.available()) return `${bot.title} needs Claude. ${Claude.why()}`;
    if ((bot.needs || []).includes("web") && !Web.available()) return Web.why();
    return "";
  }
  const isOff = b => !!Store.botConfig(b.id).disabled;
  function botCfg(bot) {
    const out = {};
    (bot.settings || []).forEach(s => { out[s.key] = s.def; });
    Object.assign(out, Store.botConfig(bot.id));
    (bot.settings || []).forEach(s => { if (s.type === "number") out[s.key] = Math.min(s.max || 99, Math.max(s.min || 0, parseInt(out[s.key], 10) || s.def)); });
    return out;
  }
  function lastRun(botId) {
    let best = null; for (const r of Object.values(S.runs)) if (r.bot === botId && (!best || r.startedAt > best.startedAt)) best = r;
    return best;
  }
  function toast(msg, kind = "ok") {
    const t = { id: U.uid(), msg, kind }; ui.toasts.push(t); renderToasts();
    setTimeout(() => { ui.toasts = ui.toasts.filter(x => x !== t); renderToasts(); }, kind === "error" ? 7000 : 4200);
  }
  Object.assign(window.EB_APP, { toast, copyBox, closeSheet: () => closeSheet(), refresh: () => { render(); renderSheet(); }, syncGumroad: q => syncGumroad(q) });

  function copyBox(text, label) {
    openSheet({ type: "copy", text, label });
  }

  // thumbnails, rendered one at a time in the background
  const thumbs = new Map(); const queue = []; let pumping = false;
  function thumb(it) {
    const k = KINDS[it.kind]; if (!k || !k.thumb) return "";
    const key = it.id + ":" + (it.data.theme || "") + (it.data.palette ?? "") + (it.data.style || "");
    if (thumbs.has(key)) return thumbs.get(key);
    if (!queue.some(q => q.key === key)) queue.push({ key, it });
    pump(); return "";
  }
  function pump() {
    if (pumping || !queue.length) return; pumping = true;
    setTimeout(() => {
      const { key, it } = queue.shift();
      try { const cv = KINDS[it.kind].thumb(it, it.kind === "content" ? 540 : 800); thumbs.set(key, cv.toDataURL("image/jpeg", 0.82)); cv.width = 0; }
      catch (e) { thumbs.set(key, ""); window.EB.Log.add("error", `thumbnail ${it.id}: ${e.message}`); }
      while (thumbs.size > 150) thumbs.delete(thumbs.keys().next().value); // keep memory bounded
      document.querySelectorAll(`img[data-thumb="${CSS.escape(it.id)}"]`).forEach(img => { img.src = thumbs.get(key); img.classList.add("loaded"); });
      pumping = false; pump();
    }, 16);
  }

  // ---- bots -------------------------------------------------------------------------------
  async function runBot(bot, quiet) {
    if (ui.running[bot.id]) return;
    const miss = missingNeeds(bot);
    if (miss) { if (!quiet) toast(miss, "error"); return; }
    ui.running[bot.id] = "Starting..."; render();
    const c = botCfg(bot), started = U.now();
    let made = 0; const newIds = [];
    const ctx = {
      cfg: c,
      progress: m => { ui.running[bot.id] = m; document.querySelectorAll(`[data-progress="${bot.id}"]`).forEach(el => { el.textContent = m; }); },
      add: async (kind, title, data, o = {}) => {
        const id = o.id || `${kind}-${U.uid()}`; made++; newIds.push(id);
        await Store.save("items", id, { id, bot: bot.id, kind, title: U.clampStr(title, 160), status: o.status || "pending", createdAt: U.now(), price: o.price ?? null, data, links: {} });
      },
    };
    let summary, status = "ok";
    try { summary = await bot.run(ctx); } catch (e) { status = "error"; summary = "Failed: " + (e.message || e); }
    if (newIds.length) { try { ctx.progress("Checking and automating..."); const extra = await window.EB_AUTO.afterRun(bot, newIds); if (extra) summary += ` (${extra})`; } catch (e) { summary += ` (automation: ${e.message})`; } }
    delete ui.running[bot.id];
    window.EB.Log.add(status === "ok" ? "info" : "error", `${bot.title}: ${summary}`);
    await Store.save("runs", U.uid(), { bot: bot.id, startedAt: started, finishedAt: U.now(), status, summary, made });
    const runs = Object.entries(S.runs).sort((a, b) => b[1].startedAt.localeCompare(a[1].startedAt));
    for (const [id] of runs.slice(60)) Store.remove("runs", id);
    if (!quiet || status === "error" || made) toast(`${bot.title}: ${summary}`, status === "ok" ? "ok" : "error");
    render();
  }
  async function runAll() {
    const ready = BOTS.filter(b => !isOff(b) && !missingNeeds(b) && !(b.watches && !Object.keys(S.watches).length));
    if (!ready.length) return toast("No bot can run here yet. Check Settings.", "error");
    toast(`Running ${ready.length} bots...`);
    for (const b of ready) await runBot(b, true);
  }
  // autopilot: while the app is open, run bots whose interval has passed
  function autopilot() {
    for (const b of BOTS) {
      const hours = parseFloat(Store.botConfig(b.id).auto || 0); if (!hours || isOff(b) || ui.running[b.id] || missingNeeds(b)) continue;
      if (window.EB_CLOUD && window.EB_CLOUD.runsBot(b.id)) continue; // the cloud runs this one
      const last = lastRun(b.id); if (last && Date.now() - Date.parse(last.startedAt) < hours * 3600e3) continue;
      runBot(b, true); break;
    }
    window.EB_AUTO.periodic().catch(() => {});
  }

  // ---- money ---------------------------------------------------------------------------------
  function report(days) {
    const rows = Object.values(S.earnings), since = days ? Date.now() - days * 864e5 : 0, main = currency();
    const total = {}, byBot = {}, byPlat = {}, byItem = {}, daily = {}; let count = 0;
    const add = (o, k, cur, c) => { o[k] = o[k] || {}; o[k][cur] = (o[k][cur] || 0) + c; };
    for (const r of rows) {
      const t = Date.parse(r.date); if (t < since) continue;
      count++; total[r.currency] = (total[r.currency] || 0) + r.amountCents;
      const it = S.items[r.itemId];
      add(byBot, it ? it.bot : (r.bot || "manual"), r.currency, r.amountCents);
      add(byPlat, r.platform || "Other", r.currency, r.amountCents);
      if (it) { byItem[it.id] = byItem[it.id] || { it, n: 0, sums: {} }; byItem[it.id].n++; add(byItem[it.id], "sums", r.currency, r.amountCents); }
      if (r.currency === main) { const d = r.date.slice(0, 10); daily[d] = (daily[d] || 0) + r.amountCents; }
    }
    return { total, count, byBot, byPlat, top: Object.values(byItem).sort((a, b) => (b.sums[main] || 0) - (a.sums[main] || 0)).slice(0, 6), daily };
  }
  function monthTotal() {
    const m = new Date().toISOString().slice(0, 7); let c = 0;
    for (const r of Object.values(S.earnings)) if (r.date.startsWith(m) && r.currency === currency()) c += r.amountCents;
    return c;
  }
  function barChart(daily, days) {
    const n = Math.min(days || 30, 90), vals = [];
    for (let i = n - 1; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); vals.push([d, daily[d] || 0]); }
    const max = Math.max(1, ...vals.map(v => v[1])), w = 300, h = 90, bw = w / n;
    return `<svg class="chart" viewBox="0 0 ${w} ${h + 16}" preserveAspectRatio="none" role="img" aria-label="Daily earnings">
      ${vals.map(([d, v], i) => `<rect x="${(i * bw + bw * 0.15).toFixed(1)}" y="${(h - (v / max) * h).toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${Math.max(v ? 2 : 1, (v / max) * h).toFixed(1)}" rx="1.5" class="${v ? "bar" : "bar0"}"><title>${d}: ${U.fmt(v, currency())}</title></rect>`).join("")}
      <text x="0" y="${h + 14}" class="axis">${vals[0][0].slice(5)}</text><text x="${w}" y="${h + 14}" class="axis" text-anchor="end">today</text></svg>`;
  }

  // ---- views -----------------------------------------------------------------------------------
  function header(title, sub) {
    return `<header class="top"><div><h1>${esc(title)}</h1>${sub ? `<p class="sub">${sub}</p>` : ""}</div><button class="iconbtn" data-act="settings" aria-label="Settings">${ic("gear")}</button></header>`;
  }

  function viewHome() {
    const all = items(), pending = all.filter(i => i.status === "pending"), ready = all.filter(i => i.status === "approved");
    const listed = all.filter(i => i.status === "listed"), leads = all.filter(i => pipelineKinds.includes(i.kind) && i.status === "new");
    const goal = Math.round((cfg().goal || 500) * 100), month = monthTotal(), pct = Math.min(100, Math.round(month / goal * 100));
    const rep = report(30);
    const hour = new Date().getHours(), hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const runs = Object.values(S.runs).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 6);
    const running = Object.keys(ui.running);
    const steps = [];
    if (!all.length) steps.push(["bots", "Run your first bot", "Start with Product Factory. It needs nothing to set up."]);
    if (pending.length) steps.push(["inbox", `Review ${pending.length} new item${pending.length > 1 ? "s" : ""}`, "Approve what's good, reject the rest."]);
    if (ready.length) steps.push(["library:ready", `List ${ready.length} approved item${ready.length > 1 ? "s" : ""}`, "Download the kits and upload them to your shops."]);
    if (leads.length) steps.push(["library:leads", `Follow up ${leads.length} lead${leads.length > 1 ? "s" : ""} and jobs`, "Send the pitches and mark them as contacted."]);
    if (!Object.keys(S.earnings).length && listed.length) steps.push(["money", "Log your first sale", "Track what each bot earns."]);
    return `${header(hello, new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }))}
      <section class="hero card">
        <div class="hero-top"><div><span class="label">Earned this month</span><div class="big">${U.fmt(month, currency())}</div></div>
          <button class="ring" data-tab="money" aria-label="Goal ${pct}%"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.5" class="ring-bg"/><circle cx="18" cy="18" r="15.5" class="ring-fg" stroke-dasharray="${(pct * 0.974).toFixed(1)} 100"/></svg><span>${pct}%</span></button></div>
        <div class="goalline">Goal ${U.fmt(goal, currency())} · ${U.fmt(Math.max(0, goal - month), currency())} to go</div>
        ${barChart(rep.daily, 30)}
      </section>
      <div class="stats">
        <button class="stat" data-tab="inbox"><b>${pending.length}</b><span>To review</span></button>
        <button class="stat" data-go="library:ready"><b>${ready.length}</b><span>To list</span></button>
        <button class="stat" data-go="library:listed"><b>${listed.length}</b><span>Live</span></button>
        <button class="stat" data-go="library:leads"><b>${leads.length}</b><span>Leads & jobs</span></button>
      </div>
      ${setupCard()}${window.EB_AUTO.homeCard()}${problemsCard()}${winnersCard()}
      <button class="primary wide" data-act="run-all">${ic("bolt")} ${running.length ? `Running ${running.length} bot${running.length > 1 ? "s" : ""}...` : "Run all bots"}</button>
      ${steps.length ? `<h2>Next steps</h2><div class="card list">${steps.map(([go, t, s]) => `<button class="row" data-go="${go}"><span class="dot"></span><div><b>${esc(t)}</b><span>${esc(s)}</span></div>${ic("back", "chev")}</button>`).join("")}</div>` : ""}
      <h2>Activity</h2>
      <div class="card list">${runs.length ? runs.map(r => { const b = botById(r.bot); return `<div class="row static"><span class="tile sm">${ic(b ? b.icon : "bot")}</span><div><b>${esc(b ? b.title : r.bot)}</b><span>${esc(r.summary)}</span></div><time>${U.ago(r.startedAt)}</time></div>`; }).join("") : `<p class="empty">No bot has run yet.</p>`}</div>`;
  }

  function setupCard() {
    if (cfg().setupDismissed) return "";
    const anyAuthor = ["puzzle_books", "maze_books", "coloring_books", "notebooks"].some(id => Store.botConfig(id).author);
    const steps = [
      ["Find a niche", items().some(i => i.kind === "niche"), "bots", "Run the Niche Research Bot so bots make what buyers search for."],
      ["Connect Claude", Claude.available(), "settings", IN_CLAUDE ? "" : "Add your Anthropic API key in Settings."],
      ...(IS_NATIVE ? [["Connect Etsy", window.EB_AUTO.Etsy.connected(), "settings", "Lets approved products publish themselves."]] : []),
      ["Set your pen name", anyAuthor, "bots", "Open a book bot's settings and add the author name."],
      ["Approve your first products", items().some(i => ["approved", "listed"].includes(i.status)), "inbox", "Review what the bots made."],
      ["Turn on Autopilot", !!(cfg().auto || {}).autopilot, "", "One switch below schedules everything."],
    ].filter(s => s[3] !== "" || !s[1]);
    const done = steps.filter(s => s[1]).length;
    if (done === steps.length) return "";
    return `<section class="card setup"><div class="ph"><div><b>Get set up</b><span class="muted"> ${done}/${steps.length} done</span></div><button class="iconbtn sm" data-act="dismiss-setup" aria-label="Hide">${ic("x")}</button></div>
      <div class="track"><i style="width:${Math.round(done / steps.length * 100)}%"></i></div>
      <div class="list">${steps.map(([t, ok, go, hint]) => `<button class="row" ${ok ? "disabled" : go === "settings" ? 'data-act="settings"' : go ? `data-tab="${go}"` : ""}><span class="checkmark ${ok ? "on" : ""}">${ok ? ic("check") : ""}</span><div><b>${esc(t)}</b>${ok ? "" : `<span>${esc(hint)}</span>`}</div></button>`).join("")}</div></section>`;
  }
  function problemsCard() {
    const since = Date.now() - 2 * 864e5, latest = {};
    Object.values(S.runs).forEach(r => { if (!latest[r.bot] || r.startedAt > latest[r.bot].startedAt) latest[r.bot] = r; });
    const runs = Object.values(latest).filter(r => r.status === "error" && Date.parse(r.startedAt) > since);
    const pubs = items().filter(i => i.publishError && i.status !== "listed");
    if (!runs.length && !pubs.length) return "";
    return `<h2>Needs attention</h2><div class="card list problems">${runs.map(r => `<div class="row static"><span class="tile sm err">${ic("x")}</span><div><b>${esc(botById(r.bot)?.title || r.bot)}</b><span>${esc(r.summary)}</span></div><button class="ghost" data-act="run" data-bot="${esc(r.bot)}">Retry</button></div>`).join("")}
      ${pubs.map(i => `<div class="row static"><span class="tile sm err">${ic("x")}</span><div><b>${esc(i.title)}</b><span>${esc(i.publishError)}</span></div><button class="ghost" data-act="publish-one" data-id="${esc(i.id)}">Retry</button></div>`).join("")}</div>`;
  }
  function winnersCard() {
    const w = window.EB_WIN.winners(3); if (!w.length) return "";
    return `<h2>Your winners</h2><div class="card list">${w.map(([it, sc]) => { const st = it.data.stats || {}, sales = Object.values(S.earnings).filter(e => e.itemId === it.id).length;
      return `<div class="row static"><button class="linkish" data-item="${esc(it.id)}"><b>${esc(it.title)}</b><span>${sales} sale${sales === 1 ? "" : "s"} · ${st.favorites || 0} favorites · ${st.views || 0} views</span></button><button class="ghost" data-act="variations" data-id="${esc(it.id)}">${ic("spark")}More like this</button></div>`; }).join("")}</div>`;
  }

  function viewBots() {
    const cats = [...new Set(BOTS.map(b => b.category))];
    return `${header("Bots", `${BOTS.filter(b => !isOff(b)).length} active of ${BOTS.length} · tap Run, or switch on Autopilot on Home`)}
      <button class="primary wide" data-act="run-all">${ic("bolt")} Run all bots</button>
      ${cats.map(cat => { const list = BOTS.filter(b => b.category === cat && !isOff(b)); return list.length ? `<h2>${esc(cat)}</h2>${list.map(botCard).join("")}` : ""; }).join("")}
      ${BOTS.some(isOff) ? `<h2>Switched off</h2><div class="card list">${BOTS.filter(isOff).map(b => `<button class="row" data-act="bot-settings" data-bot="${b.id}"><span class="tile sm">${ic(b.icon)}</span><div><b>${esc(b.title)}</b><span>${esc(b.earnsVia)}</span></div>${ic("back", "chev")}</button>`).join("")}</div>` : ""}
      <p class="foot">More bots can be added any time: each one is a small plug-in.</p>`;
  }
  function botCard(b) {
    const r = lastRun(b.id), run = ui.running[b.id], miss = missingNeeds(b);
    const made = items().filter(i => i.bot === b.id).length, auto = parseFloat(Store.botConfig(b.id).auto || 0);
    const badges = [];
    if ((b.needs || []).includes("claude") || (b.uses || []).includes("claude")) badges.push(`<span class="badge ${Claude.available() ? "" : "warn"}">${ic("spark")}Claude${(b.needs || []).includes("claude") ? "" : " (optional)"}</span>`);
    if ((b.needs || []).includes("web") || (b.uses || []).includes("web")) badges.push(`<span class="badge ${Web.available() ? "" : "warn"}">Web${(b.needs || []).includes("web") ? "" : " (optional)"}</span>`);
    if (auto) badges.push(`<span class="badge on">${ic("clock")}Every ${auto}h</span>`);
    return `<article class="card bot ${run ? "busy" : ""}">
      <div class="bot-head"><span class="tile">${ic(b.icon)}</span><div class="grow"><h3>${esc(b.title)}</h3><p>${esc(b.desc)}</p></div></div>
      <div class="badges"><span class="badge money">${ic("wallet")}${esc(b.earnsVia)}</span>${badges.join("")}</div>
      ${run ? `<p class="progress"><span class="spin"></span><span data-progress="${b.id}">${esc(run)}</span></p>`
        : r ? `<p class="last ${r.status}">${esc(r.summary)} <time>${U.ago(r.startedAt)}</time></p>` : ""}
      ${miss && !run ? `<p class="hint">${esc(miss)}</p>` : ""}
      <div class="bot-foot"><span class="muted">${made} made</span><div class="btns">
        <button class="ghost" data-act="bot-settings" data-bot="${b.id}" aria-label="${esc(b.title)} settings">${ic("gear")}</button>
        <button class="primary" data-act="run" data-bot="${b.id}" ${run || miss ? "disabled" : ""}>${ic("play")}${run ? "Working" : "Run"}</button></div></div>
    </article>`;
  }

  function itemVisual(it, big) {
    const k = KINDS[it.kind];
    if (k && k.thumb) return `<img class="thumb ${it.kind}" data-thumb="${esc(it.id)}" src="${thumb(it)}" alt="">`;
    return `<div class="thumb text ${it.kind}">${ic(k ? k.icon : "file")}${big ? "" : `<span>${esc(k ? k.label : it.kind)}</span>`}</div>`;
  }

  function viewInbox() {
    const pending = items().filter(i => i.status === "pending").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const botsWith = [...new Set(pending.map(i => i.bot))];
    const allShown = ui.inboxBot === "all" ? pending : pending.filter(i => i.bot === ui.inboxBot), shown = allShown.slice(0, ui.inboxLimit || 30);
    return `${header("Inbox", pending.length ? `${pending.length} item${pending.length > 1 ? "s" : ""} waiting for your approval` : "All caught up")}
      ${botsWith.length > 1 ? `<div class="chips">${["all", ...botsWith].map(id => `<button class="chip ${ui.inboxBot === id ? "on" : ""}" data-inbox="${id}">${esc(id === "all" ? "All" : botById(id)?.title || id)}</button>`).join("")}</div>` : ""}
      ${allShown.length > 1 ? `<div class="btns spread"><button class="primary" data-act="approve-all">${ic("check")}Approve all ${allShown.length}</button><button class="ghost" data-act="reject-all">${ic("x")}Reject all</button></div>` : ""}
      ${shown.length ? `<div class="grid">${shown.map(it => `<article class="card item">
          <button class="open" data-item="${esc(it.id)}">${itemVisual(it)}<div class="meta"><span class="kind">${esc(KINDS[it.kind]?.label || it.kind)}${window.EB_QA ? window.EB_QA.badge(it) : ""}</span><b>${esc(it.title)}</b><span class="muted">${esc(KINDS[it.kind]?.summary?.(it) || "")}</span></div></button>
          <div class="btns"><button class="primary" data-act="approve" data-id="${esc(it.id)}">${ic("check")}Approve</button><button class="ghost" data-act="reject" data-id="${esc(it.id)}" aria-label="Reject">${ic("x")}</button></div></article>`).join("")}</div>`
        : `<div class="emptystate">${ic("inbox")}<b>Nothing to review</b><span>New work from your bots lands here.</span><button class="primary" data-tab="bots">${ic("play")}Run a bot</button></div>`}
      ${allShown.length > shown.length ? `<button class="ghost wide" data-act="inbox-more">Show more (${allShown.length - shown.length} left)</button>` : ""}`;
  }

  const LIB_FILTERS = [["all", "All"], ["products", "Printables & art"], ["books", "Books"], ["design", "Designs"], ["content", "Content"], ["leads", "Leads & jobs"], ["deal", "Deals"], ["research", "Research"]];
  const GROUPS = { products: ["printable", "wallart", "worksheet"], books: ["puzzlebook", "kdpbook", "ebook"], design: ["design"], content: ["content", "article", "post", "pin"], leads: ["lead", "opportunity", "gig"], deal: ["deal"], research: ["niche"] };
  function viewLibrary() {
    let list = items().filter(i => i.status !== "pending" && i.status !== "rejected");
    if (ui.libKind !== "all") list = list.filter(i => (GROUPS[ui.libKind] || [ui.libKind]).includes(i.kind));
    if (ui.libStatus !== "all") list = list.filter(i => i.status === ui.libStatus);
    if (ui.search) { const q = ui.search.toLowerCase(); list = list.filter(i => (i.title + " " + JSON.stringify(i.data.tags || "")).toLowerCase().includes(q)); }
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = list.length, shownN = ui.libLimit || 40; list = list.slice(0, shownN);
    const kindsHere = (GROUPS[ui.libKind] || []).length === 1 ? KINDS[GROUPS[ui.libKind][0]] : null;
    const statuses = kindsHere && kindsHere.pipeline ? kindsHere.pipeline : ui.libKind === "leads" ? ["new", "contacted", "applied", "won", "lost"] : ["approved", "listed"];
    const labels = { approved: "To list", listed: "Live", new: "New", contacted: "Contacted", applied: "Applied", won: "Won", lost: "Lost", bought: "Bought", sold: "Sold", skipped: "Skipped", using: "In use" };
    return `${header("Library", `${total} item${total === 1 ? "" : "s"}`)}
      <label class="searchbox">${ic("search")}<input type="search" id="libsearch" placeholder="Search your library" value="${esc(ui.search)}"></label>
      <div class="chips">${LIB_FILTERS.map(([k, l]) => `<button class="chip ${ui.libKind === k ? "on" : ""}" data-lib="${k}">${l}</button>`).join("")}</div>
      <div class="chips small">${["all", ...statuses].map(s => `<button class="chip ${ui.libStatus === s ? "on" : ""}" data-libs="${s}">${s === "all" ? "Any status" : labels[s] || s}</button>`).join("")}</div>
      ${list.length ? `<div class="grid">${list.map(it => `<article class="card item"><button class="open" data-item="${esc(it.id)}">${itemVisual(it)}<div class="meta"><span class="kind">${esc(KINDS[it.kind]?.label || it.kind)} · <span class="st ${it.status}">${esc(labels[it.status] || it.status)}</span></span><b>${esc(it.title)}</b><span class="muted">${esc(KINDS[it.kind]?.summary?.(it) || "")}</span></div></button></article>`).join("")}</div>`
        : `<div class="emptystate">${ic("library")}<b>Nothing here yet</b><span>Approved items and new leads appear here.</span></div>`}
      ${total > shownN ? `<button class="ghost wide" data-act="lib-more">Show more (${total - shownN} left)</button>` : ""}`;
  }

  function viewMoney() {
    const rep = report(ui.period), cur = currency();
    const main = rep.total[cur] || 0, avg = rep.count ? Math.round(Object.values(rep.total).reduce((a, b) => a + b, 0) / rep.count) : 0;
    const rows = Object.entries(S.earnings).sort((a, b) => b[1].date.localeCompare(a[1].date)).slice(0, 40);
    const bars = (obj, name) => { const e = Object.entries(obj).map(([k, v]) => [k, v[cur] || 0, v]).sort((a, b) => b[1] - a[1]); const max = Math.max(1, ...e.map(x => x[1]));
      return e.map(([k, v, all]) => `<div class="hbar"><div class="hl"><span>${esc(name(k))}</span><b>${esc(U.money(all))}</b></div><div class="track"><i style="width:${Math.round(v / max * 100)}%"></i></div></div>`).join(""); };
    return `${header("Money", "What your bots earn")}
      <div class="chips">${[[7, "7 days"], [30, "30 days"], [90, "90 days"], [0, "All time"]].map(([d, l]) => `<button class="chip ${ui.period === d ? "on" : ""}" data-period="${d}">${l}</button>`).join("")}</div>
      <section class="card hero"><span class="label">Earned</span><div class="big">${esc(U.money(rep.total))}</div>
        <div class="kpis"><div><b>${rep.count}</b><span>sales</span></div><div><b>${U.fmt(avg, cur)}</b><span>average</span></div><div><b>${U.fmt(monthTotal(), cur)}</b><span>this month</span></div></div>
        ${barChart(rep.daily, ui.period || 90)}</section>
      <div class="btns spread"><button class="primary" data-act="add-sale">${ic("plus")}Log a sale</button>
        ${IS_NATIVE ? `<button class="ghost" data-act="sync-gumroad">${ic("sync")}Sync sales</button>` : ""}
        <button class="ghost" data-act="export-csv">${ic("download")}CSV</button></div>
      ${Object.keys(rep.byBot).length ? `<h2>By bot</h2><div class="card">${bars(rep.byBot, k => botById(k)?.title || (k === "manual" ? "Not linked" : k))}</div>` : ""}
      ${Object.keys(rep.byPlat).length ? `<h2>By platform</h2><div class="card">${bars(rep.byPlat, k => k)}</div>` : ""}
      ${rep.top.length ? `<h2>Best sellers</h2><div class="card list">${rep.top.map(t => `<button class="row" data-item="${esc(t.it.id)}"><div><b>${esc(t.it.title)}</b><span>${t.n} sale${t.n > 1 ? "s" : ""}</span></div><b>${esc(U.money(t.sums))}</b></button>`).join("")}</div>` : ""}
      <h2>Sales</h2><div class="card list">${rows.length ? rows.map(([id, r]) => `<div class="row static"><div><b>${U.fmt(r.amountCents, r.currency)}</b><span>${esc(r.platform)} · ${esc(S.items[r.itemId]?.title || r.note || "Not linked")}</span></div><time>${esc(r.date.slice(0, 10))}</time><button class="iconbtn sm" data-act="del-sale" data-id="${esc(id)}" aria-label="Delete sale">${ic("trash")}</button></div>`).join("") : `<p class="empty">No sales yet. When something sells, log it here, or sync Gumroad in the Android app.</p>`}</div>`;
  }

  // ---- sheets ----------------------------------------------------------------------------------
  function openSheet(s) { ui.sheet = s; renderSheet(); }
  function closeSheet() { ui.sheet = null; renderSheet(); }

  function sheetItem(it) {
    const k = KINDS[it.kind] || {}, b = botById(it.bot), d = it.data;
    const statusLabel = { pending: "Waiting for review", approved: "Approved, not listed yet", listed: "Live", using: "Fed to your bots", new: "New" }[it.status] || (it.status[0].toUpperCase() + it.status.slice(1));
    let body = "";
    if (it.kind === "content") body += `<div class="slides">${[0, ...(d.slides || []).map((_, i) => i + 1), (d.slides || []).length + 1].map(i => `<img src="${M.slideCanvas(it, i, 360).toDataURL("image/jpeg", 0.8)}" alt="">`).join("")}</div>`;
    else if (k.thumb) body += `<img class="hero-img" data-thumb="${esc(it.id)}" src="${thumb(it)}" alt="">`;
    if (it.kind === "lead") body += `<dl class="facts">${[["Type", d.category], ["Address", d.address], ["Phone", d.phone], ["Email", d.email], ["Social", d.social]].filter(f => f[1]).map(([a, v]) => `<dt>${a}</dt><dd>${esc(v)}</dd>`).join("")}</dl><h4>Pitch</h4><pre>${esc(d.pitchSubject)}\n\n${esc(d.pitchBody)}</pre>`;
    if (it.kind === "opportunity") body += `<dl class="facts">${[["Source", d.source], ["Company", d.company], ["Pay", d.salary], ["Location", d.location], ["Posted", d.date && new Date(d.date).toLocaleDateString()], ["Tags", (d.tags || []).join(", ")]].filter(f => f[1]).map(([a, v]) => `<dt>${a}</dt><dd>${esc(v)}</dd>`).join("")}</dl>${d.proposal ? `<h4>Your proposal</h4><pre>${esc(d.proposal)}</pre>` : ""}`;
    if (it.kind === "deal") body += `<dl class="facts"><dt>Price now</dt><dd>${U.fmt(Math.round(d.price * 100), d.currency)}</dd><dt>Your buy price</dt><dd>${U.fmt(Math.round(d.target * 100), d.currency)}</dd>${d.resell ? `<dt>Resale estimate</dt><dd>${U.fmt(Math.round(d.resell * 100), d.currency)} (profit about ${U.fmt(Math.round((d.resell - d.price) * 100), d.currency)})</dd>` : ""}</dl>`;
    if (it.kind === "niche") body += `<div class="kpis inline"><div><b>${d.score}</b><span>score / 100</span></div><div><b>${d.etsy ? d.etsy.count.toLocaleString() : d.estimated ? `${d.est.competition}/10` : "?"}</b><span>${d.etsy ? "Etsy listings" : "competition"}</span></div><div><b>${d.etsy ? d.etsy.fav : d.estimated ? `${d.est.demand}/10` : d.suggestHits}</b><span>${d.etsy ? "avg favorites" : "demand"}</span></div></div>
      <dl class="facts"><dt>Make</dt><dd>${esc(window.EB_WIN.TYPES[d.type] || d.type)}</dd>${d.angle ? `<dt>Angle</dt><dd>${esc(d.angle)}</dd>` : ""}${d.etsy && d.etsy.price ? `<dt>Typical price</dt><dd>${d.etsy.p25 ? `${d.etsy.p25}–${d.etsy.p75} (median ${d.etsy.price})` : d.etsy.price}${d.etsy.digitalShare != null ? ` · ${d.etsy.digitalShare}% digital` : ""}</dd>` : ""}${d.etsy && d.etsy.sample ? `<dt>Newcomers</dt><dd>${d.etsy.freshWin || 0} of the top ${d.etsy.sample} are under 4 months old with 10+ favorites${d.etsy.freshWin ? " (room for new shops)" : ""}</dd>` : ""}${d.etsy && (d.etsy.tags || []).length ? `<dt>Top sellers' tags</dt><dd>${esc(d.etsy.tags.slice(0, 15).map(t => t[0]).join(", "))}</dd>` : ""}<dt>Data</dt><dd>${d.estimated ? "Claude's estimate (no live data here)" : "Google + Amazon suggestions" + (d.etsy ? ", Etsy search" : "")}</dd></dl>`;
    if (it.kind === "article") body += `<p class="muted">Keyword: “${esc(d.keyword)}” · ${esc(d.meta)}</p><div class="article">${M.mdToHtml(d.markdown)}</div>`;
    if (it.kind === "puzzlebook") body += `<dl class="facts"><dt>Subtitle</dt><dd>${esc(d.subtitle)}</dd><dt>Puzzles</dt><dd>${d.count}, with solutions</dd><dt>Format</dt><dd>8.5 x 11 in paperback, large print</dd><dt>Price</dt><dd>${d.price.toFixed(2)} USD</dd></dl>`;
    if (["printable", "design", "puzzlebook", "content"].includes(it.kind)) {
      const desc = d.description || d.caption || "";
      if (desc) body += `<details><summary>Listing text</summary><p class="t">${esc(d.title || "")}</p><pre>${esc(desc)}</pre>${d.tags ? `<p class="muted">Tags: ${esc(d.tags.join(", "))}</p>` : ""}${d.hashtags ? `<p class="muted">${esc(d.hashtags.map(h => "#" + h.replace(/^#/, "")).join(" "))}</p>` : ""}</details>`;
    }
    const acts = [];
    if (it.status === "pending") acts.push(`<button class="primary" data-act="approve" data-id="${esc(it.id)}">${ic("check")}Approve</button>`, `<button class="ghost" data-act="reject" data-id="${esc(it.id)}">${ic("x")}Reject</button>`);
    if (k.kit) acts.push(`<button class="${it.status === "pending" ? "ghost" : "primary"}" data-act="kit" data-id="${esc(it.id)}">${ic("download")}${ui.running["kit:" + it.id] ? "Building..." : "Download kit"}</button>`);
    (k.copy ? k.copy(it) : []).forEach(([label], i) => acts.push(`<button class="ghost" data-act="copy" data-id="${esc(it.id)}" data-n="${i}">${ic("copy")}${esc(label)}</button>`));
    if (it.kind === "lead") {
      if (d.email) acts.push(`<a class="btn primary" href="mailto:${esc(d.email)}?subject=${encodeURIComponent(d.pitchSubject)}&body=${encodeURIComponent(d.pitchBody)}">${ic("mail")}Email</a>`);
      if (d.phone) acts.push(`<a class="btn ghost" href="tel:${esc(d.phone.replace(/\s/g, ""))}">${ic("phone")}${esc(d.phone)}</a>`);
      if (d.osm) acts.push(`<button class="ghost" data-act="open" data-url="${esc(d.osm)}">${ic("link")}Map</button>`);
    }
    if (it.kind === "opportunity") { acts.push(`<button class="primary" data-act="open" data-url="${esc(d.url)}">${ic("link")}Open</button>`); acts.push(`<button class="ghost" data-act="proposal" data-id="${esc(it.id)}">${ic("spark")}${ui.running["prop:" + it.id] ? "Writing..." : d.proposal ? "Rewrite proposal" : "Draft proposal"}</button>`); }
    if (it.kind === "niche" && it.status !== "using") acts.push(`<button class="primary" data-act="use-niche" data-id="${esc(it.id)}">${ic("bolt")}Use this niche</button>`);
    if (["printable", "wallart", "design", "kdpbook", "worksheet", "dplanner", "paperpack"].includes(it.kind) && it.status !== "pending") acts.push(`<button class="ghost" data-act="variations" data-id="${esc(it.id)}">${ic("spark")}Make 3 variations</button>`);
    if (it.kind === "deal") acts.push(`<button class="primary" data-act="open" data-url="${esc(d.url)}">${ic("link")}Open offer</button>`);
    const pipeline = k.pipeline ? `<div class="seg">${k.pipeline.map(s => `<button class="${it.status === s ? "on" : ""}" data-act="status" data-id="${esc(it.id)}" data-status="${s}">${s[0].toUpperCase() + s.slice(1)}</button>`).join("")}</div>` : "";
    const links = !k.pipeline && it.status !== "pending" ? `<form class="links" data-id="${esc(it.id)}"><h4>Where is it listed?</h4>${(k.platforms || ["Other"]).map(p => `<label>${esc(p)} link<input name="${esc(p)}" value="${esc((it.links || {})[p] || "")}" placeholder="https://..."></label>`).join("")}<button class="ghost">Save links</button></form>` : "";
    const sold = it.status !== "pending" && it.kind !== "niche" ? `<button class="ghost" data-act="add-sale" data-id="${esc(it.id)}">${ic("plus")}Log a sale</button>` : "";
    return `<div class="sheet-head"><span class="kindtag">${ic(k.icon)}${esc(k.label || it.kind)}</span><button class="iconbtn" data-act="close" aria-label="Close">${ic("x")}</button></div>
      <h2 class="sheet-title">${esc(it.title)}</h2>
      <p class="muted">${esc(statusLabel)} · by ${esc(b ? b.title : it.bot)} · ${U.ago(it.createdAt)}${it.price ? ` · ${Number(it.price).toFixed(2)}` : ""}</p>
      ${pipeline}<div class="btns wrap">${window.EB_AUTO.itemActions(it)}${acts.join("")}${sold}</div>${window.EB_QA ? window.EB_QA.sheetHtml(it) : ""}${body}${links}
      <button class="danger-link" data-act="delete-item" data-id="${esc(it.id)}">${ic("trash")}Delete</button>`;
  }

  function sheetBot(b) {
    const c = botCfg(b), auto = Store.botConfig(b.id).auto || 0;
    const fields = (b.settings || []).map(s => {
      const v = c[s.key] ?? "";
      if (s.type === "select") return `<label>${esc(s.label)}<select name="${s.key}">${s.options.map(([val, l]) => `<option value="${esc(val)}" ${String(v) === String(val) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
      if (s.type === "textarea") return `<label>${esc(s.label)}<textarea name="${s.key}" rows="4" placeholder="${esc(s.placeholder || "")}">${esc(v)}</textarea></label>`;
      return `<label>${esc(s.label)}<input name="${s.key}" type="${s.type === "number" ? "number" : "text"}" ${s.min != null ? `min="${s.min}" max="${s.max}"` : ""} value="${esc(v)}" placeholder="${esc(s.placeholder || "")}"></label>`;
    }).join("");
    const watches = b.watches ? `<h4>Watched products</h4>
      <div class="list">${Object.values(S.watches).map(w => `<div class="row static"><div><b>${esc(w.name || w.url)}</b><span>${w.last != null ? `Now ${w.last} · ` : ""}buy at ${w.target}${w.resell ? ` · resell ${w.resell}` : ""}${w.error ? ` · ${esc(w.error)}` : ""}</span></div><button class="iconbtn sm" data-act="del-watch" data-id="${esc(w.id)}" aria-label="Remove">${ic("trash")}</button></div>`).join("") || `<p class="empty">No products yet. Paste a link from any shop or marketplace.</p>`}</div>
      <form class="addwatch"><label>Product link<input name="url" type="url" required placeholder="https://..."></label><div class="two"><label>Name<input name="name" placeholder="e.g. Nike Air Max 90"></label><label>Buy at or below<input name="target" type="number" step="0.01" required></label></div><div class="two"><label>Resale price (optional)<input name="resell" type="number" step="0.01"></label><label>Currency<input name="currency" value="${esc(currency())}"></label></div><button class="ghost">${ic("plus")}Add product</button></form>` : "";
    return `<div class="sheet-head"><span class="kindtag">${ic(b.icon)}Bot settings</span><button class="iconbtn" data-act="close" aria-label="Close">${ic("x")}</button></div>
      <h2 class="sheet-title">${esc(b.title)}</h2><p class="muted">${esc(b.desc)}</p>
      ${botStats(b)}
      <form class="botform" data-bot="${b.id}"><label class="check"><input type="checkbox" name="active" ${isOff(b) ? "" : "checked"}> Bot is active (switched-off bots never run)</label>${fields}${window.EB_AUTO.approveField(b)}
        <label>Autopilot<select name="auto">${[[0, "Off: only when I tap Run"], [1, "Every hour"], [6, "Every 6 hours"], [12, "Every 12 hours"], [24, "Once a day"]].map(([h, l]) => `<option value="${h}" ${String(auto) === String(h) ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <p class="hint">Autopilot runs while the app is open. New work still waits in your Inbox.</p>
        <button class="primary wide">Save</button></form>${watches}`;
  }

  function botStats(b) {
    const mine = items().filter(i => i.bot === b.id), ok = mine.filter(i => !["pending", "rejected"].includes(i.status)).length;
    const earned = {}; Object.values(S.earnings).forEach(r => { const it = S.items[r.itemId]; if (it && it.bot === b.id) earned[r.currency] = (earned[r.currency] || 0) + r.amountCents; });
    const runs = Object.values(S.runs).filter(r => r.bot === b.id).sort((x, y) => y.startedAt.localeCompare(x.startedAt)).slice(0, 4);
    return `<div class="kpis inline"><div><b>${mine.length}</b><span>made</span></div><div><b>${mine.length ? Math.round(ok / mine.length * 100) : 0}%</b><span>approved</span></div><div><b>${esc(U.money(earned))}</b><span>earned</span></div></div>
      ${runs.length ? `<div class="list mini">${runs.map(r => `<div class="row static"><div><span class="${r.status === "ok" ? "" : "errtext"}">${esc(r.summary)}</span></div><time>${U.ago(r.startedAt)}</time></div>`).join("")}</div>` : ""}`;
  }

  function sheetSale(itemId) {
    const sellable = items().filter(i => i.status !== "pending" && i.status !== "rejected");
    const it = itemId ? S.items[itemId] : null, plat = it ? (KINDS[it.kind]?.platforms || [])[0] : "Etsy";
    return `<div class="sheet-head"><span class="kindtag">${ic("wallet")}New sale</span><button class="iconbtn" data-act="close" aria-label="Close">${ic("x")}</button></div>
      <h2 class="sheet-title">Log a sale</h2>
      <form class="saleform"><div class="two"><label>Amount<input name="amount" type="number" step="0.01" min="0" required placeholder="4.90" inputmode="decimal"></label>
        <label>Currency<select name="currency">${["EUR", "USD", "GBP", "CHF", "PLN", "RSD"].map(c => `<option ${currency() === c ? "selected" : ""}>${c}</option>`).join("")}</select></label></div>
        <div class="two"><label>Platform<select name="platform">${PLATFORMS.map(p => `<option ${p === plat ? "selected" : ""}>${esc(p)}</option>`).join("")}</select></label>
        <label>Date<input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}"></label></div>
        <label>What sold<select name="itemId"><option value="">Not linked to an item</option>${sellable.map(i => `<option value="${esc(i.id)}" ${i.id === itemId ? "selected" : ""}>${esc(i.title.slice(0, 70))}</option>`).join("")}</select></label>
        <label>Note<input name="note" placeholder="optional"></label><button class="primary wide">Add sale</button></form>`;
  }

  function sheetSettings() {
    const c = cfg();
    return `<div class="sheet-head"><span class="kindtag">${ic("gear")}Settings</span><button class="iconbtn" data-act="close" aria-label="Close">${ic("x")}</button></div>
      <h2 class="sheet-title">Settings</h2>
      <form class="settingsform">
        <div class="two"><label>Monthly goal<input name="goal" type="number" min="1" value="${esc(c.goal || 500)}"></label>
        <label>Main currency<select name="currency">${["EUR", "USD", "GBP", "CHF", "PLN", "RSD"].map(x => `<option ${currency() === x ? "selected" : ""}>${x}</option>`).join("")}</select></label></div>
        <label>Appearance<select name="theme">${[["auto", "Match my phone"], ["light", "Light"], ["dark", "Dark"]].map(([v, l]) => `<option value="${v}" ${(LS.get("eb_theme", "auto")) === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        ${IN_CLAUDE ? `<p class="hint">${ic("spark")}Claude-powered bots work here without a key.</p>` : `
        <label>Anthropic API key (Claude bots)<input name="key" type="password" value="${esc(LS.get("eb_anthropic_key", ""))}" placeholder="sk-ant-..." autocomplete="off"></label>
        <p class="hint">Get one at console.anthropic.com. Stored only on this phone. A bot run costs a few cents.</p>
        <label>Gumroad access token (sales sync)<input name="gumroad" type="password" value="${esc(LS.get("eb_gumroad", ""))}" autocomplete="off"></label>
        <p class="hint">Gumroad > Settings > Advanced > Applications > create one and generate a token.</p>`}
        <button class="primary wide">Save settings</button></form>
      ${window.EB_CLOUD ? window.EB_CLOUD.settingsHtml() : ""}
      ${window.EB_AUTO.settingsSection()}
      <h4>Diagnostics</h4><p class="muted">Checks every connection and shows what to fix.</p><button class="ghost" data-act="diagnostics">${ic("bolt")}Run checks</button><div id="diag"></div>
      <h4>Activity log</h4><p class="muted">What the app did and any errors. Send this to Claude if something goes wrong.</p>
      <div class="btns wrap"><button class="ghost" data-act="show-log">Show log</button><button class="ghost" data-act="export-log">${ic("download")}Export log</button></div><div id="logbox"></div>
      <h4>Your data</h4><p class="muted">${S.mode === "claude" ? "Saved in this artifact's private database, wherever you open it in Claude." : "Saved on this device. Back it up now and then."} ${items().length} items, ${Object.keys(S.earnings).length} sales.</p>
      <div class="btns wrap"><button class="ghost" data-act="backup">${ic("download")}Back up</button><label class="btn ghost">${ic("sync")}Restore<input type="file" id="restore" accept=".json,application/json" hidden></label></div>
      <p class="foot">Earning Bots ${VERSION} · ${S.mode === "claude" ? "running in Claude" : IS_NATIVE ? "Android app" : "browser"}</p>`;
  }

  function sheetCopy(s) {
    return `<div class="sheet-head"><span class="kindtag">${ic("copy")}${esc(s.label)}</span><button class="iconbtn" data-act="close" aria-label="Close">${ic("x")}</button></div>
      <p class="muted">Select the text and copy it.</p><textarea class="copyarea" readonly>${esc(s.text)}</textarea>`;
  }

  // ---- rendering -----------------------------------------------------------------------------
  function applyTheme() {
    const t = LS.get("eb_theme", "auto");
    document.documentElement.dataset.theme = t === "auto" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : t;
  }
  function render() {
    const view = document.getElementById("view"); if (!view) return;
    if (!S.ready) { view.innerHTML = `<div class="loading"><span class="spin"></span>Loading your bots...</div>`; }
    else view.innerHTML = { home: viewHome, bots: viewBots, inbox: viewInbox, library: viewLibrary, money: viewMoney }[ui.tab]();
    const pending = items().filter(i => i.status === "pending").length;
    document.getElementById("nav").innerHTML = TABS.map(([id, label, icon]) => `<button class="${ui.tab === id ? "on" : ""}" data-tab="${id}" aria-label="${label}">${ic(icon)}<span>${label}</span>${id === "inbox" && pending ? `<em>${pending > 99 ? "99+" : pending}</em>` : ""}</button>`).join("");
    if (ui.sheet && ui.sheet.type === "item" && !document.getElementById("sheet").contains(document.activeElement)) renderSheet();
  }
  function renderSheet() {
    const el = document.getElementById("sheet"), s = ui.sheet;
    if (!s) { el.classList.remove("open"); setTimeout(() => { if (!ui.sheet) el.innerHTML = ""; }, 250); return; }
    let inner = "";
    if (s.type === "item") { const it = S.items[s.id]; if (!it) return closeSheet(); inner = sheetItem(it); }
    else if (s.type === "bot") inner = sheetBot(botById(s.id));
    else if (s.type === "sale") inner = sheetSale(s.itemId);
    else if (s.type === "settings") inner = sheetSettings();
    else if (s.type === "copy") inner = sheetCopy(s);
    el.innerHTML = `<div class="scrim" data-act="close"></div><div class="panel" role="dialog" aria-modal="true">${inner}</div>`;
    requestAnimationFrame(() => el.classList.add("open"));
    if (s.type === "copy") { const ta = el.querySelector("textarea"); ta.focus(); ta.select(); }
  }
  function renderToasts() {
    document.getElementById("toasts").innerHTML = ui.toasts.map(t => `<div class="toast ${t.kind}">${esc(t.msg)}</div>`).join("");
  }
  function setTab(t) { ui.tab = t; try { history.replaceState(null, "", "#" + t); } catch { /* ignore */ } render(); window.scrollTo(0, 0); }

  // ---- actions ------------------------------------------------------------------------------
  async function act(name, el) {
    const id = el.dataset.id, it = id ? S.items[id] : null;
    switch (name) {
      case "settings": return openSheet({ type: "settings" });
      case "close": return closeSheet();
      case "run": return runBot(botById(el.dataset.bot));
      case "run-all": return runAll();
      case "bot-settings": return openSheet({ type: "bot", id: el.dataset.bot });
      case "approve": if (it) { if (ui.sheet?.type === "item") closeSheet(); toast("Approved. Find it in your Library."); await window.EB_AUTO.approve(it); } return;
      case "reject": if (it) { await Store.patch("items", id, { status: "rejected" }); if (ui.sheet?.type === "item") closeSheet(); } return;
      case "approve-all": case "reject-all": {
        const list = items().filter(i => i.status === "pending" && (ui.inboxBot === "all" || i.bot === ui.inboxBot));
        for (const i of list) { if (name === "approve-all") await window.EB_AUTO.approve(i, true, true); else await Store.patch("items", i.id, { status: "rejected" }); }
        return toast(name === "approve-all" ? `${list.length} approved` : `${list.length} rejected`);
      }
      case "kit": {
        if (!it || ui.running["kit:" + id]) return;
        ui.running["kit:" + id] = true; renderSheet();
        try { const kit = await KINDS[it.kind].kit(it); await Files.save(kit.name, kit.blob); }
        catch (e) { toast("Couldn't build the kit: " + (e.message || e), "error"); }
        delete ui.running["kit:" + id]; renderSheet(); return;
      }
      case "copy": { const [label, text] = KINDS[it.kind].copy(it)[+el.dataset.n]; return Files.copy(text, label); }
      case "open": return Files.open(el.dataset.url);
      case "status": return Store.patch("items", id, { status: el.dataset.status });
      case "proposal": {
        if (!Claude.available()) return toast(Claude.why(), "error");
        ui.running["prop:" + id] = true; renderSheet();
        try {
          const prof = Store.botConfig("job_scanner").keywords || "";
          const r = await Claude.json(`Write a short, specific freelance proposal (120-180 words, plain text, no placeholders like [Name]) for this opportunity. Skills I can mention: ${prof}. Be honest, don't invent past clients or numbers. End with one question about the project.
Opportunity: ${JSON.stringify({ title: it.data.title, company: it.data.company, source: it.data.source, tags: it.data.tags, url: it.data.url })}
Return JSON {"proposal": "..."}`);
          await Store.patch("items", id, { data: { ...it.data, proposal: U.clampStr(r.proposal, 3000) } });
        } catch (e) { toast("Couldn't write it: " + (e.message || e), "error"); }
        delete ui.running["prop:" + id]; renderSheet(); return;
      }
      case "use-niche": await window.EB_WIN.useNiche(it.data); toast(`“${it.data.keyword}” sent to your bots`); return renderSheet();
      case "variations": { try { const n = await window.EB_WIN.variations(it); toast(`${n} variation${n === 1 ? "" : "s"} waiting in your Inbox`); } catch (e) { toast(e.message, "error"); } return; }
      case "show-log": {
        const box = document.getElementById("logbox"), L = window.EB.Log.entries.slice(-60).reverse();
        box.innerHTML = L.length ? `<div class="list mini log">${L.map(e => `<div class="row static"><div><span class="${e.level === "error" ? "errtext" : ""}">${esc(e.msg)}</span></div><time>${esc(e.t.slice(5, 16).replace("T", " "))}</time></div>`).join("")}</div>` : `<p class="muted">Nothing logged yet.</p>`;
        return;
      }
      case "export-log": {
        const txt = [`Earning Bots ${VERSION} · ${S.mode} · ${IS_NATIVE ? "Android" : IN_CLAUDE ? "Claude" : "browser"} · ${navigator.userAgent}`, `items ${items().length} · sales ${Object.keys(S.earnings).length}`, "", ...window.EB.Log.entries.map(e => `${e.t} ${e.level.toUpperCase()} ${e.msg}`)].join("\n");
        return Files.save(`earning-bots-log-${new Date().toISOString().slice(0, 10)}.txt`, new Blob([txt], { type: "text/plain" }));
      }
      case "inbox-more": ui.inboxLimit = (ui.inboxLimit || 30) + 30; return render();
      case "lib-more": ui.libLimit = (ui.libLimit || 40) + 40; return render();
      case "dismiss-setup": return Store.setConfig({ setupDismissed: true });
      case "diagnostics": {
        const box = document.getElementById("diag"); box.innerHTML = `<p class="muted"><span class="spin"></span> Checking...</p>`;
        const res = await window.EB_AUTO.diagnostics();
        box.innerHTML = `<div class="list mini">${res.map(([n, ok, msg]) => `<div class="row static"><span class="checkmark ${ok ? "on" : "bad"}">${ic(ok ? "check" : "x")}</span><div><b>${esc(n)}</b><span>${esc(msg)}</span></div></div>`).join("")}</div>`;
        return;
      }
      case "delete-item": if (it) { await Store.remove("items", id); closeSheet(); toast("Deleted"); } return;
      case "add-sale": return openSheet({ type: "sale", itemId: id || "" });
      case "del-sale": return Store.remove("earnings", id);
      case "del-watch": await Store.remove("watches", id); return renderSheet();
      case "export-csv": {
        const rows = [["date", "amount", "currency", "platform", "item", "bot", "note"], ...Object.values(S.earnings).sort((a, b) => a.date.localeCompare(b.date)).map(r => [r.date.slice(0, 10), (r.amountCents / 100).toFixed(2), r.currency, r.platform, S.items[r.itemId]?.title || "", S.items[r.itemId]?.bot || r.bot || "", r.note || ""])];
        return Files.save(`earnings-${new Date().toISOString().slice(0, 10)}.csv`, new Blob([rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" }));
      }
      case "sync-gumroad": return window.EB_AUTO.syncSales();
      default: if ((window.EB_CLOUD && await window.EB_CLOUD.handleAct(name)) || (await window.EB_AUTO.handleAct(name, el)) === true) { renderSheet(); render(); } return;
      case "backup": {
        const data = JSON.stringify({ app: "earning-bots", version: VERSION, exportedAt: U.now(), items: S.items, earnings: S.earnings, watches: S.watches, config: S.config }, null, 1);
        return Files.save(`earning-bots-backup-${new Date().toISOString().slice(0, 10)}.json`, new Blob([data], { type: "application/json" }));
      }
    }
  }

  async function syncGumroad(quiet) {
    const token = LS.get("eb_gumroad", "");
    if (!token) { if (quiet) return; toast("Add your Gumroad token in Settings first.", "error"); return openSheet({ type: "settings" }); }
    if (!quiet) toast("Syncing Gumroad...");
    try {
      const byName = {}; items().forEach(i => { byName[i.data.shortName || i.title] = i; });
      let key = "", added = 0;
      for (let page = 0; page < 20; page++) {
        const r = await Web.json(`https://api.gumroad.com/v2/sales?access_token=${encodeURIComponent(token)}${key ? "&page_key=" + encodeURIComponent(key) : ""}`);
        for (const s of r.sales || []) {
          if (s.refunded || s.chargedback || S.earnings["gumroad-" + s.id]) continue;
          const it = byName[s.product_name];
          await Store.save("earnings", "gumroad-" + s.id, { amountCents: Number(s.price) || 0, currency: (s.currency || "usd").toUpperCase(), platform: "Gumroad", itemId: it ? it.id : "", bot: it ? it.bot : "", date: s.created_at || U.now(), note: s.product_name });
          added++;
        }
        if (!r.next_page_key) break; key = r.next_page_key;
      }
      if (!quiet || added) toast(`Gumroad: ${added} new sale${added === 1 ? "" : "s"}`);
    } catch (e) { if (quiet) throw e; toast("Gumroad sync failed: " + e.message, "error"); }
  }

  // ---- events ----------------------------------------------------------------------------------
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-tab],[data-act],[data-item],[data-go],[data-lib],[data-libs],[data-inbox],[data-period]");
    if (!t) return;
    if (t.dataset.tab) return setTab(t.dataset.tab);
    if (t.dataset.go) { const [tab, f] = t.dataset.go.split(":"); if (tab === "library") { ui.libKind = f === "leads" ? "leads" : "all"; ui.libStatus = f === "ready" ? "approved" : f === "listed" ? "listed" : "all"; } return setTab(tab); }
    if (t.dataset.item) return openSheet({ type: "item", id: t.dataset.item });
    if (t.dataset.lib) { ui.libKind = t.dataset.lib; ui.libStatus = "all"; ui.libLimit = 40; return render(); }
    if (t.dataset.libs) { ui.libStatus = t.dataset.libs; return render(); }
    if (t.dataset.inbox) { ui.inboxBot = t.dataset.inbox; return render(); }
    if (t.dataset.period) { ui.period = +t.dataset.period; return render(); }
    if (t.dataset.act) act(t.dataset.act, t);
  });
  document.addEventListener("input", e => {
    if (e.target.id === "libsearch") { ui.search = e.target.value; const pos = e.target.selectionStart; render(); const s = document.getElementById("libsearch"); s.focus(); s.setSelectionRange(pos, pos); }
  });
  document.addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target, fd = new FormData(f);
    if ((window.EB_CLOUD && await window.EB_CLOUD.handleSubmit(f, fd)) || await window.EB_AUTO.handleSubmit(f, fd)) { renderSheet(); return render(); }
    if (f.classList.contains("botform")) {
      const b = botById(f.dataset.bot), vals = {};
      for (const [k, v] of fd.entries()) if (k !== "active") vals[k] = k === "auto" ? parseFloat(v) || 0 : String(v);
      vals.disabled = !fd.has("active"); if (vals.disabled) vals.auto = 0;
      await Store.setBotConfig(b.id, vals); closeSheet(); toast(`${b.title} settings saved`);
    } else if (f.classList.contains("addwatch")) {
      const id = U.uid();
      await Store.save("watches", id, { id, url: String(fd.get("url")).trim(), name: String(fd.get("name") || "").trim(), target: parseFloat(fd.get("target")), resell: parseFloat(fd.get("resell")) || 0, currency: String(fd.get("currency") || currency()).toUpperCase(), history: [] });
      renderSheet(); toast("Watching it now. Run the Deal Finder to check prices.");
    } else if (f.classList.contains("saleform")) {
      const amount = Math.round(parseFloat(String(fd.get("amount")).replace(",", ".")) * 100);
      if (!(amount > 0)) return toast("Enter the amount", "error");
      const itemId = String(fd.get("itemId") || "");
      await Store.save("earnings", U.uid(), { amountCents: amount, currency: fd.get("currency"), platform: fd.get("platform"), itemId, bot: S.items[itemId]?.bot || "", date: new Date(fd.get("date") + "T12:00:00").toISOString(), note: String(fd.get("note") || "") });
      if (itemId && S.items[itemId] && S.items[itemId].status === "approved") await Store.patch("items", itemId, { status: "listed" });
      closeSheet(); toast(`Sale added: ${U.fmt(amount, fd.get("currency"))}`);
    } else if (f.classList.contains("settingsform")) {
      await Store.setConfig({ goal: Math.max(1, parseFloat(fd.get("goal")) || 500), currency: fd.get("currency") });
      LS.set("eb_theme", fd.get("theme")); applyTheme();
      if (fd.has("key")) LS.set("eb_anthropic_key", String(fd.get("key")).trim());
      if (fd.has("gumroad")) LS.set("eb_gumroad", String(fd.get("gumroad")).trim());
      closeSheet(); toast("Settings saved");
    } else if (f.classList.contains("links")) {
      const it = S.items[f.dataset.id], links = {};
      for (const [k, v] of fd.entries()) if (String(v).trim()) links[k] = String(v).trim();
      await Store.patch("items", it.id, { links, status: Object.keys(links).length ? "listed" : "approved" });
      toast(Object.keys(links).length ? "Marked as live" : "Links cleared");
    }
  });
  document.addEventListener("change", async e => {
    if (e.target.id !== "restore" || !e.target.files[0]) return;
    try {
      const data = JSON.parse(await e.target.files[0].text()); let n = 0;
      const sources = data.items ? data : { items: {}, earnings: data.earnings || {} };
      if (!data.items && data.products) for (const [id, p] of Object.entries(data.products)) sources.items[id] = { id, bot: p.bot, kind: "printable", title: p.shortName, status: p.status, createdAt: p.createdAt, price: p.price, links: p.listings || {}, data: { bundleKey: p.bundleKey, bundle: p.bundle, theme: p.theme, shortName: p.shortName, title: p.title, description: p.description, tags: p.tags, price: p.price } };
      for (const col of ["items", "earnings", "watches"]) for (const [id, v] of Object.entries(sources[col] || {})) if (!S[col][id]) { await Store.save(col, id, v); n++; }
      toast(`Restored ${n} records`); closeSheet();
    } catch { toast("That file isn't an Earning Bots backup", "error"); }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && ui.sheet) closeSheet(); });
  const P = window.Capacitor && window.Capacitor.Plugins;
  if (P && P.App) P.App.addListener("backButton", () => { if (ui.sheet) closeSheet(); else if (ui.tab !== "home") setTab("home"); else P.App.exitApp(); });

  // ---- start -----------------------------------------------------------------------------------------
  applyTheme();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
  const start = location.hash.slice(1);
  if (TABS.some(t => t[0] === start)) ui.tab = start;
  Store.onChange(render);
  render();
  window.EB.startStorage().then(() => {
    if (window.EB_CLOUD) window.EB_CLOUD.start();
    if (window.EB_QA) setTimeout(() => window.EB_QA.backfill().catch(() => {}), 2500); // image checks for anything not checked yet
  });
  setInterval(autopilot, 5 * 60 * 1000);
  setTimeout(() => window.EB_AUTO.reminders(), 3000);
  setTimeout(autopilot, 20000);
  if (document.fonts) document.fonts.ready.then(() => { thumbs.clear(); render(); });
})();
